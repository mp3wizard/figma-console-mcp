/**
 * Diff engine pure-function tests.
 */

import {
	diffPageStructure,
	diffComponentPropertyDefinitions,
	collectBindingChanges,
	diffNode,
} from "../../src/core/diff/diff-engine";

// ============================================================================
// diffPageStructure
// ============================================================================

describe("diffPageStructure", () => {
	const makeDoc = (pages: Array<{ id: string; name: string }>) => ({
		id: "0:0",
		type: "DOCUMENT",
		children: pages.map((p) => ({ id: p.id, name: p.name, type: "CANVAS" })),
	});

	it("detects added pages", () => {
		const from = makeDoc([{ id: "1:0", name: "Page A" }]);
		const to = makeDoc([
			{ id: "1:0", name: "Page A" },
			{ id: "2:0", name: "Page B" },
		]);
		const diff = diffPageStructure(from, to);
		expect(diff.pages_added.map((p) => p.id)).toEqual(["2:0"]);
		expect(diff.pages_removed).toHaveLength(0);
		expect(diff.pages_renamed).toHaveLength(0);
		expect(diff.summary).toEqual({ added: 1, removed: 0, renamed: 0 });
	});

	it("detects removed pages", () => {
		const from = makeDoc([
			{ id: "1:0", name: "Page A" },
			{ id: "2:0", name: "Page B" },
		]);
		const to = makeDoc([{ id: "1:0", name: "Page A" }]);
		const diff = diffPageStructure(from, to);
		expect(diff.pages_removed.map((p) => p.id)).toEqual(["2:0"]);
	});

	it("detects renamed pages by stable id", () => {
		const from = makeDoc([{ id: "1:0", name: "Old Name" }]);
		const to = makeDoc([{ id: "1:0", name: "New Name" }]);
		const diff = diffPageStructure(from, to);
		expect(diff.pages_renamed).toEqual([
			{ id: "1:0", old_name: "Old Name", new_name: "New Name" },
		]);
		expect(diff.pages_added).toHaveLength(0);
		expect(diff.pages_removed).toHaveLength(0);
	});

	it("handles empty/malformed input", () => {
		const diff = diffPageStructure({}, {});
		expect(diff.summary).toEqual({ added: 0, removed: 0, renamed: 0 });
		const diff2 = diffPageStructure(null as any, null as any);
		expect(diff2.summary).toEqual({ added: 0, removed: 0, renamed: 0 });
	});
});

// ============================================================================
// diffComponentPropertyDefinitions
// ============================================================================

describe("diffComponentPropertyDefinitions", () => {
	const fromDefs = {
		"Text#1:1": { type: "TEXT", defaultValue: "Label" },
		"Disabled#1:2": { type: "BOOLEAN", defaultValue: false },
		"Icon#1:3": { type: "INSTANCE_SWAP", defaultValue: "icon-a" },
	};

	it("detects added properties", () => {
		const toDefs = {
			...fromDefs,
			"NewProp#1:4": { type: "BOOLEAN", defaultValue: true },
		};
		const diff = diffComponentPropertyDefinitions(fromDefs, toDefs);
		expect(diff.added).toEqual([{ name: "NewProp#1:4", type: "BOOLEAN", default_value: true }]);
		expect(diff.removed).toHaveLength(0);
	});

	it("detects removed properties", () => {
		const toDefs = { "Text#1:1": fromDefs["Text#1:1"] };
		const diff = diffComponentPropertyDefinitions(fromDefs, toDefs);
		expect(diff.removed.map((p) => p.name)).toEqual(["Disabled#1:2", "Icon#1:3"]);
	});

	it("detects type changes", () => {
		const toDefs = {
			...fromDefs,
			"Disabled#1:2": { type: "TEXT", defaultValue: false }, // boolean -> text
		};
		const diff = diffComponentPropertyDefinitions(fromDefs, toDefs);
		expect(diff.type_changed).toEqual([
			{ name: "Disabled#1:2", from_type: "BOOLEAN", to_type: "TEXT" },
		]);
	});

	it("detects default-value changes", () => {
		const toDefs = {
			...fromDefs,
			"Text#1:1": { type: "TEXT", defaultValue: "Submit" },
		};
		const diff = diffComponentPropertyDefinitions(fromDefs, toDefs);
		expect(diff.default_changed).toEqual([
			{ name: "Text#1:1", from_default: "Label", to_default: "Submit" },
		]);
	});

	it("treats undefined defs as empty", () => {
		const diff = diffComponentPropertyDefinitions(undefined, fromDefs);
		expect(diff.added).toHaveLength(3);
		expect(diff.removed).toHaveLength(0);
	});
});

