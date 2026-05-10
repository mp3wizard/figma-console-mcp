/**
 * In-memory LRU cache for Figma file snapshots at past versions.
 *
 * Past versions are immutable, so a cached snapshot for `${fileKey}:${versionId}`
 * never goes stale. The cache is process-scoped (no persistence) and bounded by
 * a max-entries cap rather than a byte budget — keeps the implementation simple
 * and avoids assumptions about JSON serialization size.
 *
 * HEAD ("current") is intentionally NOT cached because it changes on every save.
 * Callers should pass `null` as the versionId for HEAD requests; the cache
 * methods short-circuit on null.
 *
 * Usage:
 *   const cache = new VersionSnapshotCache();
 *   const key = cache.makeKey(fileKey, versionId, depth, nodeIds);
 *   let snapshot = cache.get(key);
 *   if (!snapshot) {
 *     snapshot = await api.getFile(fileKey, { version: versionId, depth });
 *     cache.set(key, snapshot);
 *   }
 */

export interface VersionSnapshotCacheOptions {
	maxEntries?: number;
}

export class VersionSnapshotCache {
	private readonly maxEntries: number;
	// Map preserves insertion order — first key is the LRU.
	private readonly store = new Map<string, unknown>();

	constructor(options: VersionSnapshotCacheOptions = {}) {
		this.maxEntries = options.maxEntries ?? 50;
	}

	/**
	 * Build a stable cache key from the request parameters.
	 * Returns null for HEAD requests (versionId is null/undefined/empty).
	 */
	makeKey(
		fileKey: string,
		versionId: string | null | undefined,
		depth: number | undefined,
		nodeIds?: string[],
	): string | null {
		if (!versionId) return null;
		const idsHash = nodeIds && nodeIds.length > 0
			? [...nodeIds].sort().join(",")
			: "";
		const depthPart = depth === undefined ? "full" : String(depth);
		return `${fileKey}:${versionId}:${depthPart}:${idsHash}`;
	}

	get<T = unknown>(key: string | null): T | undefined {
		if (key === null) return undefined;
		if (!this.store.has(key)) return undefined;
		// Refresh recency: delete + re-insert moves the key to the end.
		const value = this.store.get(key) as T;
		this.store.delete(key);
		this.store.set(key, value);
		return value;
	}

	set(key: string | null, value: unknown): void {
		if (key === null) return;
		if (this.store.has(key)) this.store.delete(key);
		this.store.set(key, value);
		while (this.store.size > this.maxEntries) {
			const oldestKey = this.store.keys().next().value;
			if (oldestKey === undefined) break;
			this.store.delete(oldestKey);
		}
	}

	has(key: string | null): boolean {
		return key !== null && this.store.has(key);
	}

	get size(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}
}
