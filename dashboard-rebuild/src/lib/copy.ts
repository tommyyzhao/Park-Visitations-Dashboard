export const APP_COPY = {
  name: 'Park Visitations',
  tagline: 'Visitation trends across parks and counties before and after COVID-19.',
  parkTab: 'Parks',
  countyTab: 'Counties',
  searchHeading: 'Search locations',
  searchHelp: 'Find a park or county to view monthly visitation trends.',
  parkSearchPlaceholder: 'Search parks, such as Yellowstone or Central Park',
  countySearchPlaceholder: 'Search counties, such as Los Angeles or Cook',
  selectLocationKicker: 'Select a location',
  chooseLocationKicker: 'Choose a location',
  desktopHeadline: 'View park and county visitation trends.',
  mobileHeadline: 'Tap the map or search for a location.',
  desktopBody: 'Search for a park or county, or tap the map to open its monthly trend.',
  mobileBody: 'Select a park or county to view its monthly trend and summary.',
  dataLoading: 'Loading data...',
  mapLoading: 'Loading map...',
  monthlyVisits: 'Monthly visits',
  summary: 'Summary',
  beforeCovid: 'Before COVID-19',
  afterCovid: 'After COVID-19',
  changeVsBeforeCovid: 'Change vs. before COVID-19',
  timeline: 'Timeline',
  beforeAfter: 'Before / After',
  beforeAfterByMonth: 'Before and after COVID-19 by month',
  footerAffiliation: 'Penn State Recreation, Park, and Tourism Management',
} as const;

export const HOVER_COPY = {
  before: 'Before',
  after: 'After',
  delta: 'Change',
  aboveBaseline: 'Above baseline',
  belowBaseline: 'Below baseline',
  atBaseline: 'At baseline',
  estimatedTrend: 'Estimated trend',
  unavailable: 'Unavailable',
  noData: 'No visitation data available',
} as const;

export const MAP_COPY = {
  allParks: 'All parks',
  nationalParks: 'National parks',
  stateParks: 'State parks',
  legendTitle: 'Average monthly visitation change',
  belowBaseline: 'Below baseline',
  atBaseline: 'At baseline',
  aboveBaseline: 'Above baseline',
  legendNote: 'County shading shows average monthly change; park dots mark visitation sites.',
  legendButton: 'Legend',
} as const;

export const CHART_COPY = {
  noDataTitle: 'No visitation data available',
  noDataBody: 'This location does not have a monthly visitation series in the dataset.',
  overlayBefore: 'Before COVID-19',
  overlayAfter: 'After COVID-19',
  monthlyTrend: 'Monthly trend',
} as const;
