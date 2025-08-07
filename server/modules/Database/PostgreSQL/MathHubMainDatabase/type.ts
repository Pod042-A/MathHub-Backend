type Column = {
    name: string;
    type: string;
    definition?: string;
};

function isValidColumn(obj: unknown): obj is Column {
    return (
        obj !== undefined &&
        obj !== null &&
        typeof obj === "object" &&
        "name" in obj &&
        typeof obj.name === "string" &&
        obj.name.trim().length > 0 &&
        "type" in obj &&
        typeof obj.type === "string" &&
        obj.type.trim().length > 0 &&
        (!("definition" in obj) || ("definition" in obj && typeof obj.definition === "string"))
    );
}

type ForeignKey = {
    name: string;
    keys: string[];
    reference: {
        schema: string;
        table: string;
        keys: string[];
    };
    definition?: string;
};

function isValidForeignKey(obj: unknown): obj is ForeignKey {
    return (
        obj !== undefined &&
        obj !== null &&
        typeof obj === "object" &&
        "name" in obj &&
        typeof obj.name === "string" &&
        obj.name.trim().length > 0 &&
        "keys" in obj &&
        Array.isArray(obj.keys) &&
        obj.keys.every((value: unknown) => typeof value === "string" && value.trim().length > 0) &&
        "reference" in obj &&
        obj.reference !== undefined &&
        obj.reference !== null &&
        typeof obj.reference === "object" &&
        "schema" in obj.reference &&
        typeof obj.reference.schema === "string" &&
        obj.reference.schema.trim().length > 0 &&
        "table" in obj.reference &&
        typeof obj.reference.table === "string" &&
        obj.reference.table.trim().length > 0 &&
        "keys" in obj.reference &&
        Array.isArray(obj.reference.keys) &&
        obj.reference.keys.every((value: unknown) => typeof value === "string" && value.trim().length > 0) &&
        (!("definition" in obj) || ("definition" in obj && typeof obj.definition === "string"))
    );
}

type Defaults = { column: string; value: string }[][];

function isValidDefaults(obj: unknown): obj is Defaults {
    return (
        Array.isArray(obj) &&
        obj.every(
            (row: unknown) =>
                Array.isArray(row) &&
                row.every(
                    (entry: unknown) =>
                        entry !== undefined &&
                        entry !== null &&
                        typeof entry === "object" &&
                        "column" in entry &&
                        typeof entry.column === "string" &&
                        entry.column.trim().length > 0 &&
                        "value" in entry &&
                        typeof entry.value === "string" &&
                        entry.value.trim().length > 0,
                ),
        )
    );
}

type Table = {
    name: string;
    columns: Record<string, Column>;
    foreignKeys?: ForeignKey[];
    defaults?: Defaults;
};

function isValidTable(obj: unknown): obj is Table {
    return (
        obj !== undefined &&
        obj !== null &&
        typeof obj === "object" &&
        "name" in obj &&
        typeof obj.name === "string" &&
        obj.name.trim().length > 0 &&
        "columns" in obj &&
        obj.columns !== undefined &&
        obj.columns !== null &&
        typeof obj.columns === "object" &&
        Object.values(obj.columns).every((value: unknown) => isValidColumn(value)) &&
        (!("foreignKeys" in obj) ||
            ("foreignKeys" in obj &&
                Array.isArray(obj.foreignKeys) &&
                obj.foreignKeys.every((value: unknown) => isValidForeignKey(value)))) &&
        (!("defaults" in obj) || ("defaults" in obj && isValidDefaults(obj.defaults)))
    );
}

type Schema = {
    name: string;
    tables: Record<string, Table>;
};

function isValidSchema(obj: unknown): obj is Schema {
    return (
        obj !== undefined &&
        obj !== null &&
        typeof obj === "object" &&
        "name" in obj &&
        typeof obj.name === "string" &&
        obj.name.trim().length > 0 &&
        "tables" in obj &&
        obj.tables !== undefined &&
        obj.tables !== null &&
        typeof obj.tables === "object" &&
        Object.values(obj.tables).every((value: unknown) => isValidTable(value))
    );
}

export { type Column, isValidColumn, type Defaults, type Table, isValidTable, type Schema, isValidSchema };
