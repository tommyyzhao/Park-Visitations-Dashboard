import { normalizeCountyFips } from './county';
import { HOVER_COPY } from './copy';

const COVID_START = new Date('2020-02-28');
const SYNTHETIC_TREND_START = new Date('2018-01-01');
const SYNTHETIC_TREND_END = new Date('2021-02-01');

const STATE_NAMES_BY_FIPS: Record<string, string> = {
  '01': 'Alabama',
  '02': 'Alaska',
  '04': 'Arizona',
  '05': 'Arkansas',
  '06': 'California',
  '08': 'Colorado',
  '09': 'Connecticut',
  '10': 'Delaware',
  '11': 'District of Columbia',
  '12': 'Florida',
  '13': 'Georgia',
  '15': 'Hawaii',
  '16': 'Idaho',
  '17': 'Illinois',
  '18': 'Indiana',
  '19': 'Iowa',
  '20': 'Kansas',
  '21': 'Kentucky',
  '22': 'Louisiana',
  '23': 'Maine',
  '24': 'Maryland',
  '25': 'Massachusetts',
  '26': 'Michigan',
  '27': 'Minnesota',
  '28': 'Mississippi',
  '29': 'Missouri',
  '30': 'Montana',
  '31': 'Nebraska',
  '32': 'Nevada',
  '33': 'New Hampshire',
  '34': 'New Jersey',
  '35': 'New Mexico',
  '36': 'New York',
  '37': 'North Carolina',
  '38': 'North Dakota',
  '39': 'Ohio',
  '40': 'Oklahoma',
  '41': 'Oregon',
  '42': 'Pennsylvania',
  '44': 'Rhode Island',
  '45': 'South Carolina',
  '46': 'South Dakota',
  '47': 'Tennessee',
  '48': 'Texas',
  '49': 'Utah',
  '50': 'Vermont',
  '51': 'Virginia',
  '53': 'Washington',
  '54': 'West Virginia',
  '55': 'Wisconsin',
  '56': 'Wyoming',
  '60': 'American Samoa',
  '66': 'Guam',
  '69': 'Northern Mariana Islands',
  '72': 'Puerto Rico',
  '78': 'U.S. Virgin Islands',
};

export type HoverPreviewKind = 'park' | 'county';
export type HoverTrendMode = 'modeled' | 'real' | 'none';

export interface TrendPoint {
  date: string;
  value: number;
}

export interface HoverPreviewData {
  kind: HoverPreviewKind;
  featureKey: string;
  title: string;
  subtitle: string;
  status: string | null;
  pre: number | null;
  post: number | null;
  delta: number | null;
  trendPoints: TrendPoint[];
  trendMode: HoverTrendMode;
}

interface HoverFeatureInput {
  kind: HoverPreviewKind;
  props: Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function asMetric(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(', ');
}

function hasSummaryMetrics(pre: number | null, post: number | null, delta: number | null) {
  return pre != null || post != null || delta != null;
}

function isDateKey(key: string) {
  return /^\d{4}\.\d{2}\.\d{2}$/.test(key) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(key);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: string) {
  const hash = hashString(seed);
  return (hash % 1000000) / 1000000;
}

function normalizeSeriesAverage(values: number[], targetAverage: number | null) {
  if (targetAverage == null || values.length === 0) return values;

  const currentAverage = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!Number.isFinite(currentAverage) || currentAverage <= 0) {
    return values;
  }

  const scale = targetAverage / currentAverage;
  return values.map((value) => Math.max(0, value * scale));
}

