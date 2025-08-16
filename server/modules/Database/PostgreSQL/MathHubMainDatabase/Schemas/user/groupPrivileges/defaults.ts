import type { Defaults } from "../../../type.js";
import { PRIVILEGES } from "../common/Columns/privileges.js";

export const DEFAULTS: Defaults = [
    [
        {
            column: "key",
            value: "1",
        },
        {
            column: "name",
            value: "普通用戶",
        },
        {
            column: "isActivated",
            value: "FALSE",
        },
        {
            column: "allowLogin",
            value: "TRUE",
        },
        {
            // biome-ignore lint/nursery/noSecrets: Column name is not a secret.
            column: "allowGetQuestList",
            value: "TRUE",
        },
        {
            // biome-ignore lint/nursery/noSecrets: Column name is not a secret.
            column: "allowGetQuestData",
            value: "TRUE",
        },
        {
            column: "allowCreateQuest",
            value: "FALSE",
        },
        {
            // biome-ignore lint/nursery/noSecrets: Column name is not a secret.
            column: "allowAnswerQuest",
            value: "TRUE",
        },
    ],
    [
        {
            column: "key",
            value: "100",
        },
        {
            column: "name",
            value: "管理員",
        },
        ...Object.values(PRIVILEGES).map((column) => {
            return { column: column.name, value: "TRUE" };
        }),
    ],
] as const;
