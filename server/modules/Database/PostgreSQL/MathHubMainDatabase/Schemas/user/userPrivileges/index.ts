import type { Table } from "../../../type.js";
import { PRIVILEGES } from "../common/Columns/privileges.js";

export const USER_PRIVILEGES: Table = {
    name: "userPrivileges",
    columns: {
        id: {
            name: "id",
            type: "UUID",
            definition: "PRIMARY KEY",
        },
        group: {
            name: "group",
            type: "SMALLINT",
            definition: "NOT NULL DEFAULT 1",
        },
        ...PRIVILEGES,
    },
    foreignKeys: [
        {
            // biome-ignore lint/nursery/noSecrets: Foreign Key name is not a secret.
            name: "fkUserPrivilegesID",
            keys: ["id"],
            reference: {
                schema: "user",
                table: "data",
                keys: ["id"],
            },
            definition: "ON UPDATE CASCADE ON DELETE CASCADE",
        },
        {
            // biome-ignore lint/nursery/noSecrets: Foreign Key name is not a secret.
            name: "fkUserPrivilegesGroup",
            keys: ["group"],
            reference: {
                schema: "user",
                table: "groupPrivileges",
                keys: ["key"],
            },
            definition: "ON UPDATE RESTRICT ON DELETE RESTRICT",
        },
    ],
} as const;