function generateMonthlyDates() {
  const dates: Date[] = [];
  const cursor = new Date(SYNTHETIC_TREND_START);

  while (cursor <= SYNTHETIC_TREND_END) {
    dates.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return dates;
}

export function getStateNameFromCountyFips(value: unknown): string | null {
  const normalized = normalizeCountyFips(value);
  if (!normalized) return null;
  return STATE_NAMES_BY_FIPS[normalized.slice(0, 2)] ?? null;
}

function getParkSubtitle(props: Record<string, unknown>) {
  const locationLabel = joinParts([
    asNonEmptyString(props.city),
    asNonEmptyString(props.region),
  ]);

  if (locationLabel) return locationLabel;

  if (asMetric(props.national) === 1) return 'National park';
  if (asMetric(props.state) === 1) return 'State park';
  return 'Local park';
}

function getCountySubtitle(props: Record<string, unknown>) {
  const stateName = asNonEmptyString(props.state_name) ?? getStateNameFromCountyFips(props.county_fips);
  if (stateName) return stateName;

  return '';
}

export function getHoverFeatureKey(kind: HoverPreviewKind, props: Record<string, unknown>) {
  if (kind === 'park') {
    const safegraphPlaceId = asNonEmptyString(props.safegraph_place_id);
    if (safegraphPlaceId) return `park:${safegraphPlaceId}`;

    return `park:${joinParts([
      asNonEmptyString(props.location),
      asNonEmptyString(props.location_name),
      asNonEmptyString(props.region),
    ]) || 'unknown'}`;
  }

  const countyFips = normalizeCountyFips(props.county_fips);
  if (countyFips) return `county:${countyFips}`;

  return `county:${joinParts([
    asNonEmptyString(props.county_ascii),
    asNonEmptyString(props.county),
    getCountySubtitle(props),
  ]) || 'unknown'}`;
}

export function extractCountyTrend(row: Record<string, unknown>): TrendPoint[] {
  const points = Object.entries(row)
    .flatMap(([key, value]) => {
      if (!isDateKey(key)) return [];

      const normalizedKey = key.replace(/\./g, '-');
      const parsedDate = new Date(normalizedKey);
      const numericValue = Number(value);

      if (Number.isNaN(parsedDate.valueOf()) || Number.isNaN(numericValue) || numericValue <= 0) {
        return [];
      }

      return [{ date: monthKey(parsedDate), value: numericValue }];
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return points;
}

export function synthesizeParkTrend(props: Record<string, unknown>): TrendPoint[] {
  const safegraphPlaceId = asNonEmptyString(props.safegraph_place_id) ?? 'park';
  const pre = asMetric(props.visitor_counts_precovid);
  const post = asMetric(props.visitor_counts_postcovid);

  if (pre == null && post == null) {
    return [];
  }

  const monthlyDates = generateMonthlyDates();
  const preSeries: number[] = [];
  const postSeries: number[] = [];
  const seasonPhase = seededUnit(`${safegraphPlaceId}:phase`) * Math.PI * 2;
  const volatility = 0.05 + seededUnit(`${safegraphPlaceId}:volatility`) * 0.08;
  const slopeDirection = (seededUnit(`${safegraphPlaceId}:slope`) - 0.5) * 0.18;
  const bias = clamp(asMetric(props.percent_change) ?? 0, -1, 1) * 0.12;

  monthlyDates.forEach((date, index) => {
    const isPreCovid = date < COVID_START;
    const seasonality = 1 + Math.sin((date.getMonth() / 12) * Math.PI * 2 + seasonPhase) * 0.14;
    const localNoise = 1 + (seededUnit(`${safegraphPlaceId}:${date.toISOString()}`) - 0.5) * volatility;
    const slopeOffset = 1 + ((index / Math.max(1, monthlyDates.length - 1)) - 0.5) * slopeDirection;
    const postOffset = isPreCovid ? 1 : 1 + bias;
    const baseline = isPreCovid ? (pre ?? post ?? 1) : (post ?? pre ?? 1);
    const value = Math.max(1, baseline * seasonality * localNoise * slopeOffset * postOffset);

    if (isPreCovid) {
      preSeries.push(value);
    } else {
      postSeries.push(value);
    }
  });

  const normalizedPre = normalizeSeriesAverage(preSeries, pre ?? post ?? null);
  const normalizedPost = normalizeSeriesAverage(postSeries, post ?? pre ?? null);
  const normalizedValues = [...normalizedPre, ...normalizedPost];

  return monthlyDates.map((date, index) => ({
    date: monthKey(date),
    value: Number(normalizedValues[index].toFixed(2)),
  }));
}

function buildParkPreview(props: Record<string, unknown>): HoverPreviewData {
  const pre = asMetric(props.visitor_counts_precovid);
  const post = asMetric(props.visitor_counts_postcovid);
  const delta = asMetric(props.percent_change);
  const trendPoints = synthesizeParkTrend(props);
  const hasTrend = trendPoints.length > 0;

  return {
    kind: 'park',
    featureKey: getHoverFeatureKey('park', props),
    title: asNonEmptyString(props.location) ?? asNonEmptyString(props.location_name) ?? 'Unknown Park',
    subtitle: getParkSubtitle(props),
    status: hasTrend ? HOVER_COPY.estimatedTrend : HOVER_COPY.unavailable,
    pre,
    post,
    delta,
    trendPoints,
    trendMode: hasTrend ? 'modeled' : 'none',
  };
}

function buildCountyPreview(props: Record<string, unknown>): HoverPreviewData {
  const pre = asMetric(props.visitor_counts_precovid);
  const post = asMetric(props.visitor_counts_postcovid);
  const delta = asMetric(props.percent_change);
  const hasMetrics = hasSummaryMetrics(pre, post, delta);

  return {
    kind: 'county',
    featureKey: getHoverFeatureKey('county', props),
    title: asNonEmptyString(props.county_ascii) ?? asNonEmptyString(props.county) ?? 'Unknown County',
    subtitle: getCountySubtitle(props),
    status: hasMetrics ? null : HOVER_COPY.unavailable,
    pre,
    post,
    delta,
    trendPoints: [],
    trendMode: hasMetrics ? 'real' : 'none',
  };
}

export function hydrateCountyPreview(
  props: Record<string, unknown>,
  row: Record<string, unknown> | null,
): HoverPreviewData {
  if (!row) {
    const emptyPreview = buildCountyPreview(props);
    return {
      ...emptyPreview,
      status: HOVER_COPY.unavailable,
      trendMode: 'none' as HoverTrendMode,
      trendPoints: [],
    };
  }

  const baseProps = { ...props, ...row };
  const pre = asMetric(baseProps.visitor_counts_precovid);
  const post = asMetric(baseProps.visitor_counts_postcovid);
  const delta = asMetric(baseProps.percent_change);
  const trendPoints = extractCountyTrend(baseProps);
  const hasTrend = trendPoints.length > 0;
  const hasMetrics = hasSummaryMetrics(pre, post, delta);

  return {
    kind: 'county' as HoverPreviewKind,
    featureKey: getHoverFeatureKey('county', baseProps),
    title: asNonEmptyString(baseProps.county_ascii) ?? asNonEmptyString(baseProps.county) ?? 'Unknown County',
    subtitle: getCountySubtitle(baseProps),
    status: hasTrend || hasMetrics ? null : HOVER_COPY.unavailable,
    pre,
    post,
    delta,
    trendPoints,
    trendMode: hasTrend ? 'real' : 'none',
  };
}

export function resolveHoverPreview({ kind, props }: HoverFeatureInput): HoverPreviewData {
  return kind === 'park' ? buildParkPreview(props) : buildCountyPreview(props);
}
