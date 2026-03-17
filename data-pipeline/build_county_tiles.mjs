import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TELEMETRY_PATH = path.resolve(__dirname, '../archive/dashboard/src/data/patterns_by_county.json');
const OUTPUT_PM_TILES = path.resolve(__dirname, 'county_change.pmtiles');
const PUBLIC_PM_TILES = path.resolve(__dirname, '../dashboard-rebuild/public/data/county_change.pmtiles');
const COUNTY_LAYER_NAME = 'county_change';
// The telemetry dataset uses legacy county-equivalent FIPS codes, so we intentionally
// match it against the 2018 Census generalized county boundaries rather than newer vintages.
const COUNTY_BOUNDARY_URL = 'https://www2.census.gov/geo/tiger/GENZ2018/shp/cb_2018_us_county_500k.zip';
const COVID_START = new Date('2020-02-28');

function normalizeCountyFips(value) {
  if (value == null || value === '') return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(5, '0');
}

function isDateKey(key) {
  return /^\d{4}\.\d{2}\.\d{2}$/.test(key) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(key);
}

function computeCountyMetrics(row) {
  const preValues = [];
  const postValues = [];

  for (const [key, value] of Object.entries(row)) {
    if (!isDateKey(key)) continue;

    const normalizedKey = key.replace(/\./g, '-');
    const parsedDate = new Date(normalizedKey);
    const numericValue = Number(value);

    if (Number.isNaN(parsedDate.valueOf()) || Number.isNaN(numericValue) || numericValue <= 0) {
      continue;
    }

    if (parsedDate < COVID_START) {
      preValues.push(numericValue);
    } else {
      postValues.push(numericValue);
    }
  }

  const preAvg = preValues.length > 0
    ? preValues.reduce((sum, value) => sum + value, 0) / preValues.length
    : null;
  const postAvg = postValues.length > 0
    ? postValues.reduce((sum, value) => sum + value, 0) / postValues.length
    : null;
  const percentChange = preAvg != null && postAvg != null && preAvg !== 0
    ? (postAvg - preAvg) / preAvg
    : null;

  return {
    visitor_counts_precovid: preAvg,
    visitor_counts_postcovid: postAvg,
    percent_change: percentChange,
  };
}

function loadTelemetryByCounty() {
  const rows = JSON.parse(fs.readFileSync(TELEMETRY_PATH, 'utf8'));
  const telemetryByCounty = new Map();

  for (const row of rows) {
    const countyFips = normalizeCountyFips(row.county_fips);
    if (!countyFips) continue;

    telemetryByCounty.set(countyFips, {
      county_fips: countyFips,
      county: row.county_ascii ?? row.county ?? null,
      county_ascii: row.county_ascii ?? row.county ?? null,
      state_name: row.state_name ?? null,
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      population: row.population != null ? Number(row.population) : null,
      has_data: 1,
      ...computeCountyMetrics(row),
    });
  }

  return telemetryByCounty;
}

function downloadBoundaryZip(zipPath) {
  console.log(`Downloading county boundaries from ${COUNTY_BOUNDARY_URL}...`);
  execFileSync('curl', ['-L', COUNTY_BOUNDARY_URL, '-o', zipPath], { stdio: 'inherit' });
}

function convertBoundaryZipToGeoJson(zipPath, outputPath) {
  console.log('Converting county boundary shapefile to GeoJSON...');
  execFileSync(
    'npx',
    ['--yes', 'mapshaper', '-i', zipPath, '-o', 'format=geojson', outputPath],
    { stdio: 'inherit' }
  );
}

function buildMergedCountyGeoJson(boundaryGeoJsonPath, outputGeoJsonPath, telemetryByCounty) {
  console.log('Joining county polygons with visitation telemetry...');

  const boundaryGeoJson = JSON.parse(fs.readFileSync(boundaryGeoJsonPath, 'utf8'));
  const matchedTelemetryFips = new Set();

  const features = boundaryGeoJson.features.map((feature) => {
    const properties = feature.properties ?? {};
    const countyFips = normalizeCountyFips(properties.GEOID ?? `${properties.STATEFP ?? ''}${properties.COUNTYFP ?? ''}`);
    const telemetry = countyFips ? telemetryByCounty.get(countyFips) : null;

    if (telemetry && countyFips) {
      matchedTelemetryFips.add(countyFips);
    }

    return {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        county_fips: countyFips,
        county: telemetry?.county ?? properties.NAME ?? properties.NAMELSAD ?? null,
        county_ascii: telemetry?.county_ascii ?? properties.NAME ?? null,
        state_name: telemetry?.state_name ?? null,
        has_data: telemetry?.has_data ?? 0,
        visitor_counts_precovid: telemetry?.visitor_counts_precovid ?? null,
        visitor_counts_postcovid: telemetry?.visitor_counts_postcovid ?? null,
        percent_change: telemetry?.percent_change ?? null,
        lat: telemetry?.lat ?? null,
        lng: telemetry?.lng ?? null,
        population: telemetry?.population ?? null,
      },
    };
  });

  const missingTelemetry = [...telemetryByCounty.keys()]
    .filter((countyFips) => !matchedTelemetryFips.has(countyFips));

  if (missingTelemetry.length > 0) {
    const sample = missingTelemetry.slice(0, 10).join(', ');
    throw new Error(`Missing county polygons for ${missingTelemetry.length} telemetry counties. Sample FIPS: ${sample}`);
  }

  fs.writeFileSync(outputGeoJsonPath, JSON.stringify({
    type: 'FeatureCollection',
    features,
  }));
}

function buildPmTiles(geoJsonPath) {
  console.log('Building county polygon PMTiles...');
  execFileSync(
    'tippecanoe',
    [
      '-f',
      '-o', OUTPUT_PM_TILES,
      '-l', COUNTY_LAYER_NAME,
      '-zg',
      '--drop-densest-as-needed',
      '--extend-zooms-if-still-dropping',
      geoJsonPath,
    ],
    { stdio: 'inherit' }
  );
}

function main() {
  const telemetryByCounty = loadTelemetryByCounty();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'county-choropleth-'));
  const boundaryZipPath = path.join(tempDir, 'cb_2024_us_county_500k.zip');
  const boundaryGeoJsonPath = path.join(tempDir, 'cb_2024_us_county_500k.geojson');
  const mergedCountyGeoJsonPath = path.join(tempDir, 'county_change_polygons.geojson');

  downloadBoundaryZip(boundaryZipPath);
  convertBoundaryZipToGeoJson(boundaryZipPath, boundaryGeoJsonPath);
  buildMergedCountyGeoJson(boundaryGeoJsonPath, mergedCountyGeoJsonPath, telemetryByCounty);
  buildPmTiles(mergedCountyGeoJsonPath);

  fs.mkdirSync(path.dirname(PUBLIC_PM_TILES), { recursive: true });
  fs.copyFileSync(OUTPUT_PM_TILES, PUBLIC_PM_TILES);

  console.log(`County PMTiles written to ${OUTPUT_PM_TILES}`);
  console.log(`Copied county PMTiles to ${PUBLIC_PM_TILES}`);
  console.log(`Joined telemetry counties: ${telemetryByCounty.size}`);
}

main();
