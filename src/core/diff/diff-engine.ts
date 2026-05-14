/**
 * Diff engine — pure functions for comparing Figma file/node snapshots
 * across two versions.
 *
 * Scope (v1):
 *   - Page-structure diff (added/removed/renamed pages) from depth=1 file fetches
 *   - Per-node diff for scoped fetches: name, description, children added/removed,
 *     componentPropertyDefinitions changes (for COMPONENT_SET), boundVariables changes
 *
 * NOT in scope (deferred):
 *   - Variable VALUE history (Figma REST does not expose this; planned forward
 *     ledger will fill the gap going forward, never retroactively)
 *   - Style-content diffs (only style add/remove via reachable styles map)
 *   - Inside-fills/strokes binding diffs (top-level boundVariables only for v1)
 */

export type DiffMode = "summary" | "standard" | "detailed";

// ============================================================================
// Page structure
// ============================================================================

export interface PageEntry {
	id: string;
	name: string;
}

export interface PageStructureDiff {
	pages_added: PageEntry[];
	pages_removed: PageEntry[];
	pages_renamed: Array<{ id: string; old_name: string; new_name: string }>;
	summary: {
		added: number;
		removed: number;
		renamed: number;
	};
}

/**
 * Compare two file documents (from /v1/files/:key?version=X with depth=1 or higher).
 * Both arguments should be the `document` field of a Figma file response.
 */
export function diffPageStructure(fromDoc: any, toDoc: any): PageStructureDiff {
	const fromPages: PageEntry[] = extractPages(fromDoc);
	const toPages: PageEntry[] = extractPages(toDoc);

	const fromById = new Map(fromPages.map((p) => [p.id, p]));
	const toById = new Map(toPages.map((p) => [p.id, p]));

	const added: PageEntry[] = [];
	const removed: PageEntry[] = [];
	const renamed: Array<{ id: string; old_name: string; new_name: string }> = [];

	for (const p of toPages) {
		if (!fromById.has(p.id)) {
			added.push(p);
		} else {
			const old = fromById.get(p.id)!;
			if (old.name !== p.name) {
				renamed.push({ id: p.id, old_name: old.name, new_name: p.name });
			}
		}
	}

	for (const p of fromPages) {
		if (!toById.has(p.id)) removed.push(p);
	}

	return {
		pages_added: added,
		pages_removed: removed,
		pages_renamed: renamed,
		summary: {
			added: added.length,
			removed: removed.length,
			renamed: renamed.length,
		},
	};
}

function extractPages(doc: any): PageEntry[] {
	const children = doc?.children;
	if (!Array.isArray(children)) return [];
	return children
		.filter((c: any) => c && typeof c.id === "string" && typeof c.name === "string")
		.map((c: any) => ({ id: c.id, name: c.name }));
}

// ============================================================================
// Component property definitions (COMPONENT_SET only)
// ============================================================================

export interface PropertyDefSummary {
	name: string;
	type: string;
	default_value: any;
}

export interface ComponentPropertyDefDiff {
	added: PropertyDefSummary[];
	removed: PropertyDefSummary[];
	type_changed: Array<{ name: string; from_type: string; to_type: string }>;
	default_changed: Array<{ name: string; from_default: any; to_default: any }>;
	summary: {
		added: number;
		removed: number;
		type_changed: number;
		default_changed: number;
	};
}

/**
 * Diff a COMPONENT_SET's componentPropertyDefinitions map.
 * Each definition is keyed by `propName#nodeId` in Figma's response.
 */
export function diffComponentPropertyDefinitions(
	fromDefs: Record<string, any> | undefined,
	toDefs: Record<string, any> | undefined,
): ComponentPropertyDefDiff {
	const from = fromDefs ?? {};
	const to = toDefs ?? {};

	const added: PropertyDefSummary[] = [];
	const removed: PropertyDefSummary[] = [];
	const typeChanged: Array<{ name: string; from_type: string; to_type: string }> = [];
	const defaultChanged: Array<{ name: string; from_default: any; to_default: any }> = [];

	for (const key of Object.keys(to)) {
		const toDef = to[key];
		if (!(key in from)) {
			added.push({ name: key, type: toDef.type, default_value: toDef.defaultValue });
		} else {
			const fromDef = from[key];
			if (fromDef.type !== toDef.type) {
				typeChanged.push({ name: key, from_type: fromDef.type, to_type: toDef.type });
			}
			if (!deepEqual(fromDef.defaultValue, toDef.defaultValue)) {
				defaultChanged.push({
					name: key,
					from_default: fromDef.defaultValue,
					to_default: toDef.defaultValue,
				});
			}
		}
	}

	for (const key of Object.keys(from)) {
		if (!(key in to)) {
			const fromDef = from[key];
			removed.push({ name: key, type: fromDef.type, default_value: fromDef.defaultValue });
		}
	}

	return {
		added,
		removed,
		type_changed: typeChanged,
		default_changed: defaultChanged,
		summary: {
			added: added.length,
			removed: removed.length,
			type_changed: typeChanged.length,
			default_changed: defaultChanged.length,
		},
	};
}

