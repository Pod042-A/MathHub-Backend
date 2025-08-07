import type { Table } from "../../../type.js";

export const DATA: Table = {
    name: "data",
    columns: {
        id: {
            name: "id",
            type: "UUID",
            definition: "PRIMARY KEY DEFAULT uuid_generate_v4()",
        },
        username: {
            name: "username",
            type: "TEXT",
            definition: "NOT NULL",
        },
        email: {
            name: "email",
            type: "TEXT",
            definition: "NOT NULL UNIQUE",
        },
        hashedPassword: {
            name: "hashedPassword",
            type: "BYTEA",
        },
        salt: {
            name: "salt",
            type: "BYTEA",
        },
        birthday: {
            name: "birthday",
            type: "TIMESTAMP",
        },
        grade: {
            name: "grade",
            type: "TEXT",
        },
        registeredAt: {
            name: "registeredAt",
            type: "TIMESTAMP",
            definition: "NOT NULL DEFAULT now()",
        },
        lastLoginAt: {
            name: "lastLoginAt",
            type: "TIMESTAMP",
            definition: "NOT NULL DEFAULT now()",
        },
        google: {
            name: "google",
            type: "TEXT",
        },
        github: {
            name: "github",
            type: "TEXT",
        },
    },
} as const;
