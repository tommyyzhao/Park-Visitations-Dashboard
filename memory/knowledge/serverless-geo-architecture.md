# Serverless Geo-Architecture (Static Edge)

## Overview
Replacing the traditional MERN stack (MongoDB + Express + React + Mapbox) for analytical mapping applications with an entirely static architecture.

## Core Components
- **Data Storage**: `.parquet` for tabular data, `.pmtiles` for geographic data. Both hosted statically on CDNs/S3.
- **Query Engine**: DuckDB-WASM executes SQL directly inside the client's browser, pulling only necessary chunks of Parquet files via HTTP Range Requests.
- **Map Engine**: MapLibre GL JS (open-source Mapbox alternative) loading PMTiles natively.
- **Data Processing (Tippecanoe)**: Tippecanoe is essential for transforming dense TopoJSON/GeoJSON files into optimized vector PMTiles. It dynamically clusters, filters, and scales geometries across zoom levels (`-zg --drop-densest-as-needed`).

## Practical Implementation Pipeline
1. **Raw to Parquet**: Use local DuckDB CLI or script to copy JSON/CSV to Parquet: `COPY (SELECT * FROM read_json_auto('data.json')) TO 'data.parquet' (FORMAT PARQUET)`.
2. **Raw to PMTiles**: Use tippecanoe: `tippecanoe -o data.pmtiles -zg --drop-densest-as-needed data.geojson`.
3. **Frontend Integration**:
    - Instantiate DuckDB worker threads in React (`@duckdb/duckdb-wasm`).
    - Register the `.parquet` file URL to DuckDB virtual file system.
    - Query locally using standard SQL.
    - Add `.pmtiles` protocol to MapLibre.
20. **Vite Build Optimization**:
    - Large WASM/WebGL binaries (`@duckdb/duckdb-wasm`, `maplibre-gl`) exceed standard 500kb limits.
    - Use `rollupOptions.manualChunks` in `vite.config.ts` to isolate these into stable, vendor-branded chunks for better caching and warning suppression.

## Gotchas
- **File Limits**: Production Vite builds heavily limit file chunk sizes. Code-splitting MapLibre and DuckDB binaries is often required.
- **DuckDB Typing**: Watch out for implicit JSON casts on text fields in Parquet resulting from mixed JSON schemas. Cast fields to `VARCHAR` in SQL queries.
- **Popup XSS Injections**: DuckDB and MapLibre inherently decouple data models from front-end safety. Data parsed from unstructured `.parquet` files and displayed via `.setHTML()` natively opens dangerous XSS vectors. Hand-built string escapers are mandatory prior to template insertion.
- **Map Instance Re-renders (React)**: React components instantiating imperative classes (`new maplibregl.Map()`) will break if passed un-memoized nested arrays or objects. Event parameters (like coordinates) bound to `useEffect` arrays must be strictly memoized using `useMemo` to prevent infinite imperative map transitions on benign re-renders (like user typing).
- **Hybrid Telemetry Fetch (PMTiles -> Parquet)**: Vector tiles (.pmtiles) should only carry rendering attributes (color, size, name). For deep analysis (time-series graphs), use the map click event as a "pointer" to trigger a precision `SELECT * FROM ... WHERE id = ...` query against the local DuckDB instance. This keeps the initial map payloads lightweight while maintaining full analytical depth.
