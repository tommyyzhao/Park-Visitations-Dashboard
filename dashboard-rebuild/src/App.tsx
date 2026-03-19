import {
  lazy,
  Suspense,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Building2,
  Github,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  TreePine,
} from 'lucide-react';
import VisitationChart from './components/VisitationChart';
import { APP_COPY, CHART_COPY, HOVER_COPY } from './lib/copy';
import {
  initDB,
  queryCounties,
  queryCountyByFips,
  queryCountyByName,
  queryParkById,
  queryParks,
} from './lib/duckdb';
import { normalizeCountyFips } from './lib/county';
import { synthesizeParkTrend } from './lib/hoverPreview';

const InteractiveMap = lazy(() => import('./components/Map'));
const GITHUB_REPO_URL = 'https://github.com/tommyyzhao/Park-Visitations-Dashboard';

type SearchTab = 'park' | 'county';
type ChartMode = 'line' | 'overlay';
type ParkLayerFilter = 'all' | 'national' | 'state';
type SelectedKind = 'park' | 'county' | null;
type MobileSheetStage = 'peek' | 'half' | 'full';
type LocationRecord = Record<string, unknown> & {
  city?: string;
  county?: string;
  county_ascii?: string;
  county_fips?: string | number | null;
  lat?: string | number | null;
  latitude?: string | number | null;
  lng?: string | number | null;
  location?: string;
  location_name?: string;
  longitude?: string | number | null;
  percent_change?: string | number | null;
  region?: string;
  safegraph_place_id?: string;
  state?: string;
  state_name?: string;
  visitor_counts_postcovid?: string | number | null;
  visitor_counts_precovid?: string | number | null;
};

const MOBILE_BREAKPOINT = 768;
const MOBILE_PEEK_HEIGHT = 132;
const SHEET_DRAG_THRESHOLD = 36;
const MOBILE_SHEET_STAGE_ORDER: MobileSheetStage[] = ['full', 'half', 'peek'];

