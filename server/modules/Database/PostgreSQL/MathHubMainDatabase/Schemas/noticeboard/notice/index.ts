import type { Table } from "../../../type.js";
// TODO: edit
export const NOTICE: Table = {
    name: "notice",
    columns: {
        id: {
            name: "id",
            type: "UUID",
            definition: "PRIMARY KEY DEFAULT uuid_generate_v4()",
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
        scheduledAt: {
            name: "scheduledAt",
            type: "TIMESTAMP",
            definition: "NOT NULL DEFAULT now()",
        },
        closedAt: {
            name: "closedAt",
            type: "TIMESTAMP",
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
        order: {
            name: "order",
            type: "SMALLINT",
            definition: "NOT NULL DEFAULT 0",
        },
    },
    foreignKeys: [
        {
            // biome-ignore lint/nursery/noSecrets: Foreign Key name is not a secret.
            name: "fkNoticeStatus",
            keys: ["status"],
            reference: {
                schema: "noticeboard",
                table: "status",
                keys: ["key"],
            },
            definition: "ON UPDATE CASCADE ON DELETE RESTRICT",
        },
    ],
} as const;
