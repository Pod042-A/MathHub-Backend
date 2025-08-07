import { Database } from "./MathHubMainDatabase/index.js";
import format from "pg-format";
import {
    type Column,
    isValidColumn,
    isValidSchema,
    isValidTable,
    type Schema,
    type Table,
} from "./MathHubMainDatabase/type.js";

type JoinCondition = {
    type: "INNER" | "LEFT" | "RIGHT" | "FULL";
    schema: Schema;
    table: Table;
    origin: {
        alias: string;
        key: Column;
    };
    reference: {
        alias: string;
        key: Column;
    };
};

function isValidJoinCondition(obj: unknown): obj is JoinCondition {
    return (
        obj !== undefined &&
        obj !== null &&
        typeof obj === "object" &&
        "type" in obj &&
        typeof obj.type === "string" &&
        ["INNER", "LEFT", "RIGHT", "FULL"].includes(obj.type) &&
        "schema" in obj &&
        isValidSchema(obj.schema) &&
        "table" in obj &&
        isValidTable(obj.table) &&
        "origin" in obj &&
        obj.origin !== undefined &&
        obj.origin !== null &&
        typeof obj.origin === "object" &&
        "alias" in obj.origin &&
        typeof obj.origin.alias === "string" &&
        obj.origin.alias.trim().length > 0 &&
        "key" in obj.origin &&
        isValidColumn(obj.origin.key) &&
        "reference" in obj &&
        obj.reference !== undefined &&
        obj.reference !== null &&
        typeof obj.reference === "object" &&
        "alias" in obj.reference &&
        typeof obj.reference.alias === "string" &&
        obj.reference.alias.trim().length > 0 &&
        "key" in obj.reference &&
        isValidColumn(obj.reference.key)
    );
}

type FilterCondition =
    | { column: string; operator: "IN"; value: (string | number | boolean)[] }
    | {
          column: string;
          operator: "=" | "!=" | "<" | "<=" | ">" | ">=" | "LIKE" | "ILIKE";
          value: string | number | boolean;
      }
    | { column: string; operator: "IS" | "NOT"; value: "NULL" };

function isValidFilterCondition(obj: unknown): obj is FilterCondition {
    return (
        obj !== undefined &&
        obj !== null &&
        typeof obj === "object" &&
        "column" in obj &&
        typeof obj.column === "string" &&
        obj.column.trim().length > 0 &&
        "operator" in obj &&
        typeof obj.operator === "string" &&
        "value" in obj &&
        ((obj.operator === "IN" &&
            Array.isArray(obj.value) &&
            obj.value.every(
                (value: unknown) =>
                    (typeof value === "string" && value.trim().length > 0) ||
                    typeof value === "number" ||
                    typeof value === "boolean",
            )) ||
            (["=", "!=", "<", "<=", ">", ">=", "LIKE", "ILIKE"].includes(obj.operator) &&
                ((typeof obj.value === "string" && obj.value.trim().length > 0) ||
                    typeof obj.value === "number" ||
                    typeof obj.value === "boolean")) ||
            (["IS", "NOT"].includes(obj.operator) && obj.value === "NULL"))
    );
}

type FilterNode =
    | { type: "condition"; condition: FilterCondition }
    | { type: "group"; operator: "AND" | "OR"; condition: FilterNode[] };

function isValidFilterNode(obj: unknown): obj is FilterNode {
    return (
        obj !== undefined &&
        obj !== null &&
        typeof obj === "object" &&
        "type" in obj &&
        typeof obj.type === "string" &&
        "condition" in obj &&
        ((obj.type === "condition" && isValidFilterCondition(obj.condition)) ||
            (obj.type === "group" &&
                "operator" in obj &&
                typeof obj.operator === "string" &&
                ["AND", "OR"].includes(obj.operator) &&
                Array.isArray(obj.condition) &&
                obj.condition.every((value: unknown) => isValidFilterNode(value))))
    );
}

