import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initializationPromise: Promise<duckdb.AsyncDuckDB> | null = null;
let filesRegistered = false;

export async function initDB(): Promise<duckdb.AsyncDuckDB> {
  if (db && filesRegistered) return db;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    const duckDB = new duckdb.AsyncDuckDB(logger, worker);
    await duckDB.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    db = duckDB;
    conn = await db.connect();

    // Register all parquet files from HTTP so DuckDB can query them
    const files = ['park_pois.parquet', 'poi_idname.parquet', 'patterns_by_county.parquet'];
    for (const file of files) {
      const url = `${window.location.origin}/data/${file}`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
        const buffer = await response.arrayBuffer();
        await db.registerFileBuffer(file, new Uint8Array(buffer));
        console.log(`Registered ${file} (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
      } catch (err) {
        console.error(`Failed to register ${file}:`, err);
      }
    }
    filesRegistered = true;

    console.log('DuckDB initialized with all data files!');
    return db;
  })();

  return initializationPromise;
}

async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (!conn) {
    await initDB();
  }
  return conn!;
}

// DuckDB-WASM sometimes returns JSON-typed strings with extra quotes
function cleanRow(row: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string') {
      // Strip surrounding double-quotes from JSON values
      cleaned[key] = value.replace(/^"|"$/g, '');
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function queryParks(searchTerm: string): Promise<any[]> {
  const c = await getConnection();

  const result = await c.query(`
    SELECT *
    FROM read_parquet('park_pois.parquet')
    WHERE LOWER(location_name::VARCHAR) LIKE LOWER('%${searchTerm.replace(/'/g, "''")}%')
       OR LOWER(name_location::VARCHAR) LIKE LOWER('%${searchTerm.replace(/'/g, "''")}%')
    LIMIT 20
  `);

  return result.toArray().map(row => cleanRow(row.toJSON()));
}

export async function queryCounties(searchTerm: string): Promise<any[]> {
  const c = await getConnection();

  const result = await c.query(`
    SELECT *
    FROM read_parquet('patterns_by_county.parquet')
    WHERE LOWER(county_ascii::VARCHAR) LIKE LOWER('%${searchTerm.replace(/'/g, "''")}%')
       OR LOWER(state_name::VARCHAR) LIKE LOWER('%${searchTerm.replace(/'/g, "''")}%')
    LIMIT 20
  `);

  return result.toArray().map(row => cleanRow(row.toJSON()));
}
