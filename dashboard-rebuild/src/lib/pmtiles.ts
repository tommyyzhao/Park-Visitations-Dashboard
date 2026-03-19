import { PMTiles, Protocol, type Source } from 'pmtiles';

export interface BufferedPmtilesAsset {
  key: string;
  url: string;
}

class BufferedPmtilesSource implements Source {
  private buffer: ArrayBuffer | null = null;
  private bufferPromise: Promise<ArrayBuffer> | null = null;

  constructor(
    private readonly key: string,
    private readonly url: string,
  ) {}

  getKey() {
    return this.key;
  }

  private async loadBuffer(signal?: AbortSignal): Promise<ArrayBuffer> {
    if (this.buffer) {
      return this.buffer;
    }

    if (!this.bufferPromise) {
      console.info('[map] loading PMTiles asset', { key: this.key, url: this.url });

      this.bufferPromise = fetch(this.url, { signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load PMTiles asset ${this.url}: HTTP ${response.status}`);
          }

          return response.arrayBuffer();
        })
        .then((buffer) => {
          this.buffer = buffer;
          console.info('[map] cached PMTiles asset', { key: this.key, bytes: buffer.byteLength });
          return buffer;
        })
        .catch((error) => {
          this.bufferPromise = null;
          throw error;
        });
    }

    return this.bufferPromise;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    _etag?: string,
  ): Promise<{ data: ArrayBuffer }> {
    const buffer = await this.loadBuffer(signal);
    return { data: buffer.slice(offset, offset + length) };
  }
}

export function createBufferedPmtilesProtocol(assets: BufferedPmtilesAsset[]) {
  const protocol = new Protocol();

  assets.forEach(({ key, url }) => {
    protocol.add(new PMTiles(new BufferedPmtilesSource(key, url)));
    console.info('[map] registered buffered PMTiles archive', { key, url });
  });

  return protocol;
}

export function resolvePmtilesAssetUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, window.location.origin).href;
}
