# Mobility Data Landscape (As of 2026)

## State of the Industry
The era of openly accessible, massive researcher-tier mobility datasets (like the COVID-19 SafeGraph consortium) has ended. The industry has consolidated into strictly gated, enterprise-paid models for true foot-traffic and visit visitation data.

## Key Players (Enterprise / Paid)
- **Placer.ai**: Current market leader for venue visitations and trade-areas. Strict enterprise models. Offers basic dashboards on a free tier format.
- **Veraset**: Spun out of SafeGraph, offers raw GPS pings and visit counts. Limited evaluation samples available.
- **Foursquare (Places & Visits)**: Aggregated via mobile SDKs, highly gated.

## Free & Open-Source Solutions
If the goal is purely Point-of-Interest (POI) boundaries, metadata, and mapping (without foot traffic/visitation attributes), significant open resources exist:
- **Overture Maps Foundation**: A massive, open-source POI and base-map dataset backed by Meta, Amazon, Microsoft, and TomTom. Comprehensive global POIs accessible via S3 bucket dumps.
- **OpenStreetMap (OSM) / Overpass**: Best for real-time community-sourced geometries and specific bounding box queries.

## Workarounds for Portfolio/Demo Apps
When building dashboards where visitation data is required but unavailable:
1. Synthesize seeded, deterministic data based on base metadata (e.g. National Parks receive x100 traffic volume relative to State Parks).
2. Randomize growth/decline patterns using seeded PRNG algorithms (based on unique POI IDs) to simulate realistic visual gradients (e.g. chloropleth divergence).
