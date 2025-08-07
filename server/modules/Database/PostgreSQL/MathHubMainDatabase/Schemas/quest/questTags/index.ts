import type { Table } from "../../../type.js";

export const QUEST_TAGS: Table = {
	name: "questTags",
	columns: {
		quest: {
			name: "quest",
			type: "UUID",
			definition: "NOT NULL",
		},
		tag: {
			name: "tag",
			type: "INTEGER",
			definition: "NOT NULL",
		},
	},
	foreignKeys: [
		{
			name: "fkQuestTagsQuest",
			keys: ["quest"],
			reference: {
				schema: "quest",
				table: "data",
				keys: ["id"],
			},
			definition: "ON UPDATE CASCADE ON DELETE RESTRICT",
		},
		{
			name: "fkQuestTagsTag",
			keys: ["tag"],
			reference: {
				schema: "quest",
				table: "tags",
				keys: ["key"],
			},
			definition: "ON UPDATE CASCADE ON DELETE RESTRICT",
		},
	],
} as const;
