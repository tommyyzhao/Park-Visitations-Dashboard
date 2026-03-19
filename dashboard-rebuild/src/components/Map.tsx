import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers3 } from 'lucide-react';
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

const PARK_INTERACTIVE_LAYER_IDS = [
  ...PARK_CIRCLE_LAYER_IDS,
  'parks_national_labels'
];

const COUNTY_INTERACTIVE_LAYER_IDS = [
  'counties_fill_data',
  'counties_fill_base',
];

const PARK_LAYER_VISIBILITY_MAP: Record<ParkLayerFilter, string[]> = {
  all: [...ALL_MODE_PARK_LAYER_IDS, 'parks_national_labels'],
  national: ['parks_national', 'parks_national_labels'],
  state: ['parks_state'],
};

const ALL_MODE_RADIUS = [
  'interpolate', ['linear'], ['to-number', ['get', 'visitor_counts_postcovid']],
  1, 3, 10, 4, 100, 5, 1000, 6, 10000, 8
];

const FOCUSED_MODE_RADIUS = [
  'interpolate', ['linear'], ['to-number', ['get', 'visitor_counts_postcovid']],
  1, 3, 10, 6, 100, 12, 1000, 24, 10000, 32
];

const PARK_COLOR_RAMP = DIVERGING_COLOR_RAMP;

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
      'circle-stroke-color': PARK_DOT_STROKE
    },
    layout: { 'visibility': visibility }
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
      parks_national: getLayerState(map, 'parks_national'),
      parks_state: getLayerState(map, 'parks_state'),
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
        radius: ALL_MODE_RADIUS
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_state',
        filter: ['==', ['to-number', ['get', 'state']], 1],
        minzoom: 4,
        radius: ALL_MODE_RADIUS
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_top',
        filter: createLocalFilter(4000),
        minzoom: 5,
        maxzoom: 6,
        radius: ALL_MODE_RADIUS
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_major',
        filter: createLocalFilter(1000),
        minzoom: 6,
        maxzoom: 7,
        radius: ALL_MODE_RADIUS
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_regional',
        filter: createLocalFilter(450),
        minzoom: 7,
        maxzoom: 8,
        radius: ALL_MODE_RADIUS
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_dense',
        filter: createLocalFilter(250),
        minzoom: 8,
        maxzoom: 9,
        radius: ALL_MODE_RADIUS
      }));

      map.addLayer(createParkCircleLayer({
        id: 'all_local_full',
        filter: createLocalFilter(),
        minzoom: 9,
        radius: ALL_MODE_RADIUS
      }));

      map.addLayer(createParkCircleLayer({
        id: 'parks_national',
        filter: ['==', ['to-number', ['get', 'national']], 1],
        minzoom: 3,
        radius: FOCUSED_MODE_RADIUS
      }));

      map.addLayer(createParkCircleLayer({
        id: 'parks_state',
        filter: ['==', ['to-number', ['get', 'state']], 1],
        minzoom: 3,
        radius: FOCUSED_MODE_RADIUS
      }));

      map.addLayer({
        id: 'parks_national_labels',
        type: 'symbol',
        source: 'parks_data',
        'source-layer': 'labeled_change',
        filter: ['==', ['to-number', ['get', 'national']], 1],
        minzoom: 6,
        layout: {
          'text-field': ['get', 'location'],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.8,
          'text-size': 11,
          'visibility': 'visible'
        },
        paint: {
          'text-color': '#ecf5ff',
          'text-halo-color': '#03101f',
          'text-halo-width': 1.5
        }
      });
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

  const layerButtons: { label: string; value: ParkLayerFilter }[] = [
    { label: MAP_COPY.allParks, value: 'all' },
    { label: MAP_COPY.nationalParks, value: 'national' },
    { label: MAP_COPY.stateParks, value: 'state' },
  ];

  const hoverBounds = {
    width: rootContainerRef.current?.clientWidth ?? 0,
    height: rootContainerRef.current?.clientHeight ?? 0,
  };

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

      <div
        className={`absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-10 flex flex-wrap justify-center gap-1 rounded-full bg-[color:rgba(4,17,31,0.62)] p-1.5 shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl ${isMobile ? 'max-w-[calc(100vw-1.5rem)]' : ''}`}
      >
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
            {btn.label}
          </button>
        ))}
      </div>

      {isMobile ? (
        <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+4.5rem)] z-10">
          <button
            onClick={() => setMobileLegendOpen((current) => !current)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:rgba(4,17,31,0.62)] px-3 py-2 text-xs font-medium text-[color:#ecf5ff] shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl"
          >
            <Layers3 className="h-4 w-4 text-[color:#96bee6]" />
            {MAP_COPY.legendButton}
          </button>

          {mobileLegendOpen ? (
            <div className="mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-[1.1rem] bg-[color:rgba(4,17,31,0.62)] px-4 py-4 text-left text-xs text-[color:#adc6e4] shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[color:#7e98b7]">
                {MAP_COPY.legendTitle}
              </div>
              <div
                className="mt-3 h-2.5 rounded-full"
                style={{ background: 'linear-gradient(to right, #ff7a59, #eef2f5, #55c271)' }}
              />
              <div className="mt-2 flex justify-between text-[10px] text-[color:#7e98b7]">
                <span>{MAP_COPY.belowBaseline}</span>
                <span>{MAP_COPY.atBaseline}</span>
                <span>{MAP_COPY.aboveBaseline}</span>
              </div>
              <div className="mt-3 text-[11px] leading-5 text-[color:#adc6e4]">
                {MAP_COPY.legendNote}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="absolute bottom-6 right-6 z-10 w-[18rem] rounded-[1.05rem] bg-[color:rgba(4,17,31,0.62)] px-4 py-3 text-left shadow-[0_16px_34px_rgba(0,8,22,0.26)] backdrop-blur-xl">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:#7e98b7]">
            {MAP_COPY.legendTitle}
          </div>
          <div
            className="h-2.5 w-full rounded-full"
            style={{ background: 'linear-gradient(to right, #ff7a59, #eef2f5, #55c271)' }}
          />
          <div className="mt-2 flex w-full justify-between text-[10px] text-[color:#7e98b7]">
            <span>{MAP_COPY.belowBaseline}</span>
            <span>{MAP_COPY.atBaseline}</span>
            <span>{MAP_COPY.aboveBaseline}</span>
          </div>
          <div className="mt-2 text-[11px] text-[color:#adc6e4]">
            {MAP_COPY.legendNote}
          </div>
        </div>
      )}
    </div>
  );
}
