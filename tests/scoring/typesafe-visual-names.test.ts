/**
 * Optional TypeSafe naming check: opt-in, fail-open, regex stays the baseline.
 * All network access is mocked; no real API calls.
 */

import { scoreDesignSystem } from "../../src/apps/design-system-dashboard/scoring/engine";
import { getVisualNameCandidates } from "../../src/apps/design-system-dashboard/scoring/naming-semantics";
import type { DesignSystemRawData } from "../../src/apps/design-system-dashboard/scoring/types";
import {
	clearVisualNameCache,
	findVisualNamesWithTypeSafe,
	scoreDesignSystemWithTypeSafe,
} from "../../src/apps/design-system-dashboard/scoring/typesafe-visual-names";

const raw = { "1:0": { r: 0, g: 0, b: 1, a: 1 } };
const alias = { "1:0": { type: "VARIABLE_ALIAS", id: "VariableID:1" } };
const colorVar = (name: string, collection: string, valuesByMode: object) => ({
	name,
	resolvedType: "COLOR",
	id: name,
	variableCollectionId: collection,
	description: "",
	valuesByMode,
});

// "prim" holds the raw values (primitive tier, never judged); "sem" is judged.
function makeData(): DesignSystemRawData {
	return {
		variables: [
			colorVar("color/blue/500", "prim", raw),
			colorVar("color/gray/100", "prim", raw),
			colorVar("color/green/300", "prim", raw),
			colorVar("color/action/primary", "sem", alias),
			colorVar("color/brand-blue", "sem", alias), // regex misses this
			colorVar("color/action/blue", "sem", alias), // regex catches this
		],
		collections: [
			{ id: "prim", name: "Primitives", modes: [{ name: "Light" }] },
			{ id: "sem", name: "Semantic", modes: [{ name: "Light" }] },
		],
		components: [],
		styles: [],
		componentSets: [],
	};
}

/** Fake fetch: p(visual) by leaf name; records requested names. */
function fakeFetch(probs: Record<string, number>, status = 200) {
	const asked: string[] = [];
	const fn = jest.fn(async (_url: unknown, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body));
		const name: string = body.state.variable_name;
		asked.push(name);
		return new Response(
			JSON.stringify({
				answers: { visual_name: { noul: probs[name] ?? 0.05 } },
			}),
			{ status },
		);
	});
	return { fn: fn as unknown as typeof fetch, asked };
}

const variableFinding = (
	data: DesignSystemRawData,
	extra?: ReadonlySet<string>,
) =>
	scoreDesignSystem(data, { extraVisualNames: extra })
		.categories.find((c) => c.id === "naming-semantics")
		?.findings.find((f) => f.id === "naming-variable-semantic");

beforeEach(() => clearVisualNameCache());

describe("getVisualNameCandidates", () => {
	it("returns only semantic-tier names the regex passes", () => {
		expect(getVisualNameCandidates(makeData()).sort()).toEqual([
			"color/action/primary",
			"color/brand-blue",
		]);
	});
});

describe("findVisualNamesWithTypeSafe", () => {
	it("does nothing without an API key", async () => {
		const { fn } = fakeFetch({});
		const prev = process.env.TYPESAFE_API_KEY;
		delete process.env.TYPESAFE_API_KEY;
		try {
			expect(
				await findVisualNamesWithTypeSafe(["a"], { fetchImpl: fn }),
			).toEqual(new Set());
			expect(fn).not.toHaveBeenCalled();
		} finally {
			if (prev !== undefined) process.env.TYPESAFE_API_KEY = prev;
		}
	});

	it("flags names at or above 0.5 and sends the key as a bearer token", async () => {
		const { fn } = fakeFetch({ "color/brand-blue": 0.97, "color/x": 0.5 });
		const out = await findVisualNamesWithTypeSafe(
			["color/brand-blue", "color/action/primary", "color/x"],
			{ apiKey: "k", fetchImpl: fn },
		);
		expect(out).toEqual(new Set(["color/brand-blue", "color/x"]));
		const headers = (fn as jest.Mock).mock.calls[0][1].headers;
		expect(headers.Authorization).toBe("Bearer k");
	});

	it("caches verdicts across calls", async () => {
		const { fn, asked } = fakeFetch({});
		await findVisualNamesWithTypeSafe(["color/a"], {
			apiKey: "k",
			fetchImpl: fn,
		});
		await findVisualNamesWithTypeSafe(["color/a"], {
			apiKey: "k",
			fetchImpl: fn,
		});
		expect(asked).toEqual(["color/a"]);
	});

	it("fails open on server errors", async () => {
		const { fn } = fakeFetch({}, 500);
		const out = await findVisualNamesWithTypeSafe(["color/a"], {
			apiKey: "k",
			fetchImpl: fn,
		});
		expect(out).toEqual(new Set());
	});

	it("stops after a rejected key instead of retrying every name", async () => {
		const { fn } = fakeFetch({}, 401);
		const names = Array.from({ length: 20 }, (_, i) => `color/n${i}`);
		expect(
			await findVisualNamesWithTypeSafe(names, {
				apiKey: "bad",
				fetchImpl: fn,
			}),
		).toEqual(new Set());
		// At most one in-flight request per worker (5) before the stop flag is seen.
		expect((fn as jest.Mock).mock.calls.length).toBeLessThanOrEqual(5);
	});
});

describe("scoring integration", () => {
	it("lowers the variable-naming score when extra visual names are supplied", () => {
		const base = variableFinding(makeData());
		const withExtra = variableFinding(
			makeData(),
			new Set(["color/brand-blue"]),
		);
		expect(base?.details).toContain("1 of 3");
		expect(withExtra?.details).toContain("2 of 3");
		expect(withExtra?.score).toBeLessThan(base?.score ?? 0);
	});

	it("scoreDesignSystemWithTypeSafe sends only regex-passed names and uses the verdicts", async () => {
		const { fn, asked } = fakeFetch({ "color/brand-blue": 0.97 });
		const result = await scoreDesignSystemWithTypeSafe(makeData(), {
			apiKey: "k",
			fetchImpl: fn,
		});
		expect(asked.sort()).toEqual(["color/action/primary", "color/brand-blue"]);
		const finding = result.categories
			.find((c) => c.id === "naming-semantics")
			?.findings.find((f) => f.id === "naming-variable-semantic");
		expect(finding?.details).toContain("2 of 3");
	});

	it("matches the plain regex result when no key is configured", async () => {
		const prev = process.env.TYPESAFE_API_KEY;
		delete process.env.TYPESAFE_API_KEY;
		try {
			const a = await scoreDesignSystemWithTypeSafe(makeData());
			const b = scoreDesignSystem(makeData());
			expect(a.overall).toBe(b.overall);
			expect(a.categories.map((c) => c.score)).toEqual(
				b.categories.map((c) => c.score),
			);
		} finally {
			if (prev !== undefined) process.env.TYPESAFE_API_KEY = prev;
		}
	});
});
