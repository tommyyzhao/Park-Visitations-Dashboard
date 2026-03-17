import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import HoverPreviewCard from './HoverPreviewCard';
import { queryCountyByFips } from '../lib/duckdb';
import { normalizeCountyFips } from '../lib/county';
import {
  getHoverFeatureKey,
  getStateNameFromCountyFips,
  hydrateCountyPreview,
  resolveHoverPreview,
  type HoverPreviewData,
  type HoverPreviewKind,
} from '../lib/hoverPreview';

let pmtilesInitialized = false;
const PARK_DOT_STROKE = '#020617';
const HOVER_INTENT_MS = 140;

type SelectedKind = 'park' | 'county' | null;
type ParkLayerFilter = 'all' | 'national' | 'state';

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

const PARK_COLOR_RAMP = [
  'interpolate', ['linear'], ['to-number', ['get', 'percent_change']],
  -1, '#c51b7d', 0, '#f7f7f7', 1, '#4d9221'
];

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

interface MapProps {
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

function isHoverCapablePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export default function InteractiveMap({
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
  const [zoom, setZoom] = useState(4);
  const [hoverPreview, setHoverPreview] = useState<HoverPreviewData | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const canHover = useMemo(() => isHoverCapablePointer(), []);

  useEffect(() => {
    activeLocationHandler.current = onSelectedLocation;
  }, [onSelectedLocation]);

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
    if (candidate.kind !== 'county' || immediatePreview.status === 'No telemetry available') {
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
    if (!map.getSource('parks_data')) {
      map.addSource('parks_data', {
        type: 'vector',
        url: 'pmtiles://data/labeled_change.pmtiles'
      });
    }
    if (!map.getSource('county_data')) {
      map.addSource('county_data', {
        type: 'vector',
        url: 'pmtiles://data/county_change.pmtiles'
      });
    }

    map.addLayer({
      id: 'counties_fill_base',
      type: 'fill',
      source: 'county_data',
      'source-layer': 'county_change',
      minzoom: 0,
      paint: {
        'fill-color': '#101827',
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
        'fill-color': [
          'interpolate', ['linear'], ['to-number', ['get', 'percent_change']],
          -1, '#c51b7d', 0, '#f7f7f7', 1, '#4d9221'
        ],
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
        'line-color': [
          'interpolate', ['linear'], ['to-number', ['get', 'percent_change']],
          -1, 'rgba(197, 27, 125, 0.55)', 0, 'rgba(247, 247, 247, 0.45)', 1, 'rgba(77, 146, 33, 0.55)'
        ],
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
        'line-color': '#0f172a',
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
        'line-color': '#f59e0b',
        'line-width': 2.4,
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
        'text-color': '#e2e8f0',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.5
      }
    });

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
      const protocol = new Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);
      pmtilesInitialized = true;
    }

    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-97, 38],
      zoom: 4,
    });

    mapRef.current = map;

    map.on('move', () => {
      setZoom(Math.round(map.getZoom() * 10) / 10);
    });

    map.on('load', () => {
      setupLayers(map);
      syncParkLayerVisibility(map, parkLayer);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [parkLayer, setupLayers, syncParkLayerVisibility]);

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
    { label: 'All', value: 'all' },
    { label: 'National', value: 'national' },
    { label: 'State', value: 'state' },
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

      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 hidden md:block">
        Zoom: {zoom}
      </div>

      <div className="absolute mx-4 md:mx-0 top-4 md:right-4 z-10 flex flex-wrap gap-1 bg-black/60 backdrop-blur-md rounded-xl p-1.5 border border-white/10 shadow-2xl justify-center">
        {layerButtons.map(btn => (
          <button
            key={btn.value}
            onClick={() => onParkLayerChange?.(btn.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              parkLayer === btn.value
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-black/60 backdrop-blur-md rounded-xl px-5 py-3 border border-white/10 shadow-2xl text-center">
        <div className="text-xs md:text-sm text-slate-200 mb-2 font-medium">% Change in Avg Monthly Visitations (Pre vs. Post COVID-19)</div>
        <div className="h-3 w-64 mx-auto rounded-full" style={{
          background: 'linear-gradient(to right, #c51b7d, #f7f7f7, #4d9221)'
        }} />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 w-64 mx-auto">
          <span>-100%</span>
          <span>0%</span>
          <span>+100%</span>
        </div>
        <div className="text-[10px] md:text-xs text-slate-400 mt-1.5">County fill = percent change; park dots overlay visitation sites</div>
      </div>
    </div>
  );
}