function parseFilter(node: FilterNode, alias: string): string {
    if (node.type === "condition") {
        const COLUMN = node.condition.column;
        const OPERATOR = node.condition.operator;
        const VALUE = node.condition.value;

        if (OPERATOR === "IN" && Array.isArray(VALUE)) {
            if (VALUE.length === 0) {
                return "(FALSE)";
            }
            return format(`(%I.%I IN (${VALUE.map(() => "%L").join(", ")}))`, alias, COLUMN, ...VALUE);
        }

        if ((OPERATOR === "IS" || OPERATOR === "NOT") && VALUE === "NULL") {
            return format("(%I.%I IS%s NULL)", alias, COLUMN, OPERATOR === "NOT" ? " NOT" : "");
        }

        return format("(%I.%I %s %L)", alias, COLUMN, OPERATOR, VALUE);
    }

    if (node.type === "group") {
        return `(${node.condition.map((value) => parseFilter(value, alias)).join(` ${node.operator} `)})`;
    }

    throw new Error("Unexpected error when parsing SQL filter");
}

type OrderCondition = {
    column: string;
    direction: "ASC" | "DESC";
    nulls?: "FIRST" | "LAST";
};

function isValidOrderCondition(obj: unknown): obj is OrderCondition {
    return (
        obj !== undefined &&
        obj !== null &&
        typeof obj === "object" &&
        "column" in obj &&
        typeof obj.column === "string" &&
        obj.column.trim().length > 0 &&
        "direction" in obj &&
        typeof obj.direction === "string" &&
        ["ASC", "DESC"].includes(obj.direction) &&
        (!("nulls" in obj) ||
            ("nulls" in obj && typeof obj.nulls === "string" && ["FIRST", "LAST"].includes(obj.nulls)))
    );
}

function parseOrder(orders: OrderCondition[]): string {
    return orders
        .map((order) =>
            format("%I %s%s", order.column, order.direction, order.nulls ? ` NULLS ${order.nulls}` : ""),
        )
        .join(", ");
}

type QueryObject = {
    columns: string[];
    filters?: FilterNode;
    orders?: OrderCondition[];
    limit?: number;
    offset?: number;
};

class Query {
    private static readonly defaultLimit: number = 10;

    /**
     * @description 查詢的 Schema。為確保 _schema 為有效的 Schema 值，因此使用 Schema 類型定義。
     */
    private _schema: Schema;
    /**
     * @description 查詢的 Table。為確保 _table 為有效的 Table 值，因此使用 Table 類型定義。
     */
    private _table: Table;
    /**
     * @description 資料表別名。確保欄位不會與 JOIN 的資料表中的欄位名稱重複。
     */
    private _alias: string;
    /**
     * @description 允許的資料庫欄位。為確保 _scope 為有效的 Column 值，因此使用 Column 類型定義。
     */
    private _scope: Column[];
    /**
     * @description 必要的資料庫欄位。
     */
    private _requires: (Column & { alias: string })[] | null;

    private _columns: string[];
    private _joins: JoinCondition[] | null;
    private _filters: FilterNode | null;
    private _orders: OrderCondition[] | null;
    private _limit: number | null;
    private _offset: number | null;

    public constructor(
        schema: Schema,
        table: Table,
        alias: string,
        scope: Column[],
        obj: unknown,
        joins?: JoinCondition[],
        requires?: (Column & { alias: string })[],
    ) {
        // TODO: To Formalize error types

        if (!Query.isValid(obj)) {
            throw new TypeError("Invalid object for Query object");
        }
        if (!isValidSchema(schema)) {
            throw new TypeError("Invalid schema for Query object");
        }
        if (!isValidTable(table)) {
            throw new TypeError("Invalid table for Query object");
        }
        if (alias.trim().length === 0) {
            throw new Error("Invalid alias for Query object");
        }
        if (!scope.every((value) => isValidColumn(value))) {
            throw new TypeError("Invalid scope for Query object");
        }

        const VALID_COLUMNS: string[] = Object.values(table.columns).map((value) => value.name);
        const VALID_SCOPE: string[] = Object.values(scope)
            .filter((value) => VALID_COLUMNS.includes(value.name))
            .map((value) => value.name);

        if (VALID_SCOPE.length === 0) {
            throw new Error("Invalid scope for Query object");
        }
        if (!obj.columns.every((value) => VALID_SCOPE.includes(value))) {
            throw new Error("Invalid columns for Query object");
        }
        const isFiltersColumnValid = (node: FilterNode): boolean => {
            if (node.type === "condition") {
                return VALID_SCOPE.includes(node.condition.column);
            }

            if (node.type === "group") {
                return node.condition.every((value) => isFiltersColumnValid(value));
            }

            throw new Error("Unexpected error in Query object");
        };
        if (obj.filters && !isFiltersColumnValid(obj.filters)) {
            throw new Error("Column name of filter conditions not in scope");
        }
        if (obj.orders && !obj.orders.every((value) => VALID_SCOPE.includes(value.column))) {
            throw new Error("Invalid order columns for Query object");
        }

        const VALID_ALIAS: Map<string, string> = new Map([[alias, schema.name]]);

        if (joins) {
            for (const value of joins) {
                if (!isValidJoinCondition(value)) {
                    throw new TypeError("Invalid join conditions for Query object");
                }

                if (!VALID_ALIAS.has(value.origin.alias)) {
                    throw new Error("Alias of join condition not found");
                }

                if (
                    VALID_ALIAS.has(value.reference.alias) &&
                    value.schema.name !== VALID_ALIAS.get(value.reference.alias)
                ) {
                    throw new Error("Alias of join condition conflicts");
                }

                if (!VALID_ALIAS.has(value.reference.alias)) {
                    VALID_ALIAS.set(value.reference.alias, value.schema.name);
                }
            }
        }

        if (requires) {
            for (const value of requires) {
                if (
                    !(
                        isValidColumn(value) &&
                        "alias" in value &&
                        typeof value.alias === "string" &&
                        value.alias.trim().length > 0
                    )
                ) {
                    throw new TypeError("Invalid require columns for Query object");
                }

                if (!VALID_ALIAS.has(value.alias)) {
                    throw new Error("Alias of require columns not found");
                }
            }
        }

        this._schema = schema;
        this._table = table;
        this._alias = alias;
        this._scope = scope;
        this._requires = requires && requires.length > 0 ? requires : null;

        this._columns = obj.columns;
        this._joins = joins ?? null;
        this._filters = obj.filters ?? null;
        this._orders = obj.orders ?? null;
        this._limit = obj.limit ?? null;
        this._offset = obj.offset ?? null;
    }