function inferSelectedKind(item: LocationRecord | null | undefined): SelectedKind {
  if (item?.safegraph_place_id) return 'park';
  if (item?.county_fips || item?.county || item?.county_ascii) return 'county';
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getNextSheetStage(stage: MobileSheetStage, direction: 'up' | 'down') {
  const index = MOBILE_SHEET_STAGE_ORDER.indexOf(stage);
  const nextIndex = direction === 'down'
    ? Math.min(index + 1, MOBILE_SHEET_STAGE_ORDER.length - 1)
    : Math.max(index - 1, 0);
  return MOBILE_SHEET_STAGE_ORDER[nextIndex];
}

function formatMetric(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function coerceNumber(value: string | number | null | undefined) {
  if (value == null) return null;
  const next = Number(value);
  return Number.isNaN(next) ? null : next;
}

function formatDelta(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return 'N/A';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function getDeltaAccent(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) {
    return {
      text: 'text-[var(--color-text-primary)]',
      badge: 'bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)] border-[color:var(--color-border-strong)]',
      glow: 'from-[color:rgba(150,190,230,0.16)] to-transparent',
    };
  }

  if (value > 0) {
    return {
      text: 'text-[var(--color-data-positive)]',
      badge: 'bg-[color:rgba(85,194,113,0.14)] text-[var(--color-data-positive)] border-[color:rgba(85,194,113,0.28)]',
      glow: 'from-[color:rgba(85,194,113,0.16)] to-transparent',
    };
  }

  if (value < 0) {
    return {
      text: 'text-[var(--color-data-negative)]',
      badge: 'bg-[color:rgba(255,122,89,0.14)] text-[var(--color-data-negative)] border-[color:rgba(255,122,89,0.28)]',
      glow: 'from-[color:rgba(255,122,89,0.18)] to-transparent',
    };
  }

  return {
    text: 'text-[var(--color-text-primary)]',
    badge: 'bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)] border-[color:var(--color-border-strong)]',
    glow: 'from-[color:rgba(150,190,230,0.16)] to-transparent',
  };
}

function App() {
  const [searchTab, setSearchTab] = useState<SearchTab>('park');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<LocationRecord[]>([]);
  const [selectedPark, setSelectedPark] = useState<LocationRecord | null>(null);
  const [selectedKind, setSelectedKind] = useState<SelectedKind>(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null);
  const [parkLayer, setParkLayer] = useState<ParkLayerFilter>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>('line');
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900,
  );
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );
  const [mobileSheetStage, setMobileSheetStage] = useState<MobileSheetStage>('peek');
  const [mobileSheetOffset, setMobileSheetOffset] = useState<number | null>(null);
  const sheetDragMovedRef = useRef(false);
  const sheetDragRef = useRef<{
    pointerId: number;
    startOffset: number;
    startStage: MobileSheetStage;
    startY: number;
  } | null>(null);

  useEffect(() => {
    initDB().then(() => setIsDbReady(true)).catch(console.error);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
      setIsMobileViewport(window.innerWidth < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileSheetOffset(null);
      return;
    }

    if (!selectedPark && !searchTerm && searchResults.length === 0) {
      setMobileSheetStage('peek');
    }
  }, [isMobileViewport, searchResults.length, searchTerm, selectedPark]);

  const mobileSheetHeight = useMemo(() => {
    const availableHeight = Math.max(viewportHeight - 12, 480);
    return Math.min(availableHeight, 760);
  }, [viewportHeight]);

  const mobileSheetOffsets = useMemo(() => {
    const peekVisible = MOBILE_PEEK_HEIGHT;
    const halfVisible = clamp(Math.round(viewportHeight * 0.54), 380, mobileSheetHeight - 104);
    const fullVisible = mobileSheetHeight - 18;

    return {
      peek: clamp(mobileSheetHeight - peekVisible, 0, mobileSheetHeight - 92),
      half: clamp(mobileSheetHeight - halfVisible, 0, mobileSheetHeight - 92),
      full: clamp(mobileSheetHeight - fullVisible, 0, mobileSheetHeight - 92),
    };
  }, [mobileSheetHeight, viewportHeight]);

  const currentSheetOffset = mobileSheetOffset ?? mobileSheetOffsets[mobileSheetStage];

  const snapMobileSheet = useCallback((stage: MobileSheetStage) => {
    setMobileSheetStage(stage);
    setMobileSheetOffset(null);
  }, []);

  const handleMobileSearchFocus = useCallback(() => {
    if (!isMobileViewport) return;
    if (mobileSheetStage === 'peek') {
      snapMobileSheet('half');
    }
  }, [isMobileViewport, mobileSheetStage, snapMobileSheet]);

  const handleSheetPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMobileViewport) return;

    sheetDragMovedRef.current = false;
    sheetDragRef.current = {
      pointerId: event.pointerId,
      startOffset: currentSheetOffset,
      startStage: mobileSheetStage,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [currentSheetOffset, isMobileViewport, mobileSheetStage]);

  const handleSheetPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextOffset = clamp(
      drag.startOffset + (event.clientY - drag.startY),
      mobileSheetOffsets.full,
      mobileSheetOffsets.peek,
    );

    if (Math.abs(event.clientY - drag.startY) > 8) {
      sheetDragMovedRef.current = true;
    }
    setMobileSheetOffset(nextOffset);
  }, [mobileSheetOffsets.full, mobileSheetOffsets.peek]);

  const handleSheetPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - drag.startY;
    let nextStage = drag.startStage;

    if (Math.abs(deltaY) >= SHEET_DRAG_THRESHOLD) {
      nextStage = getNextSheetStage(drag.startStage, deltaY > 0 ? 'down' : 'up');
    } else {
      const nextOffset = mobileSheetOffset ?? drag.startOffset;
      const entries = (Object.entries(mobileSheetOffsets) as Array<[MobileSheetStage, number]>)
        .sort((a, b) => Math.abs(a[1] - nextOffset) - Math.abs(b[1] - nextOffset));
      nextStage = entries[0][0];
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    snapMobileSheet(nextStage);
    sheetDragRef.current = null;
  }, [mobileSheetOffset, mobileSheetOffsets, snapMobileSheet]);

  const handleSheetToggleClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (sheetDragMovedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      sheetDragMovedRef.current = false;
      return;
    }

    snapMobileSheet(mobileSheetStage === 'peek'
      ? 'half'
      : mobileSheetStage === 'full'
        ? 'half'
        : 'full');
  }, [mobileSheetStage, snapMobileSheet]);

  const handleSelectPark = useCallback((park: LocationRecord) => {
    const kind = inferSelectedKind(park);
    const countyFips = normalizeCountyFips(park?.county_fips);

    setSelectedKind(kind);
    setSelectedCountyFips(kind === 'county' ? countyFips : null);
    setSelectedPark(park);
    setSearchTerm('');
    setSearchResults([]);

    if (isMobileViewport) {
      setMobileSheetStage('full');
      setMobileSheetOffset(null);
    }
  }, [isMobileViewport]);

  const handleMapSelect = useCallback(async (props: LocationRecord) => {
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

    setSearchTerm('');
    setSearchResults([]);

    const hasTimeSeries = Object.keys(props).some((k) => /^\d{4}/.test(k) || k.includes('/'));

    if (!hasTimeSeries) {
      if (props.safegraph_place_id) {
        const full = await queryParkById(props.safegraph_place_id);
        if (full) {
          setSelectedPark(full);
          if (isMobileViewport) {
            setMobileSheetStage('full');
          }
          return;
        }
      } else if (props.county_fips) {
        const full = await queryCountyByFips(props.county_fips);
        if (full) {
          setSelectedCountyFips(normalizeCountyFips(full.county_fips));
          setSelectedPark(full);
          if (isMobileViewport) {
            setMobileSheetStage('full');
          }
          return;
        }
      } else if (props.county || props.county_ascii) {
        const countyName = String(props.county || props.county_ascii || '');
        const full = await queryCountyByName(
          countyName,
          String(props.state || props.state_name || props.region || ''),
        );
        if (full) {
          setSelectedCountyFips(normalizeCountyFips(full.county_fips));
          setSelectedPark(full);
          if (isMobileViewport) {
            setMobileSheetStage('full');
          }
          return;
        }
      }
    }

    setSelectedPark(props);
    if (isMobileViewport) {
      setMobileSheetStage('full');
    }
  }, [isMobileViewport]);

  const coords = useMemo((): [number, number] | undefined => {
    if (selectedPark?.longitude != null && selectedPark?.latitude != null) {
      return [Number(selectedPark.longitude), Number(selectedPark.latitude)];
    }
    if (selectedPark?.lng != null && selectedPark?.lat != null) {
      return [Number(selectedPark.lng), Number(selectedPark.lat)];
    }
    return undefined;
  }, [selectedPark]);

  const parkName = selectedPark?.location_name
    || selectedPark?.location
    || selectedPark?.county_ascii
    || selectedPark?.county
    || 'Unknown';
  const selectedSubtitle = selectedKind === 'county'
    ? selectedPark?.state_name || 'County'
    : [selectedPark?.city, selectedPark?.region].filter(Boolean).join(', ') || selectedPark?.state_name || 'Park';
  const selectedBadge = selectedKind === 'county' ? 'County' : 'Park';

  const COVID_START = useMemo(() => new Date('2020-02-28'), []);
  const { visitationData, computedPreCovid, computedPostCovid, computedPctChange } = useMemo(() => {
    if (!selectedPark) {
      return {
        visitationData: {} as Record<string, number>,
        computedPreCovid: null,
        computedPostCovid: null,
        computedPctChange: null,
      };
    }

    const d: Record<string, number> = {};
    const preValues: number[] = [];
    const postValues: number[] = [];

    for (const [key, value] of Object.entries(selectedPark)) {
      if (/^\d{4}\.\d{2}\.\d{2}$/.test(key) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(key)) {
        const dateKey = key.replace(/\./g, '-');
        const numVal = Number(value);
        if (!Number.isNaN(numVal) && numVal > 0) {
          d[dateKey] = numVal;
          const dateObj = new Date(dateKey);
          if (dateObj < COVID_START) preValues.push(numVal);
          else postValues.push(numVal);
        }
      }
    }

    if (Object.keys(d).length === 0 && selectedPark.safegraph_place_id) {
      const syntheticTrend = synthesizeParkTrend(selectedPark as Record<string, unknown>);
      syntheticTrend.forEach(({ date, value }) => {
        d[date] = value;

        const dateObj = new Date(date);
        if (dateObj < COVID_START) preValues.push(value);
        else postValues.push(value);
      });
    }

    const preAvg = preValues.length > 0 ? preValues.reduce((a, b) => a + b, 0) / preValues.length : null;
    const postAvg = postValues.length > 0 ? postValues.reduce((a, b) => a + b, 0) / postValues.length : null;
    const pct = preAvg != null && postAvg != null
      ? (preAvg === 0 ? null : (postAvg - preAvg) / preAvg)
      : null;

    return { visitationData: d, computedPreCovid: preAvg, computedPostCovid: postAvg, computedPctChange: pct };
  }, [COVID_START, selectedPark]);

  const displayPreCovid = selectedPark?.visitor_counts_precovid ?? computedPreCovid;
  const displayPostCovid = selectedPark?.visitor_counts_postcovid ?? computedPostCovid;
  const displayPctChange = selectedPark?.percent_change ?? computedPctChange;
  const preCovidValue = coerceNumber(displayPreCovid);
  const postCovidValue = coerceNumber(displayPostCovid);
  const pctChangeValue = coerceNumber(displayPctChange);
  const deltaAccent = getDeltaAccent(pctChangeValue);
  const selectionStatusLabel = pctChangeValue == null
    ? HOVER_COPY.unavailable
    : pctChangeValue > 0
      ? HOVER_COPY.aboveBaseline
      : pctChangeValue < 0
        ? HOVER_COPY.belowBaseline
        : HOVER_COPY.atBaseline;

  const renderSearchResultButton = (item: LocationRecord, idx: number) => (
    <button
      key={item.safegraph_place_id || `county-${idx}`}
      className="flex min-h-12 w-full items-start gap-3 rounded-[1rem] px-3 py-3 text-left transition-colors hover:bg-[color:rgba(150,190,230,0.10)]"
      onClick={() => handleSelectPark(item)}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:rgba(150,190,230,0.12)] text-[var(--color-accent)]">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
          {searchTab === 'park' ? item.location_name : item.county_ascii}
        </div>
        <div className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
          {searchTab === 'park' ? `${item.city}, ${item.region}` : item.state_name}
        </div>
      </div>
    </button>
  );

  const renderSearchControls = (compact: boolean) => (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => {
            setSearchTab('park');
            setSearchTerm('');
            setSearchResults([]);
          }}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] px-3 text-sm font-medium transition-all ${
            searchTab === 'park'
              ? 'bg-[color:rgba(150,190,230,0.12)] text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[color:rgba(150,190,230,0.06)]'
          }`}
        >
          <TreePine className="h-4 w-4" />
          {APP_COPY.parkTab}
        </button>
        <button
          onClick={() => {
            setSearchTab('county');
            setSearchTerm('');
            setSearchResults([]);
          }}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] px-3 text-sm font-medium transition-all ${
            searchTab === 'county'
              ? 'bg-[color:rgba(150,190,230,0.12)] text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[color:rgba(150,190,230,0.06)]'
          }`}
        >
          <Building2 className="h-4 w-4" />
          {APP_COPY.countyTab}
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <input
          type="text"
          placeholder={
            !isDbReady
              ? APP_COPY.dataLoading
              : searchTab === 'park'
                ? APP_COPY.parkSearchPlaceholder
                : APP_COPY.countySearchPlaceholder
          }
          disabled={!isDbReady}
          className="min-h-12 w-full rounded-[1rem] bg-[linear-gradient(180deg,rgba(8,22,39,0.88),rgba(7,18,33,0.78))] py-3 pl-11 pr-11 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-[color:rgba(150,190,230,0.08)] outline-none transition-all placeholder:text-[var(--color-text-tertiary)] focus:ring-[color:rgba(150,190,230,0.18)] focus:shadow-[0_0_0_3px_rgba(150,190,230,0.06)] disabled:cursor-not-allowed disabled:opacity-70"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        {(isSearching || !isDbReady) ? (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-text-tertiary)]" />
        ) : null}

        {searchResults.length > 0 ? (
          <div className={`absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto rounded-[1rem] bg-[linear-gradient(180deg,rgba(6,18,33,0.94),rgba(4,14,28,0.9))] p-[0.3125rem] shadow-[0_18px_44px_rgba(0,10,24,0.32)] backdrop-blur-2xl ${compact ? 'max-h-[min(50vh,18rem)]' : ''}`}>
            {searchResults.map((item, idx) => renderSearchResultButton(item, idx))}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderMobileSearchControls = () => (
    <section className="dashboard-panel-section overflow-hidden">
      <div className="grid gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            placeholder={
              !isDbReady
                ? APP_COPY.dataLoading
                : APP_COPY.mobileSearchPlaceholder
            }
            disabled={!isDbReady}
            className="min-h-12 w-full rounded-[1rem] bg-[linear-gradient(180deg,rgba(8,22,39,0.88),rgba(7,18,33,0.78))] py-3 pl-11 pr-11 text-sm text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-[color:rgba(150,190,230,0.08)] outline-none transition-all placeholder:text-[var(--color-text-tertiary)] focus:ring-[color:rgba(150,190,230,0.18)] focus:shadow-[0_0_0_3px_rgba(150,190,230,0.06)] disabled:cursor-not-allowed disabled:opacity-70"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onFocus={handleMobileSearchFocus}
          />
          {(isSearching || !isDbReady) ? (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-text-tertiary)]" />
          ) : null}
        </div>

        {mobileSheetStage !== 'peek' ? (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  setSearchTab('park');
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] px-3 text-sm font-medium transition-all ${
                  searchTab === 'park'
                    ? 'bg-[color:rgba(150,190,230,0.12)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[color:rgba(150,190,230,0.06)]'
                }`}
              >
                <TreePine className="h-4 w-4" />
                {APP_COPY.parkTab}
              </button>
              <button
                onClick={() => {
                  setSearchTab('county');
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] px-3 text-sm font-medium transition-all ${
                  searchTab === 'county'
                    ? 'bg-[color:rgba(150,190,230,0.12)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[color:rgba(150,190,230,0.06)]'
                }`}
              >
                <Building2 className="h-4 w-4" />
                {APP_COPY.countyTab}
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="max-h-[min(42vh,18rem)] overflow-y-auto rounded-[1rem] bg-[linear-gradient(180deg,rgba(6,18,33,0.94),rgba(4,14,28,0.9))] p-[0.3125rem] shadow-[0_18px_44px_rgba(0,10,24,0.32)] backdrop-blur-2xl">
                {searchResults.map((item, idx) => renderSearchResultButton(item, idx))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );

  const renderInsightSections = (mobile: boolean) => {
    if (!selectedPark) {
      if (mobile) return null;

      return (
        <section className="dashboard-panel-section overflow-hidden">
          <div className="relative z-10">
            <div className="dashboard-section-kicker">{APP_COPY.selectLocationKicker}</div>
            <h2 className="mt-2 font-display text-[1.55rem] font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
              {APP_COPY.desktopHeadline}
            </h2>
            <p className="mt-3 max-w-[28rem] text-sm leading-6 text-[var(--color-text-secondary)]">
              {APP_COPY.desktopBody}
            </p>
            {!isDbReady ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:rgba(255,122,89,0.08)] px-3 py-2 text-xs text-[var(--color-data-negative)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {APP_COPY.dataLoading}
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    return (
      <>
        <section className="dashboard-hero-card">
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br ${deltaAccent.glow}`} />
          <div className="relative z-10 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[color:rgba(150,190,230,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                {selectedBadge}
              </div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${deltaAccent.badge}`}>
                {selectionStatusLabel}
              </span>
            </div>
            <h2 className="mt-2 font-display text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--color-text-primary)] md:text-[1.72rem]">
              {parkName}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:rgba(255,255,255,0.04)] px-2.5 py-1">
                <MapPin className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                {selectedSubtitle}
              </span>
            </div>
          </div>
        </section>

        <section className="dashboard-panel-section">
          <div className={`flex ${mobile ? 'flex-col gap-2' : 'items-start justify-between gap-3'}`}>
            <div className="min-w-0">
              <div className="font-display text-[1rem] font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
                {APP_COPY.monthlyVisits}
              </div>
              {mobile ? null : (
                <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {chartMode === 'line' ? CHART_COPY.monthlyTrend : APP_COPY.beforeAfterByMonth}
                </div>
              )}
            </div>
            <div className={`min-w-0 ${mobile ? 'w-full' : ''}`}>
              <div className={`gap-1 rounded-[1rem] border border-[color:rgba(150,190,230,0.1)] bg-[color:rgba(255,255,255,0.03)] p-1 ${mobile ? 'grid w-full grid-cols-2' : 'inline-flex'}`}>
                <button
                  onClick={() => setChartMode('line')}
                  className={`flex min-h-9 items-center justify-center rounded-[0.85rem] px-2 text-[11px] font-medium transition-all ${
                    chartMode === 'line'
                      ? 'bg-[color:rgba(150,190,230,0.14)] text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[color:rgba(150,190,230,0.06)]'
                  }`}
                >
                  {APP_COPY.timeline}
                </button>
                <button
                  onClick={() => setChartMode('overlay')}
                  className={`flex min-h-9 items-center justify-center rounded-[0.85rem] px-2 text-[11px] font-medium transition-all ${
                    chartMode === 'overlay'
                      ? 'bg-[color:rgba(150,190,230,0.14)] text-[var(--color-text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[color:rgba(150,190,230,0.06)]'
                  }`}
                >
                  {APP_COPY.beforeAfter}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <VisitationChart
              compact={mobile}
              data={visitationData}
              mode={chartMode}
            />
          </div>
        </section>

        <section className="dashboard-panel-section">
          <div className="dashboard-section-kicker">{APP_COPY.summary}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            <div className="dashboard-metric-card">
              <div className="dashboard-metric-label">{APP_COPY.beforeCovid}</div>
              <div className="dashboard-metric-value">{formatMetric(preCovidValue)}</div>
              <div className="dashboard-metric-footnote">Monthly average</div>
            </div>
            <div className="dashboard-metric-card">
              <div className="dashboard-metric-label">{APP_COPY.afterCovid}</div>
              <div className="dashboard-metric-value">{formatMetric(postCovidValue)}</div>
              <div className="dashboard-metric-footnote">Monthly average</div>
            </div>
            <div className="dashboard-metric-card col-span-2 md:col-span-1">
              <div className="dashboard-metric-label">Change</div>
              <div className={`dashboard-metric-value ${deltaAccent.text}`}>{formatDelta(pctChangeValue)}</div>
              <div className="dashboard-metric-footnote">{APP_COPY.changeVsBeforeCovid}</div>
            </div>
          </div>
        </section>
      </>
    );
  };

  const renderPanelContent = () => (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="relative px-5 pb-2.5 pt-3">
        <div className="relative">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-[color:rgba(150,190,230,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <img src="/park-visitation-logo.png" alt="Park Visitations logo" className="h-7 w-7 object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] md:text-[1.6rem]">
                {APP_COPY.name}
              </div>
              <p className="mt-1 max-w-[28rem] text-xs leading-5 text-[var(--color-text-secondary)] md:text-[0.82rem]">
                {APP_COPY.tagline}
              </p>
            </div>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="View the source on GitHub"
              title="View source on GitHub"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:rgba(150,190,230,0.08)] bg-[color:rgba(150,190,230,0.04)] text-[var(--color-text-secondary)] transition-all hover:border-[color:rgba(150,190,230,0.18)] hover:bg-[color:rgba(150,190,230,0.08)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(150,190,230,0.24)]"
            >
              <Github className="h-[18px] w-[18px]" />
            </a>
          </div>

          <div className="mt-3">
            {renderSearchControls(false)}
          </div>
        </div>
      </div>

      <div className="dashboard-scroll flex-1 overflow-y-auto space-y-2.5 px-5 pb-3 pt-3">
        {renderInsightSections(false)}
      </div>

      <div className="px-5 py-2.5 text-[11px] text-[var(--color-text-tertiary)]">
        <div className="space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/psu_logo.png" alt="Penn State logo" className="h-5 w-5 object-contain" />
            <span className="truncate">{APP_COPY.footerAffiliation}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMobileDrawerContent = () => (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className="flex flex-col items-center gap-2 px-5 pb-3 pt-3 touch-none select-none"
        onPointerCancel={handleSheetPointerEnd}
        onPointerDown={handleSheetPointerDown}
        onPointerMove={handleSheetPointerMove}
        onPointerUp={handleSheetPointerEnd}
      >
        <button
          className="flex h-7 w-24 items-center justify-center rounded-full bg-transparent text-transparent"
          onClick={handleSheetToggleClick}
          aria-label="Toggle location drawer"
          type="button"
        >
          <span className="h-1.5 w-16 rounded-full bg-[color:rgba(150,190,230,0.34)]" />
        </button>
      </div>

      <div className="dashboard-scroll flex-1 min-h-0 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-1 space-y-3">
        {renderMobileSearchControls()}
        {renderInsightSections(true)}
      </div>
    </div>
  );

  return (
    <div className="dashboard-shell relative h-[100dvh] w-full overflow-hidden text-[var(--color-text-primary)]">
      <div className="absolute inset-0">
        <Suspense
          fallback={(
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-[color:rgba(150,190,230,0.18)] bg-[radial-gradient(circle,rgba(150,190,230,0.16),transparent_70%)]">
                <img src="/park-visitation-logo.png" alt="Park Visitations logo" className="h-16 w-16 animate-pulse object-contain" />
                <Loader2 className="absolute -bottom-1 -right-1 h-8 w-8 animate-spin text-[var(--color-accent)]" />
              </div>
              <p className="font-display text-sm uppercase tracking-[0.36em] text-[var(--color-text-tertiary)]">
                {APP_COPY.mapLoading}
              </p>
            </div>
          )}
        >
          <InteractiveMap
            isMobile={isMobileViewport}
            onParkLayerChange={setParkLayer}
            onSelectedLocation={handleMapSelect}
            parkLayer={parkLayer}
            repoUrl={GITHUB_REPO_URL}
            selectedCoordinates={coords}
            selectedCountyFips={selectedCountyFips}
            selectedKind={selectedKind}
          />
        </Suspense>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 z-30 hidden w-[27rem] md:block">
        <div className="pointer-events-auto h-full w-full overflow-hidden border-r border-[color:rgba(150,190,230,0.08)] bg-[linear-gradient(180deg,rgba(5,18,33,0.96),rgba(4,14,28,0.92))] shadow-[0_12px_32px_rgba(0,8,22,0.28)] backdrop-blur-2xl">
          {renderPanelContent()}
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-40 md:hidden"
        style={{ height: `${mobileSheetHeight}px` }}
      >
        <div
          className={`pointer-events-auto relative h-full overflow-hidden rounded-t-[1.65rem] border-t border-[color:rgba(150,190,230,0.06)] bg-[linear-gradient(180deg,rgba(5,18,33,0.97),rgba(4,14,28,0.95))] shadow-[0_-16px_48px_rgba(0,8,22,0.32)] backdrop-blur-2xl ${mobileSheetOffset == null ? 'transition-transform duration-300 ease-out' : ''}`}
          style={{ transform: `translateY(${currentSheetOffset}px)` }}
        >
          {renderMobileDrawerContent()}
        </div>
      </div>
    </div>
  );
}

export default App;
