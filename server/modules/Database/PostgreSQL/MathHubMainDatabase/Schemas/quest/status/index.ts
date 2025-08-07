import type { Table } from "../../../type.js";
import { DEFAULTS } from "./defaults.js";

export const STATUS: Table = {
	name: "status",
	columns: {
		key: {
			name: "key",
			type: "SMALLINT",
			definition: "PRIMARY KEY",
		},
		name: {
			name: "name",
			type: "TEXT",
			definition: "NOT NULL UNIQUE",
		},
	},
	defaults: DEFAULTS,
} as const;
