import type { Defaults } from "../../../type.js";

export const DEFAULTS: Defaults = [
	[
		{
			column: "key",
			value: "0",
		},
		{
			column: "name",
			value: "隱藏",
		},
	],
	[
		{
			column: "key",
			value: "1",
		},
		{
			column: "name",
			value: "公開",
		},
	],
] as const;
