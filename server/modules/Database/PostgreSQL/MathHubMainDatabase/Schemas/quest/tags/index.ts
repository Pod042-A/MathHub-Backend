import type { Table } from "../../../type.js";

export const TAGS: Table = {
	name: "tags",
	columns: {
		key: {
			name: "key",
			type: "INTEGER",
			definition: "PRIMARY KEY",
		},
		name: {
			name: "name",
			type: "TEXT",
			definition: "NOT NULL UNIQUE",
		},
		category: {
			name: "category",
			type: "SMALLINT",
			definition: "NOT NULL DEFAULT 0",
		},
	},
	foreignKeys: [
		{
			name: "fkTagsCategory",
			keys: ["category"],
			reference: {
				schema: "quest",
				table: "tagCategories",
				keys: ["key"],
			},
			definition: "ON UPDATE CASCADE ON DELETE RESTRICT",
		},
	],
} as const;
