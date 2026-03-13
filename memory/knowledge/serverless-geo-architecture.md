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

## Gotchas
- **File Limits**: Production Vite builds heavily limit file chunk sizes. Code-splitting MapLibre and DuckDB binaries is often required.
- **DuckDB Typing**: Watch out for implicit JSON casts on text fields in Parquet resulting from mixed JSON schemas. Cast fields to `VARCHAR` in SQL queries.
