import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Github, Layers3 } from 'lucide-react';
import HoverPreviewCard from './HoverPreviewCard';
import { queryCountyByFips } from '../lib/duckdb';
import { normalizeCountyFips } from '../lib/county';
import { createBufferedPmtilesProtocol, resolvePmtilesAssetUrl } from '../lib/pmtiles';
import { MAP_COPY } from '../lib/copy';
import {
  getHoverFeatureKey,
  getStateNameFromCountyFips,
  hydrateCountyPreview,
  resolveHoverPreview,
  type HoverPreviewData,
  type HoverPreviewKind,
} from '../lib/hoverPreview';

let pmtilesInitialized = false;
const PARK_DOT_STROKE = '#04101f';
const HOVER_INTENT_MS = 140;
const PMTILES_ASSET_PATHS = {
  parks: '/data/labeled_change.pmtiles',
  county: '/data/county_change.pmtiles',
} as const;
const DIVERGING_COLOR_RAMP = [
  'interpolate', ['linear'], ['to-number', ['get', 'percent_change']],
  -1, '#ff7a59', 0, '#eef2f5', 1, '#55c271',
] as unknown as maplibregl.ExpressionSpecification;
const DIVERGING_GLOW_RAMP = [
  'interpolate', ['linear'], ['to-number', ['get', 'percent_change']],
  -1, 'rgba(255, 122, 89, 0.42)', 0, 'rgba(238, 242, 245, 0.3)', 1, 'rgba(85, 194, 113, 0.42)',
] as unknown as maplibregl.ExpressionSpecification;

type SelectedKind = 'park' | 'county' | null;
type ParkLayerFilter = 'all' | 'national' | 'state';

interface CameraState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

const DEFAULT_CAMERA_STATE: CameraState = {
  center: [-97, 38],
  zoom: 4,
  bearing: 0,
  pitch: 0,
};

const COUNTY_LAYER_IDS = [
  'counties_fill_base',
  'counties_fill_data',
  'counties_glow',
  'counties_outline',
  'counties_selected_outline'
];

const ALL_MODE_PARK_LAYER_IDS = [
  'all_national',
  'all_state',
  'all_local_top',
  'all_local_major',
  'all_local_regional',
  'all_local_dense',
  'all_local_full'
];

const PARK_CIRCLE_LAYER_IDS = [
  ...ALL_MODE_PARK_LAYER_IDS,
  'parks_national',
  'parks_state'
];

// One label layer per visibility mode keeps the map readable without
// showing overlapping duplicate labels across modes.
const PARK_LABEL_LAYER_IDS = [
  'parks_all_labels',
  'parks_national_labels',
  'parks_state_labels',
];

const PARK_INTERACTIVE_LAYER_IDS = [
  ...PARK_CIRCLE_LAYER_IDS,
  ...PARK_LABEL_LAYER_IDS,
];

const COUNTY_INTERACTIVE_LAYER_IDS = [
  'counties_fill_data',
  'counties_fill_base',
];

const PARK_LAYER_VISIBILITY_MAP: Record<ParkLayerFilter, string[]> = {
  all: [...ALL_MODE_PARK_LAYER_IDS, 'parks_national_labels', 'parks_state_labels', 'parks_all_labels'],
  national: ['parks_national', 'parks_national_labels'],
  state: ['parks_state', 'parks_state_labels'],
};

const PARK_VISITOR_COUNT_CAP = 5000;
const PARK_RADIUS_MIN = 4;
const PARK_RADIUS_MAX = 13;
const PARK_RADIUS_MAX_ROOT = Math.sqrt(PARK_VISITOR_COUNT_CAP);
const PARK_SIZE_LEGEND_VALUES = [50, 250, 1000, PARK_VISITOR_COUNT_CAP] as const;
const LEGEND_PANEL_CLASS = 'rounded-[1.2rem] bg-[color:rgba(4,17,31,0.62)] px-4 py-4 shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl max-h-[calc(100vh-8rem)] overflow-y-auto overscroll-contain';

const PARK_COLOR_RAMP = DIVERGING_COLOR_RAMP;
const MOBILE_CONTROL_WIDTH_CLASS = 'w-full';
const MOBILE_CONTROL_SHELL_CLASS = 'rounded-[1.2rem] bg-[color:rgba(4,17,31,0.62)] p-1.5 shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl';