// ============================================================================
// Variable bindings
// ============================================================================

export interface BindingChange {
	node_id: string;
	node_name: string;
	property: string;
	from_variable_id: string | null;
	to_variable_id: string | null;
	change_kind: "added" | "removed" | "rebound";
}

/**
 * Walk both node trees in parallel (matched by node id), comparing top-level
 * boundVariables. Inside-fills/strokes binding diffs are explicitly NOT included
 * in v1 — they add complexity for marginal additional value over node-level deltas.
 */
export function collectBindingChanges(fromNode: any, toNode: any): BindingChange[] {
	const changes: BindingChange[] = [];
	walkBoth(fromNode, toNode, (a, b) => {
		const aBindings = extractTopLevelBindings(a);
		const bBindings = extractTopLevelBindings(b);
		const allKeys = new Set([...Object.keys(aBindings), ...Object.keys(bBindings)]);
		for (const key of allKeys) {
			const fromId = aBindings[key] ?? null;
			const toId = bBindings[key] ?? null;
			if (fromId === toId) continue;
			let kind: BindingChange["change_kind"];
			if (fromId === null) kind = "added";
			else if (toId === null) kind = "removed";
			else kind = "rebound";
			changes.push({
				node_id: (b ?? a).id,
				node_name: (b ?? a).name ?? "",
				property: key,
				from_variable_id: fromId,
				to_variable_id: toId,
				change_kind: kind,
			});
		}
	});
	return changes;
}

function extractTopLevelBindings(node: any): Record<string, string> {
	const out: Record<string, string> = {};
	const bv = node?.boundVariables;
	if (!bv || typeof bv !== "object") return out;
	for (const [prop, ref] of Object.entries(bv)) {
		if (ref && typeof ref === "object") {
			// Single VARIABLE_ALIAS reference
			if ((ref as any).type === "VARIABLE_ALIAS" && typeof (ref as any).id === "string") {
				out[prop] = (ref as any).id;
				continue;
			}
			// Array of refs (e.g., fills binding can be an array — surface first match for v1)
			if (Array.isArray(ref)) {
				const first = (ref as any[]).find(
					(r) => r && r.type === "VARIABLE_ALIAS" && typeof r.id === "string",
				);
				if (first) out[`${prop}[0]`] = first.id;
			}
		}
	}
	return out;
}

function walkBoth(
	fromNode: any,
	toNode: any,
	visit: (a: any, b: any) => void,
): void {
	if (!fromNode && !toNode) return;
	visit(fromNode, toNode);
	const fromChildren = Array.isArray(fromNode?.children) ? fromNode.children : [];
	const toChildren = Array.isArray(toNode?.children) ? toNode.children : [];
	const byIdFrom = new Map<string, any>();
	for (const c of fromChildren) if (c?.id) byIdFrom.set(c.id, c);
	const byIdTo = new Map<string, any>();
	for (const c of toChildren) if (c?.id) byIdTo.set(c.id, c);
	const allIds = new Set([...byIdFrom.keys(), ...byIdTo.keys()]);
	for (const id of allIds) {
		walkBoth(byIdFrom.get(id), byIdTo.get(id), visit);
	}
}

// ============================================================================
// Single node diff (the headline output for a scoped diff request)
// ============================================================================

export interface NodeChildSummary {
	id: string;
	name: string;
	type: string;
}

/**
 * v1.25.0: a metadata-only change captured via the Plugin API session buffer.
 * Surfaces description/annotation edits that Figma REST doesn't expose in
 * version snapshots. Populated when the diff time window overlaps with
 * buffered plugin events; absent/empty otherwise.
 */
export interface MetadataChange {
	field: "description" | "annotations";
	new_value: any;
	timestamp: number;
	source: "plugin_buffer";
}

export interface NodeDiff {
	node_id: string;
	node_name: string;
	node_type: string;
	name_changed: { from: string; to: string } | null;
	description_changed: { from: string; to: string } | null;
	children_added: NodeChildSummary[];
	children_removed: NodeChildSummary[];
	component_properties: ComponentPropertyDefDiff | null;
	binding_changes: BindingChange[];
	/** v1.25.0: description/annotation changes captured via plugin session buffer */
	metadata_changes?: MetadataChange[];
	change_count: number;
	notes: string[];
}

