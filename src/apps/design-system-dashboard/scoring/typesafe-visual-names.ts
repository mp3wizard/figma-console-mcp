/**
 * Optional TypeSafe (Jev) second opinion for variable naming.
 *
 * The regex check in naming-semantics.ts only catches leaves that ARE a color
 * word ("blue", "blue-500"). Compound names (brand-blue, light-gray,
 * darkgreen) slip through. When TYPESAFE_API_KEY is set, names the regex
 * passed are sent to TypeSafe as one Noul question each and any judged visual
 * are added to the finding.
 *
 * Opt-in and fail-open: no key, a network error, or a bad response leaves the
 * regex result untouched. Only variable NAMES leave the machine, and only when
 * a key is configured.
 */

import { scoreDesignSystem } from "./engine.js";
import { getVisualNameCandidates } from "./naming-semantics.js";
import type { DashboardData, DesignSystemRawData } from "./types.js";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
/** Noul probability at or above which a name counts as visual. */
const VISUAL_THRESHOLD = 0.5;
// ponytail: cap bounds cost (~400 input tokens/name); names past it keep the
// regex-only verdict. Raise or batch several names per request if needed.
const MAX_NAMES = 300;
const CONCURRENCY = 5;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 10_000;

const QUESTION = {
	type: "noul",
	instructions: {
		question:
			"Is the last path segment of `variable_name` named after how the token looks (a color, hue or shade, including compounds like light-gray or brand-blue) rather than the role or intent it plays in the UI?",
	},
	criteria: {
		true: "Leaf is named by appearance: a color/hue/shade word, alone or combined with another word",
		false:
			"Leaf describes a role, purpose, hierarchy level or interaction state (primary, danger, subtle, on-accent, disabled)",
	},
} as const;

export interface TypeSafeOptions {
	/** Defaults to process.env.TYPESAFE_API_KEY. */
	apiKey?: string;
	fetchImpl?: typeof fetch;
}

class AuthError extends Error {}

// ponytail: unbounded per-process cache; entries are tiny and bounded by
// MAX_NAMES per audit. Add eviction if a long-lived server audits many files.
const verdictCache = new Map<string, boolean>();

export function clearVisualNameCache(): void {
	verdictCache.clear();
}

async function judgeName(
	name: string,
	apiKey: string,
	fetchImpl: typeof fetch,
): Promise<boolean> {
	for (let attempt = 0; ; attempt++) {
		const res = await fetchImpl(ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				state: { variable_name: name, collection_tier: "semantic" },
				model: "jev-latest",
				questions: { visual_name: QUESTION },
			}),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (res.status === 401 || res.status === 403) {
			throw new AuthError(`TypeSafe rejected the API key (${res.status})`);
		}
		if ((res.status === 429 || res.status === 529) && attempt < MAX_RETRIES) {
			await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
			continue;
		}
		if (!res.ok) throw new Error(`TypeSafe ${res.status}`);
		const body = (await res.json()) as {
			answers?: { visual_name?: { noul?: unknown } };
		};
		const p = body.answers?.visual_name?.noul;
		if (typeof p !== "number") throw new Error("Unexpected TypeSafe response");
		return p >= VISUAL_THRESHOLD;
	}
}

/**
 * Returns the subset of `names` TypeSafe judges to be visual. Never throws:
 * names that fail to judge are simply omitted.
 */
export async function findVisualNamesWithTypeSafe(
	names: string[],
	options: TypeSafeOptions = {},
): Promise<Set<string>> {
	const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
	if (!apiKey) return new Set();
	const fetchImpl = options.fetchImpl ?? fetch;

	const capped = names.slice(0, MAX_NAMES);
	const todo = capped.filter((n) => !verdictCache.has(n));
	let next = 0;
	let stop = false;
	await Promise.all(
		Array.from({ length: Math.min(CONCURRENCY, todo.length) }, async () => {
			while (!stop && next < todo.length) {
				const name = todo[next++];
				try {
					verdictCache.set(name, await judgeName(name, apiKey, fetchImpl));
				} catch (err) {
					// A rejected key fails every request; stop instead of spamming.
					if (err instanceof AuthError) stop = true;
				}
			}
		}),
	);
	return new Set(capped.filter((n) => verdictCache.get(n)));
}

/** scoreDesignSystem plus the optional TypeSafe naming check. */
export async function scoreDesignSystemWithTypeSafe(
	data: DesignSystemRawData,
	options: TypeSafeOptions = {},
): Promise<DashboardData> {
	const extraVisualNames = await findVisualNamesWithTypeSafe(
		getVisualNameCandidates(data),
		options,
	);
	return scoreDesignSystem(data, { extraVisualNames });
}
