/**
 * Changelog markdown formatter tests.
 */

import {
	formatChangelogMarkdown,
	type ChangelogInput,
} from "../../src/core/diff/changelog-formatter";

const baseInput = (): ChangelogInput => ({
	file_key: "abc123",
	file_name: "Test File",
	from_version_id: "vA",
	to_version_id: "vB",
	from_meta: {
		version_id: "vA",
		label: "Initial release",
		created_at: "2026-01-01T10:00:00Z",
		user_handle: "alice",
	},
	to_meta: {
		version_id: "vB",
		label: "v2 published",
		created_at: "2026-04-01T10:00:00Z",
		user_handle: "bob",
	},
	page_structure: {
		pages_added: [],
		pages_removed: [],
		pages_renamed: [],
		summary: { added: 0, removed: 0, renamed: 0 },
	},
	notes: [],
});

describe("formatChangelogMarkdown", () => {
	describe("header", () => {
		it("includes file name in title when provided", () => {
			const md = formatChangelogMarkdown(baseInput(), "summary");
			expect(md).toContain("# Test File — Change Log");
		});

		it("falls back to a generic title when file_name is missing", () => {
			const input = baseInput();
			input.file_name = null;
			const md = formatChangelogMarkdown(input, "summary");
			expect(md).toContain("# Figma File Change Log");
		});

		it("renders both labeled versions with handle and date", () => {
			const md = formatChangelogMarkdown(baseInput(), "summary");
			expect(md).toContain("Initial release");
			expect(md).toContain("by alice");
			expect(md).toContain("v2 published");
			expect(md).toContain("by bob");
			expect(md).toContain("`vA`");
			expect(md).toContain("`vB`");
		});

		it("computes span in days", () => {
			const md = formatChangelogMarkdown(baseInput(), "summary");
			expect(md).toContain("**Span:** 90 days");
		});

		it("renders 'Current state' for HEAD with optional date", () => {
			const input = baseInput();
			input.to_version_id = "current";
			input.to_meta = {
				version_id: "current",
				is_head: true,
				created_at: "2026-04-29T22:23:25Z",
				user_handle: "tj",
			};
			const md = formatChangelogMarkdown(input, "summary");
			expect(md).toContain("Current state");
			expect(md).toContain("2026-04-29");
			expect(md).toContain("by tj");
		});

		it("falls back gracefully when from_meta is missing", () => {
			const input = baseInput();
			input.from_meta = null;
			const md = formatChangelogMarkdown(input, "summary");
			expect(md).toContain("`vA`");
			expect(md).toContain("metadata not available");
		});
	});

	describe("summary mode", () => {
		it("emits a single one-liner with counts and stops", () => {
			const input = baseInput();
			input.page_structure = {
				pages_added: [{ id: "1:0", name: "New Page" }],
				pages_removed: [{ id: "2:0", name: "Old Page" }],
				pages_renamed: [],
				summary: { added: 1, removed: 1, renamed: 0 },
			};
			const md = formatChangelogMarkdown(input, "summary");
			expect(md).toContain("1 page added");
			expect(md).toContain("1 page removed");
			// summary mode does NOT include the "## Page Structure" header
			expect(md).not.toContain("## Page Structure");
		});

		it("renders 'no structural changes' when summary is empty", () => {
			const md = formatChangelogMarkdown(baseInput(), "summary");
			expect(md).toContain("No structural changes detected");
		});

		it("includes scoped component count line", () => {
			const input = baseInput();
			input.scoped_nodes = [
				{
					node_id: "100:1",
					node_name: "Button",
					node_type: "COMPONENT_SET",
					name_changed: null,
					description_changed: null,
					children_added: [],
					children_removed: [],
					component_properties: null,
					binding_changes: [],
					change_count: 3,
					notes: [],
				},
			];
			const md = formatChangelogMarkdown(input, "summary");
			expect(md).toContain("1 component with 3 changes");
		});
	});

	describe("standard mode", () => {
		it("emits Page Structure section with itemized lists", () => {
			const input = baseInput();
			input.page_structure = {
				pages_added: [{ id: "1:0", name: "Card" }],
				pages_removed: [
					{ id: "2:0", name: "Token Visuals" },
					{ id: "3:0", name: "Token Visuals v2" },
				],
				pages_renamed: [],
				summary: { added: 1, removed: 2, renamed: 0 },
			};
			const md = formatChangelogMarkdown(input, "standard");
			expect(md).toContain("## Page Structure");
			expect(md).toContain("**Added (1):**");
			expect(md).toContain("Card `1:0`");
			expect(md).toContain("**Removed (2):**");
			expect(md).toContain("Token Visuals `2:0`");
		});

		it("notes 'No page-level changes' when page summary is empty", () => {
			const md = formatChangelogMarkdown(baseInput(), "standard");
			expect(md).toContain("_No page-level changes._");
		});

		it("emits placeholder Components section when no scoped nodes", () => {
			const md = formatChangelogMarkdown(baseInput(), "standard");
			expect(md).toContain("## Components");
			expect(md).toContain("Pass `component_ids`");
		});

		it("renders per-component counts but not per-binding details in standard mode", () => {
			const input = baseInput();
			input.scoped_nodes = [
				{
					node_id: "100:1",
					node_name: "Button",
					node_type: "COMPONENT_SET",
					name_changed: null,
					description_changed: null,
					children_added: [],
					children_removed: [],
					component_properties: {
						added: [],
						removed: [],
						type_changed: [],
						default_changed: [],
						summary: { added: 1, removed: 0, type_changed: 0, default_changed: 0 },
					},
					binding_changes: [
						{
							node_id: "100:1",
							node_name: "Button",
							property: "paddingLeft",
							from_variable_id: null,
							to_variable_id: "VarA",
							change_kind: "added",
						},
						{
							node_id: "100:2",
							node_name: "Variant=Primary",
							property: "paddingTop",
							from_variable_id: "VarOld",
							to_variable_id: "VarNew",
							change_kind: "rebound",
						},
					],
					change_count: 3,
					notes: [],
				},
			];
			const md = formatChangelogMarkdown(input, "standard");
			expect(md).toContain("### Button — `100:1`");
			expect(md).toContain("**3 changes**");
			expect(md).toContain("**Component properties:** 1 added");
			expect(md).toContain("**Variable bindings (2):**");
			expect(md).toContain("1 added, 1 rebound");
			// detailed-only content should NOT appear
			expect(md).not.toContain("→ `VarA`");
		});
	});

	describe("detailed mode", () => {
		it("renders per-property and per-binding bullets", () => {
			const input = baseInput();
			input.scoped_nodes = [
				{
					node_id: "100:1",
					node_name: "Button",
					node_type: "COMPONENT_SET",
					name_changed: null,
					description_changed: null,
					children_added: [],
					children_removed: [],
					component_properties: {
						added: [
							{ name: "Disabled#1:2", type: "BOOLEAN", default_value: false },
						],
						removed: [],
						type_changed: [],
						default_changed: [
							{ name: "Text#1:1", from_default: "Label", to_default: "Submit" },
						],
						summary: { added: 1, removed: 0, type_changed: 0, default_changed: 1 },
					},
					binding_changes: [
						{
							node_id: "100:1",
							node_name: "Button",
							property: "paddingLeft",
							from_variable_id: null,
							to_variable_id: "VarA",
							change_kind: "added",
						},
						{
							node_id: "100:2",
							node_name: "Variant=Primary",
							property: "color",
							from_variable_id: "VarOld",
							to_variable_id: null,
							change_kind: "removed",
						},
					],
					change_count: 4,
					notes: [],
				},
			];
			const md = formatChangelogMarkdown(input, "detailed");
			expect(md).toContain("➕ `Disabled#1:2`");
			expect(md).toContain("⚙️ `Text#1:1`");
			expect(md).toContain("Label");
			expect(md).toContain("Submit");
			expect(md).toContain("paddingLeft");
			expect(md).toContain("→ `VarA`");
			expect(md).toContain("(removed, was `VarOld`)");
		});

		it("groups not-found and unchanged components separately", () => {
			const input = baseInput();
			input.scoped_nodes = [
				{
					node_id: "100:1",
					node_name: "Button",
					node_type: "COMPONENT_SET",
					name_changed: null,
					description_changed: null,
					children_added: [],
					children_removed: [],
					component_properties: null,
					binding_changes: [],
					change_count: 0,
					notes: [],
				},
				{
					node_id: "999:9",
					node_name: "",
					node_type: "",
					name_changed: null,
					description_changed: null,
					children_added: [],
					children_removed: [],
					component_properties: null,
					binding_changes: [],
					change_count: 0,
					notes: ["Node not found in either version."],
				},
			];
			const md = formatChangelogMarkdown(input, "detailed");
			expect(md).toContain("**No changes:**");
			expect(md).toContain("**Not found in either version:**");
			expect(md).toContain("`999:9`");
		});
	});

	describe("notes section", () => {
		it("appends notes when present", () => {
			const input = baseInput();
			input.notes = ["Variable VALUE history is not retrievable.", "Some other caveat."];
			const md = formatChangelogMarkdown(input, "standard");
			expect(md).toContain("## Notes");
			expect(md).toContain("Variable VALUE history");
			expect(md).toContain("Some other caveat");
		});

		it("omits notes section when empty", () => {
			const input = baseInput();
			input.notes = [];
			const md = formatChangelogMarkdown(input, "standard");
			expect(md).not.toContain("## Notes");
		});
	});

	describe("escaping", () => {
		it("escapes markdown-special characters in user-supplied names", () => {
			const input = baseInput();
			input.scoped_nodes = [
				{
					node_id: "100:1",
					node_name: "Foo *bar* `baz`",
					node_type: "FRAME",
					name_changed: { from: "old _name_", to: "new [name]" },
					description_changed: null,
					children_added: [],
					children_removed: [],
					component_properties: null,
					binding_changes: [],
					change_count: 1,
					notes: [],
				},
			];
			const md = formatChangelogMarkdown(input, "standard");
			expect(md).toContain("Foo \\*bar\\* \\`baz\\`");
			expect(md).toContain("old \\_name\\_");
			expect(md).toContain("new \\[name\\]");
		});
	});
});
