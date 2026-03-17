import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';

let pmtilesInitialized = false;
const PARK_DOT_STROKE = '#020617';

function escapeHtml(unsafe: string | number | undefined | null) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
  filter?: any;
  minzoom: number;
  maxzoom?: number;
  radius: any;
  visibility?: 'visible' | 'none';
}) {
  const layer: any = {
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

  return layer;
}

function createLocalFilter(minVisitors?: number) {
  const filter: any[] = [
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
  onSelectedLocation?: (properties: any) => void;
  selectedCountyFips?: string | null;
  selectedCoordinates?: [number, number];
  selectedKind?: SelectedKind;
}

function formatMetric(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'N/A';
  return numericValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function InteractiveMap({
  parkLayer,
  onParkLayerChange,
  onSelectedLocation,
  selectedCoordinates,
  selectedCountyFips,
  selectedKind,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const activeLocationHandler = useRef(onSelectedLocation);
  const [zoom, setZoom] = useState(4);

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

  const setupLayers = useCallback((map: maplibregl.Map) => {
    // Add PMTiles sources
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

    // County base geometry
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

    // Soft county halo to give the polygons a subtle inverse-glow edge
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

    // National Parks layer
    map.addLayer(createParkCircleLayer({
      id: 'parks_national',
      filter: ['==', ['to-number', ['get', 'national']], 1],
      minzoom: 3,
      radius: FOCUSED_MODE_RADIUS
    }));

    // State Parks layer
    map.addLayer(createParkCircleLayer({
      id: 'parks_state',
      filter: ['==', ['to-number', ['get', 'state']], 1],
      minzoom: 3,
      radius: FOCUSED_MODE_RADIUS
    }));

    // Labels for national parks
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

    const parkLayers = PARK_CIRCLE_LAYER_IDS;
    const clickableLayers = [...parkLayers, 'counties_fill_data'];

    const showPopup = (props: any, lngLat: maplibregl.LngLat) => {
      const name = escapeHtml(props.location || props.county || props.county_ascii || 'Unknown');
      const place = escapeHtml(props.city || props.state_name || props.state || '');
      const region = escapeHtml(props.region || '');
      const pre = formatMetric(props.visitor_counts_precovid);
      const post = formatMetric(props.visitor_counts_postcovid);
      const pctRaw = props.percent_change != null ? Number(props.percent_change) : null;
      const pct = pctRaw != null ? (pctRaw * 100).toFixed(1) : 'N/A';
      const pctColor = pctRaw == null ? '#94a3b8' : pctRaw > 0 ? '#10b981' : pctRaw < 0 ? '#f43f5e' : '#94a3b8';

      new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
        .setLngLat(lngLat)
        .setHTML(`
          <div style="font-family:system-ui;padding:8px;color:#f1f5f9;">
            <div style="font-weight:700;font-size:16px;margin-bottom:4px;">${name}</div>
            <div style="color:#94a3b8;font-size:12px;margin-bottom:10px;">${place}${region ? ', ' + region : ''}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div style="background:#1e293b;padding:8px;border-radius:8px;">
                <div style="color:#94a3b8;font-size:10px;text-transform:uppercase;">Pre-COVID</div>
                <div style="font-weight:700;">${pre}</div>
              </div>
              <div style="background:#1e293b;padding:8px;border-radius:8px;">
                <div style="color:#94a3b8;font-size:10px;text-transform:uppercase;">Post-COVID</div>
                <div style="font-weight:700;">${post}</div>
              </div>
            </div>
            <div style="text-align:center;margin-top:8px;font-weight:700;color:${pctColor};font-size:14px;">
              Δ ${pct}%
            </div>
          </div>
        `)
        .addTo(map);
    };

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: clickableLayers });
      if (!features.length) return;

      const parkFeature = features.find((feature) => parkLayers.includes(feature.layer.id));
      const feature = parkFeature ?? features.find((candidate) => candidate.layer.id === 'counties_fill_data');
      if (!feature) return;

      const props = feature.properties;
      if (activeLocationHandler.current) activeLocationHandler.current(props);
      showPopup(props, e.lngLat);
    });

    map.on('mousemove', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: clickableLayers });
      map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
    });

    map.on('mouseout', () => {
      map.getCanvas().style.cursor = '';
    });
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkLayer, setupLayers, syncParkLayerVisibility]);

  // Handle park overlay toggle
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

  // Handle fly-to
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

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full bg-slate-900" />

      {/* Zoom indicator */}
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-white/10 hidden md:block">
        Zoom: {zoom}
      </div>

      {/* Layer filter toggle */}
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

      {/* Color legend */}
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