function formatLegendValue(value: number, plus = false) {
  const formatted = value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return plus ? `${formatted}+` : formatted;
}

function getParkRadius(value: number) {
  const clampedValue = Math.min(Math.max(value, 0), PARK_VISITOR_COUNT_CAP);
  const normalized = Math.sqrt(clampedValue / PARK_VISITOR_COUNT_CAP);
  return PARK_RADIUS_MIN + normalized * (PARK_RADIUS_MAX - PARK_RADIUS_MIN);
}

function createParkRadiusExpression() {
  return [
    'interpolate',
    ['linear'],
    [
      'sqrt',
      [
        'min',
        PARK_VISITOR_COUNT_CAP,
        ['max', 0, ['coalesce', ['to-number', ['get', 'visitor_counts_postcovid']], 0]],
      ],
    ],
    0,
    PARK_RADIUS_MIN,
    PARK_RADIUS_MAX_ROOT,
    PARK_RADIUS_MAX,
  ] as unknown as maplibregl.ExpressionSpecification;
}

const PARK_RADIUS_EXPRESSION = createParkRadiusExpression();

function createParkCircleLayer({
  id,
  filter,
  minzoom,
  maxzoom,
  radius,
  visibility = 'none',
}: {
  id: string;
  filter?: unknown;
  minzoom: number;
  maxzoom?: number;
  radius: unknown;
  visibility?: 'visible' | 'none';
}) {
  const layer: Record<string, unknown> = {
    id,
    type: 'circle',
    source: 'parks_data',
    'source-layer': 'labeled_change',
    minzoom,
    paint: {
      'circle-radius': radius,
      'circle-color': PARK_COLOR_RAMP,
      'circle-opacity': 0.96,
      'circle-stroke-width': 1,
      'circle-stroke-color': PARK_DOT_STROKE,
    },
    layout: { 'visibility': visibility },
  };

  if (filter) {
    layer.filter = filter;
  }

  if (maxzoom != null) {
    layer.maxzoom = maxzoom;
  }

  return layer as unknown as maplibregl.AddLayerObject;
}

function createParkLabelLayer({
  id,
  filter,
  minzoom,
  maxzoom,
  visibility = 'none',
}: {
  id: string;
  filter?: unknown;
  minzoom: number;
  maxzoom?: number;
  visibility?: 'visible' | 'none';
}) {
  const layer: Record<string, unknown> = {
    id,
    type: 'symbol',
    source: 'parks_data',
    'source-layer': 'labeled_change',
    minzoom,
    paint: {
      'text-color': '#ecf5ff',
      'text-halo-color': '#03101f',
      'text-halo-width': 1.5,
    },
    layout: {
      'text-field': ['coalesce', ['get', 'location'], ['get', 'location_name'], ['get', 'name_location']],
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.8,
      'text-size': 11,
      'visibility': visibility,
    },
  };

  if (filter) {
    layer.filter = filter;
  }

  if (maxzoom != null) {
    layer.maxzoom = maxzoom;
  }

  return layer as unknown as maplibregl.AddLayerObject;
}

function createLocalFilter(minVisitors?: number) {
  const filter: unknown[] = [
    'all',
    ['==', ['to-number', ['get', 'national']], 0],
    ['==', ['to-number', ['get', 'state']], 0],
  ];

  if (minVisitors != null) {
    filter.push(['>=', ['to-number', ['get', 'visitor_counts_postcovid']], minVisitors]);
  }

  return filter;
}

function getLayerState(map: maplibregl.Map, layerId: string) {
  if (!map.getLayer(layerId)) {
    return { present: false, visibility: 'missing' as const };
  }

  return {
    present: true,
    visibility: map.getLayoutProperty(layerId, 'visibility') ?? 'visible',
  };
}

