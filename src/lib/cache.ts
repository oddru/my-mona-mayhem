export type CacheValue<T> = {
	value: T;
	expiresAt: number; // epoch ms
	updatedAt: number; // epoch ms
};

export class SimpleCache<T> {
	private map: Map<string, CacheValue<T>> = new Map();
	private ttlMs: number;
	private maxEntries: number;

	constructor(ttlSeconds = 300, maxEntries = 1000) {
		this.ttlMs = ttlSeconds * 1000;
		this.maxEntries = maxEntries;
	}

	getEntry(key: string): CacheValue<T> | undefined {
		return this.map.get(key);
	}

	get(key: string): T | undefined {
		const e = this.map.get(key);
		if (!e) return undefined;
		if (Date.now() > e.expiresAt) return undefined;
		return e.value;
	}

	set(key: string, value: T) {
		// evict oldest if over maxEntries
		if (this.map.size >= this.maxEntries && !this.map.has(key)) {
			const oldestKey = this.map.keys().next().value;
			this.map.delete(oldestKey);
		}
		const now = Date.now();
		this.map.set(key, { value, expiresAt: now + this.ttlMs, updatedAt: now });
	}

	setRaw(key: string, entry: CacheValue<T>) {
		if (this.map.size >= this.maxEntries && !this.map.has(key)) {
			const oldestKey = this.map.keys().next().value;
			this.map.delete(oldestKey);
		}
		this.map.set(key, entry);
	}

	delete(key: string) {
		this.map.delete(key);
	}

	clear() {
		this.map.clear();
	}
}

// default instance configured from env when imported
const ttl = Number(process.env.CACHE_TTL_SECONDS || '300');
const maxEntries = Number(process.env.CACHE_MAX_ENTRIES || '1000');
export const cache = new SimpleCache<any>(ttl, maxEntries);

export default cache;