// ============================================================================
// collectBindingChanges
// ============================================================================

describe("collectBindingChanges", () => {
	it("detects added bindings", () => {
		const from = { id: "1:1", name: "n", boundVariables: {} };
		const to = {
			id: "1:1",
			name: "n",
			boundVariables: { paddingLeft: { type: "VARIABLE_ALIAS", id: "VarA" } },
		};
		const changes = collectBindingChanges(from, to);
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			node_id: "1:1",
			property: "paddingLeft",
			from_variable_id: null,
			to_variable_id: "VarA",
			change_kind: "added",
		});
	});

	it("detects removed bindings", () => {
		const from = {
			id: "1:1",
			name: "n",
			boundVariables: { paddingLeft: { type: "VARIABLE_ALIAS", id: "VarA" } },
		};
		const to = { id: "1:1", name: "n", boundVariables: {} };
		const changes = collectBindingChanges(from, to);
		expect(changes).toHaveLength(1);
		expect(changes[0].change_kind).toBe("removed");
	});

	it("detects rebound bindings", () => {
		const from = {
			id: "1:1",
			name: "n",
			boundVariables: { paddingLeft: { type: "VARIABLE_ALIAS", id: "VarA" } },
		};
		const to = {
			id: "1:1",
			name: "n",
			boundVariables: { paddingLeft: { type: "VARIABLE_ALIAS", id: "VarB" } },
		};
		const changes = collectBindingChanges(from, to);
		expect(changes).toHaveLength(1);
		expect(changes[0].change_kind).toBe("rebound");
		expect(changes[0].from_variable_id).toBe("VarA");
		expect(changes[0].to_variable_id).toBe("VarB");
	});

	it("walks children recursively, matching by id", () => {
		const from = {
			id: "0:0",
			name: "root",
			children: [
				{
					id: "1:1",
					name: "child",
					boundVariables: { x: { type: "VARIABLE_ALIAS", id: "Var1" } },
				},
			],
		};
		const to = {
			id: "0:0",
			name: "root",
			children: [
				{
					id: "1:1",
					name: "child",
					boundVariables: { x: { type: "VARIABLE_ALIAS", id: "Var2" } },
				},
			],
		};
		const changes = collectBindingChanges(from, to);
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			node_id: "1:1",
			property: "x",
			change_kind: "rebound",
		});
	});

	it("returns empty when bindings are equivalent", () => {
		const node = {
			id: "1:1",
			name: "n",
			boundVariables: { paddingLeft: { type: "VARIABLE_ALIAS", id: "Same" } },
		};
		const changes = collectBindingChanges(node, { ...node });
		expect(changes).toHaveLength(0);
	});
});

// ============================================================================
// diffNode
// ============================================================================