function summarizeMapRegistration(map: maplibregl.Map) {
  return {
    styleLoaded: map.isStyleLoaded(),
    sources: {
      parks_data: Boolean(map.getSource('parks_data')),
      county_data: Boolean(map.getSource('county_data')),
    },
    layers: {
      counties_fill_base: getLayerState(map, 'counties_fill_base'),
      counties_fill_data: getLayerState(map, 'counties_fill_data'),
      counties_glow: getLayerState(map, 'counties_glow'),
      counties_outline: getLayerState(map, 'counties_outline'),
      counties_selected_outline: getLayerState(map, 'counties_selected_outline'),
      all_national: getLayerState(map, 'all_national'),
      all_state: getLayerState(map, 'all_state'),
      all_local_top: getLayerState(map, 'all_local_top'),
      all_local_major: getLayerState(map, 'all_local_major'),
      all_local_regional: getLayerState(map, 'all_local_regional'),
      all_local_dense: getLayerState(map, 'all_local_dense'),
      all_local_full: getLayerState(map, 'all_local_full'),
      parks_all_labels: getLayerState(map, 'parks_all_labels'),
      parks_national: getLayerState(map, 'parks_national'),
      parks_state: getLayerState(map, 'parks_state'),
      parks_state_labels: getLayerState(map, 'parks_state_labels'),
      parks_national_labels: getLayerState(map, 'parks_national_labels'),
    },
    filters: {
      counties_fill_data: map.getFilter('counties_fill_data') ?? null,
      counties_selected_outline: map.getFilter('counties_selected_outline') ?? null,
    },
  };
}

interface MapProps {
  isMobile?: boolean;
  parkLayer: ParkLayerFilter;
  onParkLayerChange?: (layer: ParkLayerFilter) => void;
  onSelectedLocation?: (properties: Record<string, unknown>) => void;
  repoUrl: string;
  selectedCountyFips?: string | null;
  selectedCoordinates?: [number, number];
  selectedKind?: SelectedKind;
}

interface HoverCandidate {
  kind: HoverPreviewKind;
  featureKey: string;
  props: Record<string, unknown>;
  position: { x: number; y: number };
}

