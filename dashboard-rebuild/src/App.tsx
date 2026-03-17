import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
const InteractiveMap = lazy(() => import('./components/Map'));
import VisitationChart from './components/VisitationChart';
import { queryParks, queryCounties, queryParkById, queryCountyByName, queryCountyByFips, initDB } from './lib/duckdb';
import { normalizeCountyFips } from './lib/county';
import { Search, MapPin, Navigation2, TreePine, Building2, Loader2 } from 'lucide-react';

type SearchTab = 'park' | 'county';
type ChartMode = 'line' | 'overlay';
type ParkLayerFilter = 'all' | 'national' | 'state';
type SelectedKind = 'park' | 'county' | null;

function inferSelectedKind(item: any): SelectedKind {
  if (item?.safegraph_place_id) return 'park';
  if (item?.county_fips || item?.county || item?.county_ascii) return 'county';
  return null;
}

function App() {
  const [searchTab, setSearchTab] = useState<SearchTab>('park');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPark, setSelectedPark] = useState<any | null>(null);
  const [selectedKind, setSelectedKind] = useState<SelectedKind>(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null);
  const [parkLayer, setParkLayer] = useState<ParkLayerFilter>('national');
  const [isSearching, setIsSearching] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('line');

  // Pre-initialize DuckDB on mount
  useEffect(() => {
    initDB().then(() => setIsDbReady(true)).catch(console.error);
  }, []);

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length > 2 && isDbReady) {
        setIsSearching(true);
        try {
          const res = searchTab === 'park'
            ? await queryParks(searchTerm)
            : await queryCounties(searchTerm);
          setSearchResults(res);
        } catch (err) {
          console.error('Search failed:', err);
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, searchTab, isDbReady]);

  const handleSelectPark = useCallback((park: any) => {
    const kind = inferSelectedKind(park);
    const countyFips = normalizeCountyFips(park?.county_fips);

    setSelectedKind(kind);
    setSelectedCountyFips(kind === 'county' ? countyFips : null);
    setSelectedPark(park);
    setSearchTerm('');
    setSearchResults([]);
  }, []);

  const handleMapSelect = useCallback(async (props: any) => {
    const isPark = Boolean(props.safegraph_place_id);
    const isCounty = !isPark && Boolean(props.county_fips || props.county || props.county_ascii);
    const normalizedCountyFips = normalizeCountyFips(props.county_fips);

    if (isCounty) {
      setSelectedKind('county');
      setSelectedCountyFips(normalizedCountyFips);
    } else {
      setSelectedKind(isPark ? 'park' : null);
      setSelectedCountyFips(null);
    }

    // Check if props has the date keys (time series data)
    const hasTimeSeries = Object.keys(props).some(k => /^\d{4}/.test(k) || k.includes('/'));
    
    if (!hasTimeSeries) {
      if (props.safegraph_place_id) {
        const full = await queryParkById(props.safegraph_place_id);
        if (full) {
          setSelectedPark(full);
          return;
        }
      } else if (props.county_fips) {
        const full = await queryCountyByFips(props.county_fips);
        if (full) {
          setSelectedCountyFips(normalizeCountyFips(full.county_fips));
          setSelectedPark(full);
          return;
        }
      } else if (props.county || props.county_ascii) {
        const full = await queryCountyByName(props.county || props.county_ascii, props.state || props.state_name || props.region);
        if (full) {
          setSelectedCountyFips(normalizeCountyFips(full.county_fips));
          setSelectedPark(full);
          return;
        }
      }
    }

    setSelectedPark(props);
  }, []);

  // Build coordinates from selected park
  const coords = useMemo((): [number, number] | undefined => {
    if (selectedPark?.longitude != null && selectedPark?.latitude != null) {
      return [Number(selectedPark.longitude), Number(selectedPark.latitude)];
    }
    if (selectedPark?.lng != null && selectedPark?.lat != null) {
      return [Number(selectedPark.lng), Number(selectedPark.lat)];
    }
    return undefined;
  }, [selectedPark]);

  const parkName = selectedPark?.location_name || selectedPark?.location || selectedPark?.county_ascii || selectedPark?.county || 'Unknown';

  // Extract visitation data for chart (county data has date keys like "2018.01.01")
  const COVID_START = useMemo(() => new Date('2020-02-28'), []);
  const { visitationData, computedPreCovid, computedPostCovid, computedPctChange } = useMemo(() => {
    if (!selectedPark) return { visitationData: {} as Record<string, number>, computedPreCovid: null, computedPostCovid: null, computedPctChange: null };

    const d: Record<string, number> = {};
    const preValues: number[] = [];
    const postValues: number[] = [];

    for (const [key, value] of Object.entries(selectedPark)) {
      // Match date-like keys: "2018.01.01" or "1/1/2018"
      if (/^\d{4}\.\d{2}\.\d{2}$/.test(key) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(key)) {
        const dateKey = key.replace(/\./g, '-');
        const numVal = Number(value);
        if (!isNaN(numVal) && numVal > 0) {
          d[dateKey] = numVal;
          const dateObj = new Date(dateKey);
          if (dateObj < COVID_START) {
            preValues.push(numVal);
          } else {
            postValues.push(numVal);
          }
        }
      }
    }

    const preAvg = preValues.length > 0 ? preValues.reduce((a, b) => a + b, 0) / preValues.length : null;
    const postAvg = postValues.length > 0 ? postValues.reduce((a, b) => a + b, 0) / postValues.length : null;
    const pct = preAvg != null && postAvg != null ? (preAvg === 0 ? null : (postAvg - preAvg) / preAvg) : null;

    return { visitationData: d, computedPreCovid: preAvg, computedPostCovid: postAvg, computedPctChange: pct };
  }, [selectedPark, COVID_START]);

  // Use existing fields if present, else use computed values
  const displayPreCovid = selectedPark?.visitor_counts_precovid ?? computedPreCovid;
  const displayPostCovid = selectedPark?.visitor_counts_postcovid ?? computedPostCovid;
  const displayPctChange = selectedPark?.percent_change ?? computedPctChange;

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-100 font-sans">

      {/* Sidebar */}
      <div className="w-full md:w-[420px] h-1/2 md:h-full flex-shrink-0 z-20 flex flex-col bg-slate-900/60 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">

        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3 text-blue-400 mb-1">
            <Navigation2 className="w-5 h-5" />
            <h1 className="text-lg font-bold tracking-tight text-white m-0">ParkVisitations</h1>
          </div>
          <p className="text-slate-500 text-xs">Visitation telemetry powered by DuckDB & PMTiles</p>
        </div>

        {/* Search Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => { setSearchTab('park'); setSearchTerm(''); setSearchResults([]); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              searchTab === 'park' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-300 hover:text-white'
            }`}
          >
            <TreePine className="w-4 h-4" /> Park Search
          </button>
          <button
            onClick={() => { setSearchTab('county'); setSearchTerm(''); setSearchResults([]); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              searchTab === 'county' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" /> County Search
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 pb-2 relative">
          <div className="relative group">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder={
                !isDbReady
                  ? 'Loading DuckDB engine...'
                  : searchTab === 'park'
                  ? 'Search parks (e.g. Yellowstone, Central Park)...'
                  : 'Search counties (e.g. Los Angeles, Cook)...'
              }
              disabled={!isDbReady}
              className="w-full bg-black/40 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-slate-500 text-slate-100 shadow-inner disabled:opacity-50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {(isSearching || !isDbReady) && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 text-slate-400 animate-spin" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-1 max-h-64 overflow-y-auto rounded-xl bg-slate-800/95 border border-white/10 shadow-xl z-50 backdrop-blur-3xl">
              {searchResults.map((item, idx) => (
                <button
                  key={item.safegraph_place_id || `county-${idx}`}
                  className="w-full text-left p-3 hover:bg-blue-500/20 border-b border-white/5 last:border-0 transition-colors flex items-start gap-3 cursor-pointer"
                  onClick={() => handleSelectPark(item)}
                >
                  <MapPin className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-slate-100 text-sm">
                      {searchTab === 'park' ? item.location_name : item.county_ascii}
                    </div>
                    <div className="text-xs text-slate-400">
                      {searchTab === 'park' ? `${item.city}, ${item.region}` : item.state_name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart mode toggle */}
        {selectedPark && Object.keys(visitationData).length > 0 && (
          <div className="px-4 pt-2 flex gap-2">
            <button
              onClick={() => setChartMode('line')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                chartMode === 'line' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setChartMode('overlay')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                chartMode === 'overlay' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Pre/Post COVID
            </button>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedPark ? (
            <>
              <div className="bg-gradient-to-br from-blue-500/10 to-emerald-500/10 rounded-2xl p-5 border border-white/10 shadow-lg relative overflow-hidden flex-shrink-0">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl"></div>
                <h2 className="text-xl font-bold mb-1 relative z-10">{parkName}</h2>
                <div className="text-slate-400 text-sm flex items-center gap-1 mb-4 relative z-10">
                  <MapPin className="w-3 h-3" />
                  {selectedPark.city || selectedPark.state_name || ''}{selectedPark.region ? `, ${selectedPark.region}` : ''}
                </div>

                <div className="grid grid-cols-3 gap-2 relative z-10">
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Pre-COVID</div>
                    <div className="text-base font-bold text-slate-200">
                      {displayPreCovid != null
                        ? Number(displayPreCovid).toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Post-COVID</div>
                    <div className="text-base font-bold text-slate-200">
                      {displayPostCovid != null
                        ? Number(displayPostCovid).toLocaleString(undefined, { maximumFractionDigits: 0 })
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Δ Change</div>
                    <div className={`text-base font-bold ${
                      (displayPctChange ?? 0) > 0 ? 'text-emerald-400' : (displayPctChange ?? 0) < 0 ? 'text-rose-400' : 'text-slate-200'
                    }`}>
                      {displayPctChange != null
                        ? `${(Number(displayPctChange) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-[250px]">
                {/* Visitation Chart */}
                <VisitationChart data={visitationData} parkName={parkName} mode={chartMode} />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <MapPin className="w-12 h-12 mb-4 text-slate-700" />
              <h3 className="font-semibold text-slate-400 mb-1">No Location Selected</h3>
              <p className="text-sm">Search for a park or county, or click the map.</p>
              {!isDbReady && (
                <div className="mt-4 flex items-center gap-2 text-xs text-blue-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Initializing DuckDB engine...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 text-[10px] text-slate-500 text-center flex items-center justify-center gap-3 bg-black/20">
          <span>MapLibre GL · PMTiles · DuckDB-WASM</span>
          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          <span className={isDbReady ? 'text-emerald-400' : 'text-amber-400'}>{isDbReady ? '● Online' : '○ Loading'}</span>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative">
        <Suspense fallback={
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="text-sm font-medium">Initializing Map Engine...</p>
          </div>
        }>
          <InteractiveMap
            parkLayer={parkLayer}
            onParkLayerChange={setParkLayer}
            onSelectedLocation={handleMapSelect}
            selectedCountyFips={selectedCountyFips}
            selectedCoordinates={coords}
            selectedKind={selectedKind}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default App;