describe("diffNode", () => {
	const makeComponentSet = (overrides: any = {}) => ({
		id: "100:1",
		name: "Button",
		type: "COMPONENT_SET",
		description: "A button",
		componentPropertyDefinitions: {
			"Text#1:1": { type: "TEXT", defaultValue: "Label" },
		},
		boundVariables: {},
		children: [{ id: "100:2", name: "Variant=Primary", type: "COMPONENT" }],
		...overrides,
	});

	it("detects name change", () => {
		const from = makeComponentSet();
		const to = makeComponentSet({ name: "Button v2" });
		const d = diffNode(from, to, "standard");
		expect(d.name_changed).toEqual({ from: "Button", to: "Button v2" });
		expect(d.change_count).toBe(1);
	});

	it("detects description change", () => {
		const from = makeComponentSet();
		const to = makeComponentSet({ description: "An updated button" });
		const d = diffNode(from, to, "standard");
		expect(d.description_changed).toEqual({ from: "A button", to: "An updated button" });
	});

	it("detects added/removed children (variants)", () => {
		const from = makeComponentSet();
		const to = makeComponentSet({
			children: [
				{ id: "100:2", name: "Variant=Primary", type: "COMPONENT" },
				{ id: "100:3", name: "Variant=Secondary", type: "COMPONENT" },
			],
		});
		const d = diffNode(from, to, "standard");
		expect(d.children_added.map((c) => c.id)).toEqual(["100:3"]);
		expect(d.children_removed).toHaveLength(0);
	});

	it("detects componentPropertyDefinitions changes for COMPONENT_SET", () => {
		const from = makeComponentSet();
		const to = makeComponentSet({
			componentPropertyDefinitions: {
				"Text#1:1": { type: "TEXT", defaultValue: "Submit" }, // default changed
				"Disabled#1:2": { type: "BOOLEAN", defaultValue: false }, // added
			},
		});
		const d = diffNode(from, to, "detailed");
		expect(d.component_properties).not.toBeNull();
		expect(d.component_properties!.summary).toEqual({
			added: 1,
			removed: 0,
			type_changed: 0,
			default_changed: 1,
		});
	});

	it("returns added marker when fromNode is null", () => {
		const d = diffNode(null, makeComponentSet(), "standard");
		expect(d.notes[0]).toContain("added");
		expect(d.change_count).toBe(1);
	});

	it("returns removed marker when toNode is null", () => {
		const d = diffNode(makeComponentSet(), null, "standard");
		expect(d.notes[0]).toContain("removed");
	});

	it("summary mode strips detail arrays but keeps counts", () => {
		const from = makeComponentSet();
		const to = makeComponentSet({
			children: [
				...from.children,
				{ id: "100:3", name: "Variant=Secondary", type: "COMPONENT" },
			],
			componentPropertyDefinitions: {
				...from.componentPropertyDefinitions,
				"Disabled#1:2": { type: "BOOLEAN", defaultValue: false },
			},
		});
		const d = diffNode(from, to, "summary");
		expect(d.children_added).toHaveLength(0); // stripped
		expect(d.component_properties!.added).toHaveLength(0); // stripped
		expect(d.component_properties!.summary.added).toBe(1); // kept
		expect(d.change_count).toBeGreaterThan(0);
	});

	it("standard mode keeps lightweight names but drops default values", () => {
		const from = makeComponentSet();
		const to = makeComponentSet({
			componentPropertyDefinitions: {
				"Text#1:1": { type: "TEXT", defaultValue: "Submit" },
				"Disabled#1:2": { type: "BOOLEAN", defaultValue: true },
			},
		});
		const d = diffNode(from, to, "standard");
		expect(d.component_properties!.added).toEqual([
			{ name: "Disabled#1:2", type: "BOOLEAN", default_value: undefined },
		]);
		expect(d.component_properties!.default_changed).toEqual([
			{ name: "Text#1:1", from_default: undefined, to_default: undefined },
		]);
	});

	it("detailed mode keeps all defaults and binding details", () => {
		const from = makeComponentSet({
			boundVariables: { paddingLeft: { type: "VARIABLE_ALIAS", id: "VarA" } },
		});
		const to = makeComponentSet({
			boundVariables: { paddingLeft: { type: "VARIABLE_ALIAS", id: "VarB" } },
			componentPropertyDefinitions: {
				"Text#1:1": { type: "TEXT", defaultValue: "Submit" },
			},
		});
		const d = diffNode(from, to, "detailed");
		expect(d.binding_changes).toHaveLength(1);
		expect(d.binding_changes[0].to_variable_id).toBe("VarB");
		expect(d.component_properties!.default_changed[0].to_default).toBe("Submit");
	});
});
