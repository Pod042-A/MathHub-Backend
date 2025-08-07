import type { Schema } from "../../type.js";
import { NOTICE } from "./notice/index.js";
import { STATUS } from "./status/index.js";

export const NOTICEBOARD: Schema = {
    name: "noticeboard",
    tables: {
        notice: NOTICE,
        status: STATUS,
    },
} as const;
