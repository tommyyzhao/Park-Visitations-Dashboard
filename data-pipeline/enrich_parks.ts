import * as fs from 'fs';

console.log('Reading data files...');
const parkPois = JSON.parse(fs.readFileSync('../archive/dashboard/src/data/park_pois.json', 'utf8'));
const labeledChange = JSON.parse(fs.readFileSync('../archive/dashboard/src/data/labeled_change.geojson', 'utf8'));

console.log('Mapping visitation stats...');
const statsMap = new Map();
for (const feature of labeledChange.features) {
    statsMap.set(feature.properties.safegraph_place_id, {
        visitor_counts_precovid: feature.properties.visitor_counts_precovid,
        visitor_counts_postcovid: feature.properties.visitor_counts_postcovid,
        percent_change: feature.properties.percent_change,
    });
}

console.log('Enriching park POIs...');
const enrichedParks = parkPois.map((p: any) => {
    const stats = statsMap.get(p.safegraph_place_id) || {};
    return { ...p, ...stats };
});

console.log('Writing enriched_parks.json...');
fs.writeFileSync('enriched_parks.json', JSON.stringify(enrichedParks));
console.log('Done!');
