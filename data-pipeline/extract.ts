import mongoose from 'mongoose';
import duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';

const ATLAS_URI = 'mongodb+srv://park:visitations@parkvisitations.mgpda.mongodb.net/ParkVisitations?retryWrites=true&w=majority';

// Fixed db path for ESM
const dbPath = './dashboard.sqlite';
const db = new duckdb.Database(dbPath);

async function convertJSONToParquet(jsonFile: string, parquetFile: string) {
    console.log(`Converting ${jsonFile} to ${parquetFile}...`);
    return new Promise((resolve, reject) => {
        db.all(`COPY (SELECT * FROM read_json_auto('${jsonFile}', sample_size=-1, ignore_errors=true)) TO '${parquetFile}' (FORMAT PARQUET);`, (err: any) => {
            if (err) reject(err);
            else resolve(null);
        });
    });
}

async function main() {
    console.log('Starting Parquet conversions for local data files...');

    // Convert local JSONs
    await convertJSONToParquet('all_parks_rich.json', 'park_pois.parquet');
    await convertJSONToParquet('../archive/dashboard/src/data/poi_idname_only_compact.json', 'poi_idname.parquet');
    await convertJSONToParquet('../archive/dashboard/src/data/patterns_by_county.json', 'patterns_by_county.parquet');

    console.log('Done mapping to Parquet!');
    process.exit(0);
}

main().catch(console.error);