/**
 * Diff a single node (typically a COMPONENT_SET) at depth=2. Either side may be
 * null/undefined to represent "newly added" or "removed entirely."
 */
export function diffNode(fromNode: any, toNode: any, mode: DiffMode = "standard"): NodeDiff {
	const id = (toNode ?? fromNode)?.id ?? "";
	const name = (toNode ?? fromNode)?.name ?? "";
	const type = (toNode ?? fromNode)?.type ?? "";

	const out: NodeDiff = {
		node_id: id,
		node_name: name,
		node_type: type,
		name_changed: null,
		description_changed: null,
		children_added: [],
		children_removed: [],
		component_properties: null,
		binding_changes: [],
		change_count: 0,
		notes: [],
	};

	if (!fromNode && toNode) {
		out.notes.push("Node was added in the target version (no prior state to compare).");
		out.change_count = 1;
		return out;
	}
	if (fromNode && !toNode) {
		out.notes.push("Node was removed in the target version (no later state to compare).");
		out.change_count = 1;
		return out;
	}
	if (!fromNode && !toNode) {
		out.notes.push("Node not found in either version.");
		return out;
	}

	if (fromNode.name !== toNode.name) {
		out.name_changed = { from: fromNode.name, to: toNode.name };
	}
	if ((fromNode.description ?? "") !== (toNode.description ?? "")) {
		out.description_changed = {
			from: fromNode.description ?? "",
			to: toNode.description ?? "",
		};
	}

	const fromChildIds = new Set(
		(fromNode.children ?? []).filter((c: any) => c?.id).map((c: any) => c.id),
	);
	const toChildIds = new Set(
		(toNode.children ?? []).filter((c: any) => c?.id).map((c: any) => c.id),
	);
	for (const c of toNode.children ?? []) {
		if (c?.id && !fromChildIds.has(c.id)) {
			out.children_added.push({ id: c.id, name: c.name ?? "", type: c.type ?? "" });
		}
	}
	for (const c of fromNode.children ?? []) {
		if (c?.id && !toChildIds.has(c.id)) {
			out.children_removed.push({ id: c.id, name: c.name ?? "", type: c.type ?? "" });
		}
	}

	if (fromNode.type === "COMPONENT_SET" || toNode.type === "COMPONENT_SET") {
		const propDiff = diffComponentPropertyDefinitions(
			fromNode.componentPropertyDefinitions,
			toNode.componentPropertyDefinitions,
		);
		const hasAny =
			propDiff.summary.added > 0 ||
			propDiff.summary.removed > 0 ||
			propDiff.summary.type_changed > 0 ||
			propDiff.summary.default_changed > 0;
		if (hasAny) out.component_properties = propDiff;
	}

	out.binding_changes = collectBindingChanges(fromNode, toNode);

	out.change_count =
		(out.name_changed ? 1 : 0) +
		(out.description_changed ? 1 : 0) +
		out.children_added.length +
		out.children_removed.length +
		(out.component_properties
			? out.component_properties.summary.added +
				out.component_properties.summary.removed +
				out.component_properties.summary.type_changed +
				out.component_properties.summary.default_changed
			: 0) +
		out.binding_changes.length;

	if (mode === "summary") {
		// Strip detail arrays, keep counts only
		out.children_added = [];
		out.children_removed = [];
		if (out.component_properties) {
			out.component_properties = {
				added: [],
				removed: [],
				type_changed: [],
				default_changed: [],
				summary: out.component_properties.summary,
			};
		}
		out.binding_changes = [];
	} else if (mode === "standard") {
		// Keep the lightweight summaries (children_added, children_removed,
		// component_properties.summary). Strip the heavy detail arrays.
		if (out.component_properties) {
			out.component_properties = {
				added: out.component_properties.added.map((p) => ({ ...p, default_value: undefined })),
				removed: out.component_properties.removed.map((p) => ({
					...p,
					default_value: undefined,
				})),
				type_changed: out.component_properties.type_changed,
				default_changed: out.component_properties.default_changed.map((d) => ({
					name: d.name,
					from_default: undefined,
					to_default: undefined,
				})),
				summary: out.component_properties.summary,
			};
		}
		// Bindings: keep as-is, they're already compact.
	}
	// mode === "detailed" → keep everything

	return out;
}

// ============================================================================
// Helpers
// ============================================================================

function deepEqual(a: any, b: any): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
		return true;
	}
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;
	for (const k of aKeys) if (!deepEqual(a[k], b[k])) return false;
	return true;
}
