import type { Defaults } from "../../../type.js";

const DEFAULTS: Defaults = [
    [
        {
            column: "key",
            value: "0",
        },
        {
            column: "name",
            value: "草稿",
        },
        {
            column: "value",
            value: "draft",
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
        {
            column: "value",
            value: "publish",
        },
    ],
] as const;

export { DEFAULTS };
