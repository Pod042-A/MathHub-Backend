import type { Schema } from "../../type.js";
import { DATA } from "./data/index.js";
import { QUEST_TAGS } from "./questTags/index.js";
import { STATUS } from "./status/index.js";
import { TAG_CATEGORIES } from "./tagCategories/index.js";
import { TAGS } from "./tags/index.js";

export const QUEST: Schema = {
	name: "quest",
	tables: {
		data: DATA,
		status: STATUS,
		tagCategories: TAG_CATEGORIES,
		tags: TAGS,
		questTags: QUEST_TAGS,
	},
} as const;