function canUseHoverPreview(isMobile: boolean) {
  if (isMobile || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;

  // Some desktop-class devices report a coarse primary pointer even though they
  // still support hover via a mouse or trackpad. Allow those desktops to opt in.
  return window.matchMedia('(any-hover: hover)').matches
    || window.matchMedia('(pointer: fine)').matches
    || navigator.maxTouchPoints === 0;
}

export default function InteractiveMap({
  isMobile = false,
  parkLayer,
  onParkLayerChange,
  onSelectedLocation,
  repoUrl,
  selectedCoordinates,
  selectedCountyFips,
  selectedKind,
}: MapProps) {
  const rootContainerRef = useRef<HTMLDivElement>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeLocationHandler = useRef(onSelectedLocation);
  const hoverPreviewCacheRef = useRef<Map<string, HoverPreviewData>>(new Map());
  const countyHydrationCacheRef = useRef<Map<string, Record<string, unknown> | null>>(new Map());
  const countyHydrationRequestRef = useRef<Map<string, Promise<Record<string, unknown> | null>>>(new Map());
  const hoverIntentTimeoutRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<HoverCandidate | null>(null);
  const activeHoverKeyRef = useRef<string | null>(null);
  const cameraStateRef = useRef<CameraState>(DEFAULT_CAMERA_STATE);
  const parkLayerRef = useRef<ParkLayerFilter>(parkLayer);
  const selectedCountyFipsRef = useRef<string | null>(selectedCountyFips ?? null);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewData | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [mobileLegendOpen, setMobileLegendOpen] = useState(false);
  const canHover = useMemo(() => canUseHoverPreview(isMobile), [isMobile]);

  useEffect(() => {
    activeLocationHandler.current = onSelectedLocation;
  }, [onSelectedLocation]);

  useEffect(() => {
    parkLayerRef.current = parkLayer;
  }, [parkLayer]);

  useEffect(() => {
    selectedCountyFipsRef.current = selectedCountyFips ?? null;
  }, [selectedCountyFips]);

  const syncCameraState = useCallback((map: maplibregl.Map) => {
    const center = map.getCenter();
    const nextCameraState: CameraState = {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };

    cameraStateRef.current = nextCameraState;
    return nextCameraState;
  }, []);

  const syncParkLayerVisibility = useCallback((map: maplibregl.Map, layer: ParkLayerFilter) => {
    const parkLayerIds = Array.from(new Set(Object.values(PARK_LAYER_VISIBILITY_MAP).flat()));

    parkLayerIds.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', 'none');
      }
    });

    COUNTY_LAYER_IDS.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', 'visible');
      }
    });

    (PARK_LAYER_VISIBILITY_MAP[layer] || []).forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', 'visible');
      }
    });
  }, []);

  const clearHoverIntent = useCallback(() => {
    if (hoverIntentTimeoutRef.current != null) {
      window.clearTimeout(hoverIntentTimeoutRef.current);
      hoverIntentTimeoutRef.current = null;
    }

    pendingHoverRef.current = null;
  }, []);

  const clearHoverPreview = useCallback(() => {
    clearHoverIntent();
    activeHoverKeyRef.current = null;
    setHoverPreview(null);
    setHoverPosition(null);
  }, [clearHoverIntent]);

  useEffect(() => () => {
    clearHoverPreview();
  }, [clearHoverPreview]);

  const enrichFeatureProps = useCallback((rawProps: unknown): Record<string, unknown> => {
    const props = rawProps && typeof rawProps === 'object'
      ? { ...(rawProps as Record<string, unknown>) }
      : {};

    const normalizedCountyFips = normalizeCountyFips(props.county_fips);
    const stateName = props.state_name || getStateNameFromCountyFips(normalizedCountyFips);

    return {
      ...props,
      county_fips: normalizedCountyFips ?? props.county_fips ?? null,
      state_name: stateName ?? props.state_name ?? null,
    };
  }, []);

  const hydrateCountyHoverPreview = useCallback(async (candidate: HoverCandidate, immediatePreview: HoverPreviewData) => {
    if (candidate.kind !== 'county' || immediatePreview.status === 'Unavailable') {
      return;
    }

    const countyFips = normalizeCountyFips(candidate.props.county_fips);
    if (!countyFips) return;

    const cacheKey = candidate.featureKey;

    if (countyHydrationCacheRef.current.has(countyFips)) {
      const hydratedPreview = hydrateCountyPreview(candidate.props, countyHydrationCacheRef.current.get(countyFips) ?? null);
      hoverPreviewCacheRef.current.set(cacheKey, hydratedPreview);

      if (activeHoverKeyRef.current === cacheKey) {
        setHoverPreview(hydratedPreview);
      }
      return;
    }

    let request = countyHydrationRequestRef.current.get(countyFips);
    if (!request) {
      request = queryCountyByFips(countyFips)
        .then((row) => {
          countyHydrationCacheRef.current.set(countyFips, row ?? null);
          countyHydrationRequestRef.current.delete(countyFips);
          return row ?? null;
        })
        .catch((err) => {
          console.error('County hover hydration failed:', err);
          countyHydrationRequestRef.current.delete(countyFips);
          return null;
        });

      countyHydrationRequestRef.current.set(countyFips, request);
    }

    const row = await request;
    const hydratedPreview = hydrateCountyPreview(candidate.props, row);
    hoverPreviewCacheRef.current.set(cacheKey, hydratedPreview);

    if (activeHoverKeyRef.current === cacheKey) {
      setHoverPreview(hydratedPreview);
    }
  }, []);

  const applyHoverCandidate = useCallback((candidate: HoverCandidate) => {
    activeHoverKeyRef.current = candidate.featureKey;
    setHoverPosition(candidate.position);

    const cachedPreview = hoverPreviewCacheRef.current.get(candidate.featureKey);
    if (cachedPreview) {
      setHoverPreview(cachedPreview);

      if (candidate.kind === 'county' && cachedPreview.trendMode === 'real' && cachedPreview.trendPoints.length === 0 && !cachedPreview.status) {
        void hydrateCountyHoverPreview(candidate, cachedPreview);
      }
      return;
    }

    const immediatePreview = resolveHoverPreview({ kind: candidate.kind, props: candidate.props });
    hoverPreviewCacheRef.current.set(candidate.featureKey, immediatePreview);
    setHoverPreview(immediatePreview);

    if (candidate.kind === 'county' && immediatePreview.trendMode === 'real' && !immediatePreview.status) {
      void hydrateCountyHoverPreview(candidate, immediatePreview);
    }
  }, [hydrateCountyHoverPreview]);

  const scheduleHoverCandidate = useCallback((candidate: HoverCandidate) => {
    clearHoverIntent();
    pendingHoverRef.current = candidate;

    hoverIntentTimeoutRef.current = window.setTimeout(() => {
      hoverIntentTimeoutRef.current = null;
      const nextCandidate = pendingHoverRef.current;
      pendingHoverRef.current = null;

      if (!nextCandidate) return;
      applyHoverCandidate(nextCandidate);
    }, HOVER_INTENT_MS);
  }, [applyHoverCandidate, clearHoverIntent]);

  const resolveFeatureHit = useCallback((features: maplibregl.MapGeoJSONFeature[]) => {
    const parkFeature = features.find((feature) => PARK_INTERACTIVE_LAYER_IDS.includes(feature.layer.id));
    if (parkFeature) {
      return { kind: 'park' as HoverPreviewKind, feature: parkFeature };
    }

    const countyDataFeature = features.find((feature) => feature.layer.id === 'counties_fill_data');
    if (countyDataFeature) {
      return { kind: 'county' as HoverPreviewKind, feature: countyDataFeature };
    }

    const countyBaseFeature = features.find((feature) => feature.layer.id === 'counties_fill_base');
    if (countyBaseFeature) {
      return { kind: 'county' as HoverPreviewKind, feature: countyBaseFeature };
    }

    return null;
  }, []);

  const setupLayers = useCallback((map: maplibregl.Map) => {
    const parksPmtilesUrl = resolvePmtilesAssetUrl(PMTILES_ASSET_PATHS.parks);
    const countyPmtilesUrl = resolvePmtilesAssetUrl(PMTILES_ASSET_PATHS.county);

    console.info('[map] registering PMTiles-backed sources', {
      parksPmtilesUrl,
      countyPmtilesUrl,
    });

    try {
      if (!map.getSource('parks_data')) {
        map.addSource('parks_data', {
          type: 'vector',
          url: `pmtiles://${parksPmtilesUrl}`,
        });
      }

      if (!map.getSource('county_data')) {
        map.addSource('county_data', {
          type: 'vector',
          url: `pmtiles://${countyPmtilesUrl}`,
        });
      }

      map.addLayer({
        id: 'counties_fill_base',
        type: 'fill',
        source: 'county_data',
        'source-layer': 'county_change',
        minzoom: 0,
        paint: {
          'fill-color': '#071728',
          'fill-opacity': 0.18
        },
        layout: { 'visibility': 'visible' }
      });

      map.addLayer({
        id: 'counties_fill_data',
        type: 'fill',
        source: 'county_data',
        'source-layer': 'county_change',
        minzoom: 0,
        filter: ['==', ['to-number', ['get', 'has_data']], 1],
        paint: {
          'fill-color': DIVERGING_COLOR_RAMP,
          'fill-opacity': 0.44
        },
        layout: { 'visibility': 'visible' }
      });

      map.addLayer({
        id: 'counties_glow',
        type: 'line',
        source: 'county_data',
        'source-layer': 'county_change',
        minzoom: 0,
        filter: ['==', ['to-number', ['get', 'has_data']], 1],
        paint: {
          'line-color': DIVERGING_GLOW_RAMP,
          'line-width': 5,
          'line-blur': 4,
          'line-opacity': 0.45
        },
        layout: { 'visibility': 'visible' }
      });

      map.addLayer({
        id: 'counties_outline',
        type: 'line',
        source: 'county_data',
        'source-layer': 'county_change',
        minzoom: 0,
        paint: {
          'line-color': 'rgba(3, 16, 31, 0.95)',
          'line-width': 0.8,
          'line-opacity': 0.6
        },
        layout: { 'visibility': 'visible' }
      });

      map.addLayer({
        id: 'counties_selected_outline',
        type: 'line',
        source: 'county_data',
        'source-layer': 'county_change',
        minzoom: 0,
        filter: ['==', ['get', 'county_fips'], '__none__'],
        paint: {
          'line-color': '#96bee6',
          'line-width': 2.8,
          'line-opacity': 1
        },
        layout: { 'visibility': 'visible' }
      });

      map.addLayer(createParkCircleLayer({
        id: 'all_national',
        filter: ['==', ['to-number', ['get', 'national']], 1],
        minzoom: 0,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_state',
        filter: ['==', ['to-number', ['get', 'state']], 1],
        minzoom: 4,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_top',
        filter: createLocalFilter(4000),
        minzoom: 5,
        maxzoom: 6,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_major',
        filter: createLocalFilter(1000),
        minzoom: 6,
        maxzoom: 7,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_regional',
        filter: createLocalFilter(450),
        minzoom: 7,
        maxzoom: 8,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_dense',
        filter: createLocalFilter(250),
        minzoom: 8,
        maxzoom: 9,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_full',
        filter: createLocalFilter(),
        minzoom: 9,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkCircleLayer({
        id: 'parks_national',
        filter: ['==', ['to-number', ['get', 'national']], 1],
        minzoom: 3,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkCircleLayer({
        id: 'parks_state',
        filter: ['==', ['to-number', ['get', 'state']], 1],
        minzoom: 3,
        radius: PARK_RADIUS_EXPRESSION
      }));

      map.addLayer(createParkLabelLayer({
        id: 'parks_national_labels',
        minzoom: 4,
        filter: ['==', ['to-number', ['get', 'national']], 1],
      }));

      map.addLayer(createParkLabelLayer({
        id: 'parks_state_labels',
        minzoom: 4,
        filter: ['==', ['to-number', ['get', 'state']], 1],
      }));

      map.addLayer(createParkLabelLayer({
        id: 'parks_all_labels',
        minzoom: 11,
        filter: ['all', ['==', ['to-number', ['get', 'national']], 0], ['==', ['to-number', ['get', 'state']], 0]],
      }));
    } catch (error) {
      console.error('[map] layer/source registration failed', error);
      throw error;
    }

    console.info('[map] registered map sources and layers', summarizeMapRegistration(map));

    const interactiveLayers = [...PARK_INTERACTIVE_LAYER_IDS, ...COUNTY_INTERACTIVE_LAYER_IDS];

    map.on('click', (e) => {
      clearHoverPreview();

      const features = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
      if (!features.length) return;

      const resolved = resolveFeatureHit(features);
      if (!resolved) return;

      const props = enrichFeatureProps(resolved.feature.properties);
      if (activeLocationHandler.current) activeLocationHandler.current(props);
    });

    if (canHover) {
      map.on('mousemove', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
        const resolved = resolveFeatureHit(features);

        if (!resolved) {
          map.getCanvas().style.cursor = '';
          clearHoverPreview();
          return;
        }

        map.getCanvas().style.cursor = 'pointer';

        const props = enrichFeatureProps(resolved.feature.properties);
        const featureKey = getHoverFeatureKey(resolved.kind, props);

        if (activeHoverKeyRef.current === featureKey) {
          setHoverPosition({ x: e.point.x, y: e.point.y });
          return;
        }

        if (pendingHoverRef.current?.featureKey === featureKey) {
          pendingHoverRef.current = {
            ...pendingHoverRef.current,
            position: { x: e.point.x, y: e.point.y },
          };
          return;
        }

        if (activeHoverKeyRef.current && activeHoverKeyRef.current !== featureKey) {
          activeHoverKeyRef.current = null;
          setHoverPreview(null);
          setHoverPosition(null);
        }

        scheduleHoverCandidate({
          kind: resolved.kind,
          featureKey,
          props,
          position: { x: e.point.x, y: e.point.y },
        });
      });

      map.on('mouseout', () => {
        map.getCanvas().style.cursor = '';
        clearHoverPreview();
      });

      map.on('movestart', () => {
        map.getCanvas().style.cursor = '';
        clearHoverPreview();
      });
    }
  }, [canHover, clearHoverPreview, enrichFeatureProps, resolveFeatureHit, scheduleHoverCandidate]);

  useEffect(() => {
    if (!pmtilesInitialized) {
      const protocol = createBufferedPmtilesProtocol([
        {
          key: resolvePmtilesAssetUrl(PMTILES_ASSET_PATHS.parks),
          url: resolvePmtilesAssetUrl(PMTILES_ASSET_PATHS.parks),
        },
        {
          key: resolvePmtilesAssetUrl(PMTILES_ASSET_PATHS.county),
          url: resolvePmtilesAssetUrl(PMTILES_ASSET_PATHS.county),
        },
      ]);
      maplibregl.addProtocol('pmtiles', protocol.tile);
      console.info('[map] registered buffered PMTiles protocol');
      pmtilesInitialized = true;
    }

    if (!mapContainer.current || mapRef.current) return;

    const initialCamera = cameraStateRef.current;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: initialCamera.center,
      zoom: initialCamera.zoom,
      bearing: initialCamera.bearing,
      pitch: initialCamera.pitch,
    });

    mapRef.current = map;

    map.on('move', () => {
      syncCameraState(map);
    });

    map.on('load', () => {
      map.jumpTo(cameraStateRef.current);
      syncCameraState(map);
      setupLayers(map);
      syncParkLayerVisibility(map, parkLayerRef.current);
      if (selectedCountyFipsRef.current) {
        map.setFilter('counties_selected_outline', ['==', ['get', 'county_fips'], selectedCountyFipsRef.current]);
      } else {
        map.setFilter('counties_selected_outline', ['==', ['get', 'county_fips'], '__none__']);
      }
      console.info('[map] map load complete', {
        parkLayer: parkLayerRef.current,
        ...summarizeMapRegistration(map),
      });
    });

    map.on('error', (event) => {
      console.error('[map] MapLibre error', event.error ?? event);
    });

    map.on('sourcedata', (event) => {
      const sourceEvent = event as {
        sourceId?: string;
        isSourceLoaded?: boolean;
      };

      if (
        sourceEvent.isSourceLoaded
        && (sourceEvent.sourceId === 'parks_data' || sourceEvent.sourceId === 'county_data')
      ) {
        console.info('[map] source update', {
          sourceId: sourceEvent.sourceId,
          isSourceLoaded: sourceEvent.isSourceLoaded ?? null,
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [setupLayers, syncCameraState, syncParkLayerVisibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncParkLayerVisibility(map, parkLayer);
  }, [parkLayer, syncParkLayerVisibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('counties_selected_outline')) return;

    if (selectedCountyFips) {
      map.setFilter('counties_selected_outline', ['==', ['get', 'county_fips'], selectedCountyFips]);
    } else {
      map.setFilter('counties_selected_outline', ['==', ['get', 'county_fips'], '__none__']);
    }
  }, [selectedCountyFips]);

  useEffect(() => {
    if (mapRef.current && selectedCoordinates) {
      mapRef.current.flyTo({
        center: selectedCoordinates,
        zoom: selectedKind === 'county' ? 7 : 12,
        essential: true
      });
    }
  }, [selectedCoordinates, selectedKind]);

  const layerButtons: {
    desktopLabel: string;
    mobileLabel: string;
    value: ParkLayerFilter;
    ariaLabel: string;
  }[] = [
    {
      desktopLabel: MAP_COPY.allParks,
      mobileLabel: MAP_COPY.allParksMobile,
      value: 'all',
      ariaLabel: MAP_COPY.allParks,
    },
    {
      desktopLabel: 'National',
      mobileLabel: MAP_COPY.nationalParksMobile,
      value: 'national',
      ariaLabel: MAP_COPY.nationalParks,
    },
    {
      desktopLabel: 'State',
      mobileLabel: MAP_COPY.stateParksMobile,
      value: 'state',
      ariaLabel: MAP_COPY.stateParks,
    },
  ];

  const hoverBounds = {
    width: rootContainerRef.current?.clientWidth ?? 0,
    height: rootContainerRef.current?.clientHeight ?? 0,
  };

  const legendContent = (
    <div className="relative space-y-0 text-left text-xs text-[color:#adc6e4]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:#7e98b7]">
        {MAP_COPY.legendTitle}
      </div>

      <div className="absolute left-1/2 top-0 -translate-x-1/2 text-center text-[10px] leading-none text-[color:#8fa6c2] whitespace-nowrap">
        {MAP_COPY.legendSizeNote}
      </div>

      <div className="pt-0">
        <div className="grid grid-cols-4 gap-2">
          {PARK_SIZE_LEGEND_VALUES.map((value, index) => {
            const isCap = index === PARK_SIZE_LEGEND_VALUES.length - 1;
            const radius = getParkRadius(value);
            const diameter = Math.max(6, Math.round(radius * 2));

            return (
              <div key={value} className="flex min-w-0 flex-col items-center gap-1 text-center">
                <div className="flex h-9 items-end justify-center">
                  <div
                    aria-hidden="true"
                    className="shrink-0 rounded-full border border-[color:rgba(4,16,31,0.78)] bg-[color:rgba(236,242,245,0.24)] shadow-[0_8px_18px_rgba(0,8,22,0.18)]"
                    style={{ width: `${diameter}px`, height: `${diameter}px` }}
                  />
                </div>
                <div className="text-[9px] font-medium leading-none tracking-[0.01em] text-[color:#ecf5ff] whitespace-nowrap">
                  {formatLegendValue(value, isCap)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <div className="text-center text-[10px] leading-none text-[color:#8fa6c2]">
          {MAP_COPY.legendColorNote}
        </div>
        <div
          className="h-2.5 w-full rounded-full"
          style={{ background: 'linear-gradient(to right, #ff7a59, #eef2f5, #55c271)' }}
        />
        <div className="grid w-full grid-cols-3 gap-1 text-[9px] text-[color:#7e98b7]">
          <span className="text-left">{MAP_COPY.belowBaseline}</span>
          <span className="text-center">{MAP_COPY.atBaseline}</span>
          <span className="text-right">{MAP_COPY.aboveBaseline}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={rootContainerRef} className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full bg-slate-900" />

      {canHover && hoverPreview && hoverPosition ? (
        <HoverPreviewCard
          preview={hoverPreview}
          position={hoverPosition}
          bounds={hoverBounds}
        />
      ) : null}

      {isMobile ? (
        <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex flex-col items-stretch gap-2">
          <div className={`${MOBILE_CONTROL_WIDTH_CLASS} ${MOBILE_CONTROL_SHELL_CLASS}`}>
            <div className="grid grid-cols-3 gap-1">
              {layerButtons.map(btn => (
                <button
                  key={btn.value}
                  onClick={() => onParkLayerChange?.(btn.value)}
                  aria-label={btn.ariaLabel}
                  className={`flex min-h-10 items-center justify-center rounded-[0.9rem] px-2 text-[11px] font-medium leading-none text-center transition-all ${
                    parkLayer === btn.value
                      ? 'bg-[color:rgba(150,190,230,0.12)] text-white'
                      : 'text-[color:#adc6e4] hover:bg-[color:rgba(150,190,230,0.08)]'
                  }`}
                >
                  {btn.mobileLabel}
                </button>
              ))}
            </div>
          </div>

          <div className={`${MOBILE_CONTROL_WIDTH_CLASS} flex items-center justify-between gap-3`}>
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="View the source on GitHub"
              title="View source on GitHub"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:rgba(150,190,230,0.08)] bg-[color:rgba(4,17,31,0.62)] text-[var(--color-text-secondary)] shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl transition-all hover:border-[color:rgba(150,190,230,0.18)] hover:bg-[color:rgba(150,190,230,0.08)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(150,190,230,0.24)]"
            >
              <Github className="h-[18px] w-[18px]" />
            </a>

            <button
              onClick={() => setMobileLegendOpen((current) => !current)}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[color:rgba(4,17,31,0.62)] px-3 py-2 text-xs font-medium text-[color:#ecf5ff] shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl transition-all hover:bg-[color:rgba(150,190,230,0.08)]"
            >
              <Layers3 className="h-4 w-4 text-[color:#96bee6]" />
              {MAP_COPY.legendButton}
            </button>
          </div>

          {mobileLegendOpen ? (
            <div className={`${MOBILE_CONTROL_WIDTH_CLASS} ${LEGEND_PANEL_CLASS}`}>
              {legendContent}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex flex-wrap justify-center gap-1 rounded-full bg-[color:rgba(4,17,31,0.62)] p-1.5 shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl">
            {layerButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => onParkLayerChange?.(btn.value)}
                className={`min-h-10 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  parkLayer === btn.value
                    ? 'bg-[color:rgba(150,190,230,0.12)] text-white'
                    : 'text-[color:#adc6e4] hover:bg-[color:rgba(150,190,230,0.08)]'
                }`}
              >
                {btn.desktopLabel}
              </button>
            ))}
          </div>

          <div className={`absolute bottom-6 right-6 z-10 w-[18rem] ${LEGEND_PANEL_CLASS}`}>
            {legendContent}
          </div>
        </>
      )}
    </div>
  );
}
