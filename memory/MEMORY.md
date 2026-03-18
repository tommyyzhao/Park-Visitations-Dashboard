# Core Axioms / The Hippocampus

## 1. Zero-Backend Architectures (Static Edge Data)
- **Constraint**: When possible, aggressively replace heavy infrastructure (MongoDB, Postgres, Express APIs) with static-edge technologies if the data is read-only and analytical.
- **Technologies**: Use DuckDB-WASM with Parquet files for complex SQL filtering and rapid aggregation in the browser. Use PMTiles for large-scale geographic data streaming (vector tiles) via HTTP Range Requests without a tile server.

## 2. DuckDB-WASM Data Type Inference
- **Axiom**: DuckDB-WASM automatically infers string JSON in Parquet structures as actual `JSON` types.
- **Resolution**: Always cast dynamically evaluated columns to `VARCHAR` (e.g., `LOWER(location::VARCHAR)`) to prevent Binder Errors when executing text searches. Furthermore, always sanitize JSON quotes from the raw string arrays returned by DuckDB row outputs using a `cleanRow` replacer.

## 3. Handling Unavailability of Data
- **Axiom**: When external data sources die or are put behind enterprise payloads (e.g. SafeGraph, Foursquare), and the explicit goal is a visually impressive "demo" or "rebuild", synthetic data generation is a valid protocol.
- **Resolution**: Utilize seeded PRNGs (Pseudo-Random Number Generators) bound to unique IDs (like place_ids) to synthesize deterministic, reproducible, and realistic data distributions for demonstration purposes when exact historical data is unavailable.

## 4. UI/Security in Map Rendering
- **Constraint**: Parquet or PMTile geographic attributes generated from unstructured external JSON are perpetually vulnerable vectors for Cross-Site Scripting (XSS).
- **Resolution**: Intercept and explicitly HTML-escape all string properties from map geographic features before injecting them into MapLibre popup `.setHTML()` template blocks. Use CSS prefixes like `.maplibregl-` properly to inherit standard DOM themes instead of `.mapboxgl-`.

## 5. React Lifecycle Integration with WebGL Maps
- **Constraint**: WebGL bridges like MapLibre and visualization libraries like Recharts are profoundly sensitive to changing object references in functional React components.
- **Resolution**: Strictly `useMemo` complex coordinate arrays or filtered metrics. Failure to stabilize arrays fed to map `useEffect` observers causes catastrophic re-renders and infinite `flyTo()` loop cascades. Strip event callbacks from dependency arrays and safely capture them using `useRef` to track state closures.
## 6. Analytical Data vs. Rendering Properties
- **Axiom**: Map rendering formats (Vector Tiles / PMTiles) optimized for size often strip or simplify complex time-series/nested JSON payloads to preserve performance.
- **Resolution**: Do not rely on map feature click properties for full analytical views. Instead, use the map selection event to extract a stable unique ID (e.g., `safegraph_place_id` or `county_fips`) and trigger a high-speed DuckDB "surgical" fetch against the source Parquet file to hydrate the UI with full telemetry.

## 7. Geographic Boundary Vintage Compatibility
- **Constraint**: Administrative boundary datasets are not timeless. Using the newest county/tract boundary vintage against older telemetry can silently break joins because FIPS and county-equivalent definitions change over time.
- **Resolution**: Treat geographic boundary vintages as schema dependencies. Zero-pad stable IDs like county FIPS before joins, select a boundary vintage that matches the telemetry era, and fail the build when telemetry IDs do not match boundary geometry.

## 8. Hybrid Desktop Hover Detection
- **Constraint**: Browser hover media queries can under-report hover support on desktop-class or hybrid-input hardware.
- **Resolution**: For desktop-only previews, use a broader capability fallback (`any-hover`, `pointer: fine`, or no-touch detection) instead of relying solely on `(hover: hover) and (pointer: fine)`.
