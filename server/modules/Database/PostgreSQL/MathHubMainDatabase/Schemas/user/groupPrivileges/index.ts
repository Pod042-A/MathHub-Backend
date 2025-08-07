import type { Table } from "../../../type.js";
import { PRIVILEGES } from "../.common/Columns/privileges.js";
import { DEFAULTS } from "./defaults.js";

export const GROUP_PRIVILEGES: Table = {
    name: "groupPrivileges",
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
        ...Object.fromEntries(
            Object.entries(PRIVILEGES).map(([key, value]) => [
                key,
                { name: value.name, type: value.type, definition: "NOT NULL DEFAULT FALSE" },
            ]),
        ),
    },
    defaults: DEFAULTS,
} as const;