    public get alias(): string {
        return this._alias;
    }

    public get requires(): (Column & { alias: string })[] | null {
        return this._requires;
    }

    public get columns(): string[] {
        return this._columns;
    }

    public static isValid(obj: unknown): obj is QueryObject {
        return (
            obj !== undefined &&
            obj !== null &&
            typeof obj === "object" &&
            "columns" in obj &&
            Array.isArray(obj.columns) &&
            obj.columns.every((value: unknown) => typeof value === "string" && value.trim().length > 0) &&
            (!("filters" in obj) || ("filters" in obj && isValidFilterNode(obj.filters))) &&
            (!("orders" in obj) ||
                ("orders" in obj &&
                    Array.isArray(obj.orders) &&
                    obj.orders.every((value: unknown) => isValidOrderCondition(value)))) &&
            (!("limit" in obj) ||
                ("limit" in obj &&
                    typeof obj.limit === "number" &&
                    Number.isInteger(obj.limit) &&
                    obj.limit >= 0)) &&
            (!("offset" in obj) ||
                ("offset" in obj &&
                    typeof obj.offset === "number" &&
                    Number.isInteger(obj.offset) &&
                    obj.offset >= 0))
        );
    }

    public toSQL(): string {
        const COLUMNS = Array.from(
            new Set(
                this._columns
                    .map((column) => format("%I.%I AS %I", this._alias, column, `${this._alias}_${column}`))
                    .concat(
                        this._requires
                            ? this._requires.map((require) =>
                                  format(
                                      "%I.%I AS %I",
                                      require.alias,
                                      require.name,
                                      `${require.alias}_${require.name}`,
                                  ),
                              )
                            : [],
                    ),
            ),
        ).join(", ");

        let sql: string = format(
            "SELECT %s FROM %I.%I AS %I",
            COLUMNS,
            this._schema.name,
            this._table.name,
            this._alias,
        );

        if (this._joins) {
            sql = `${sql} ${this._joins.map((join) => format("%s JOIN %I.%I AS %I ON %I.%I = %I.%I", join.type, join.schema.name, join.table.name, join.reference.alias, join.origin.alias, join.origin.key.name, join.reference.alias, join.reference.key.name)).join(" ")}`;
        }

        if (this._filters) {
            sql = `${sql} WHERE ${parseFilter(this._filters, this._alias)}`;
        }

        if (this._orders) {
            sql = `${sql} ORDER BY ${parseOrder(this._orders)}`;
        }

        sql = `${sql} LIMIT ${this._limit ?? Query.defaultLimit}`;

        if (this._offset !== null) {
            sql = `${sql} OFFSET ${this._offset}`;
        }

        return sql;
    }
}

export { Query, type JoinCondition };
