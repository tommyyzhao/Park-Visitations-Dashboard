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

## Boundary Joins
- **Boundary Vintage Matching**: County and tract boundaries must match the era of the telemetry IDs. Newer Census vintages can invalidate older county-equivalent FIPS (for example, Connecticut county removal and Alaska county-equivalent changes), so build pipelines should choose the matching historical vintage rather than assuming "latest" is correct.
- **ID Normalization**: Normalize geographic identifiers like county FIPS to zero-padded strings before any join, PMTiles property write, or React selection state. This prevents mismatches between numeric Parquet values and string tile properties.
- **Fail Loudly**: Boundary join pipelines should fail when telemetry IDs do not map to geometry instead of silently dropping regions. Missing geography is much harder to notice later in a choropleth than a hard build failure.

## Overlay Interaction Patterns
- **Layer Order Matters**: In MapLibre, later-added layers render on top. If polygon choropleths are meant to sit behind point POIs, add polygons first and point layers later.
- **Single Click Resolver**: Once multiple interactive layers overlap, do not rely on separate per-layer click handlers. Resolve clicks with one `queryRenderedFeatures()` pass and explicit precedence order so foreground targets win deterministically.
- **Soft Glow Approximation**: Native MapLibre fill layers do not provide a true per-polygon radial gradient. The practical approximation is a translucent fill plus one or more blurred line halos derived from the same data ramp.

## React / MapLibre Runtime Notes
- **Stable Map Mount**: Do not place layer-visibility props in the effect that constructs or destroys a `maplibregl.Map` instance. Mount once, then update visibility and filters in separate effects so camera state survives UI toggles.
- **Camera Persistence**: Keep `center`, `zoom`, `bearing`, and `pitch` in refs when the UI can rehydrate the map. Restore from those refs on load/reload instead of re-reading default coordinates.
- **Buffered PMTiles**: For static PMTiles archives that are queried repeatedly, a buffered `Source` wrapper can fetch the archive once, cache the ArrayBuffer, and serve byte slices back to the PMTiles protocol. This avoids repeat network reads when surfaces are toggled often but data does not change.

## PMTiles Hosting Failure Mode
- **Observed Failure**: Some static hosts return the full archive with `HTTP 200` instead of honoring `Range` requests for `.pmtiles`, which causes the PMTiles client to throw before any map layers render.
- **Practical Fix**: When a host cannot provide byte serving, use a buffered client-side protocol wrapper or move the archive to storage that returns correct partial-content responses.
- **Verification Clue**: A failing PMTiles host often surfaces as a console error about missing `content-length` or request size exceeding the server response, even though the file itself is reachable by URL.

## CI / Pages Deploy Gotcha
- **GitHub Actions Working Directory Trap**: `defaults.run.working-directory` affects only `run:` steps. It does not change the working directory for `uses:` actions such as `cloudflare/wrangler-action`.
- **Practical Consequence**: A workflow can build inside a subdirectory successfully and then fail deployment by passing a relative artifact path that only exists inside that subdirectory.
- **Operational Fix**: For Cloudflare Pages direct-upload workflows, pass the explicit repo-root-relative artifact path to wrangler (for example `dashboard-rebuild/dist`) and emit wrangler stdout/stderr as explicit follow-up log steps so failures are diagnosable from CI output.
- **Monorepo Throughput Rule**: In repos where the deployable app is a tiny subdirectory and most tracked files are unrelated data or pipelines, sparse checkout and path-filtered triggers usually dominate package-manager tweaks. Optimize fetch scope before chasing install-time micro-optimizations.
- **Wrapper vs Direct CLI**: Convenience actions are not always the fastest path. For Cloudflare Pages, a pinned local `wrangler` invoked directly from the app directory can be both simpler and faster than `wrangler-action`, while keeping behavior explicit and benchmarkable.
