/**
 * Version snapshot cache tests.
 */

import { VersionSnapshotCache } from "../../src/core/diff/version-cache";

describe("VersionSnapshotCache", () => {
	describe("makeKey", () => {
		it("returns null for HEAD (no version id)", () => {
			const cache = new VersionSnapshotCache();
			expect(cache.makeKey("fk", null, 2)).toBeNull();
			expect(cache.makeKey("fk", undefined, 2)).toBeNull();
			expect(cache.makeKey("fk", "", 2)).toBeNull();
		});

		it("includes fileKey, versionId, depth, and ids", () => {
			const cache = new VersionSnapshotCache();
			const key = cache.makeKey("fk", "v1", 2, ["1:2", "3:4"]);
			expect(key).toBe("fk:v1:2:1:2,3:4");
		});

		it("treats undefined depth as 'full'", () => {
			const cache = new VersionSnapshotCache();
			const key = cache.makeKey("fk", "v1", undefined);
			expect(key).toBe("fk:v1:full:");
		});

		it("normalizes node id order so [b,a] and [a,b] hash the same", () => {
			const cache = new VersionSnapshotCache();
			const a = cache.makeKey("fk", "v1", 2, ["3:4", "1:2"]);
			const b = cache.makeKey("fk", "v1", 2, ["1:2", "3:4"]);
			expect(a).toBe(b);
		});
	});

	describe("get/set/has", () => {
		it("stores and retrieves values", () => {
			const cache = new VersionSnapshotCache();
			const key = cache.makeKey("fk", "v1", 2)!;
			cache.set(key, { hello: "world" });
			expect(cache.get(key)).toEqual({ hello: "world" });
			expect(cache.has(key)).toBe(true);
		});

		it("ignores HEAD writes (key === null)", () => {
			const cache = new VersionSnapshotCache();
			cache.set(null, { hello: "world" });
			expect(cache.size).toBe(0);
			expect(cache.get(null)).toBeUndefined();
		});

		it("returns undefined for missing keys", () => {
			const cache = new VersionSnapshotCache();
			expect(cache.get("nope")).toBeUndefined();
			expect(cache.has("nope")).toBe(false);
		});
	});

	describe("LRU eviction", () => {
		it("evicts the oldest entry when over capacity", () => {
			const cache = new VersionSnapshotCache({ maxEntries: 3 });
			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3);
			expect(cache.size).toBe(3);
			cache.set("d", 4);
			expect(cache.size).toBe(3);
			expect(cache.has("a")).toBe(false);
			expect(cache.has("d")).toBe(true);
		});

		it("refreshes recency on get", () => {
			const cache = new VersionSnapshotCache({ maxEntries: 3 });
			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3);
			cache.get("a"); // a is now most recent
			cache.set("d", 4);
			// b should be evicted, not a
			expect(cache.has("a")).toBe(true);
			expect(cache.has("b")).toBe(false);
		});

		it("refreshes recency on overwrite", () => {
			const cache = new VersionSnapshotCache({ maxEntries: 3 });
			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3);
			cache.set("a", 99); // a is now most recent, value updated
			cache.set("d", 4);
			expect(cache.has("a")).toBe(true);
			expect(cache.get("a")).toBe(99);
			expect(cache.has("b")).toBe(false);
		});
	});

	describe("clear", () => {
		it("removes all entries", () => {
			const cache = new VersionSnapshotCache();
			cache.set("a", 1);
			cache.set("b", 2);
			cache.clear();
			expect(cache.size).toBe(0);
		});
	});
});
