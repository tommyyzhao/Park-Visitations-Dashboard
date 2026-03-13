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
