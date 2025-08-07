import type { Table } from "../../../type.js";

export const DATA: Table = {
	name: "data",
	columns: {
		id: {
			name: "id",
			type: "UUID",
			definition: "PRIMARY KEY DEFAULT uuid_generate_v4()",
		},
		code: {
			name: "code",
			type: "TEXT",
			definition: "NOT NULL UNIQUE",
		},
		title: {
			name: "title",
			type: "TEXT",
			definition: "NOT NULL",
		},
		content: {
			name: "content",
			type: "TEXT",
		},
		imageURL: {
			name: "imageURL",
			type: "TEXT",
		},
		solution: {
			name: "solution",
			type: "TEXT",
		},
		questionVariable: {
			name: "questionVariable",
			type: "JSONB",
		},
		answerVariable: {
			name: "answerVariable",
			type: "JSONB",
			definition: "NOT NULL",
		},
		createdAt: {
			name: "createdAt",
			type: "TIMESTAMP",
			definition: "NOT NULL DEFAULT now()",
		},
		updatedAt: {
			name: "updatedAt",
			type: "TIMESTAMP",
			definition: "NOT NULL DEFAULT now()",
		},
		difficulty: {
			name: "difficulty",
			type: "SMALLINT",
			definition: "NOT NULL DEFAULT 1",
		},
		status: {
			name: "status",
			type: "SMALLINT",
			definition: "NOT NULL DEFAULT 0",
		},
		authorID: {
			name: "authorID",
			type: "UUID",
			definition: "NOT NULL",
		},
	},
	foreignKeys: [
		{
			// biome-ignore lint/nursery/noSecrets: Foreign Key name is not a secret.
			name: "fkQuestDataStatus",
			keys: ["status"],
			reference: {
				schema: "quest",
				table: "status",
				keys: ["key"],
			},
			definition: "ON UPDATE CASCADE ON DELETE RESTRICT",
		},
	],
} as const;
