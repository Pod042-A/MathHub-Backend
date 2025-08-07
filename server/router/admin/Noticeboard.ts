import express, { type Router, type Request, type Response } from "express";
import { asyncRouterErrorHandler } from "../../handler/AsyncRouterErrorHandler.js";
import { accessTokenValidation } from "../../middleware/AccessTokenValidation.js";
import { Database } from "../../modules/Database/PostgreSQL/MathHubMainDatabase/index.js";
import { type JoinCondition, Query } from "../../modules/Database/PostgreSQL/Query.js";
import { HTTP_RESPONSE_STATUS_CODE } from "../../modules/Constant/HTTPResponseStatusCode/index.js";
import type { Column } from "../../modules/Database/PostgreSQL/MathHubMainDatabase/type.js";
import type { RequestBody, RequestQuery, RequestWithAccessToken } from "../../modules/types/Request/type.js";
import format from "pg-format";
import { HTTPError } from "../../modules/Error/HTTPError/index.js";

const ROUTER: Router = express.Router();

ROUTER.post(
    "/",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowCreateNotice.name]),
    asyncRouterErrorHandler(
        async (
            req: RequestWithAccessToken<
                RequestBody<{
                    title: string;
                    content: string;
                    scheduledAt?: number;
                    closedAt?: number;
                    order?: number;
                    status?: number;
                }>
            >,
            res: Response,
        ) => {
            const title: string | null = req.body.title.trim().length > 0 ? req.body.title : null;
            const content: string | null = req.body.content.trim().length > 0 ? req.body.content : null;
            let scheduledAt: number | null = null;
            let closedAt: number | null = null;
            let order: number | null = null;
            let status: number | null = null;

            if (!title) {
                throw new Error("Missing title");
            }

            if ("scheduledAt" in req.body) {
                if (typeof req.body.scheduledAt !== "number" || !Number.isInteger(req.body.scheduledAt)) {
                    throw new TypeError("Unexpected value of scheduledAt");
                }
                scheduledAt = req.body.scheduledAt;
            }

            if ("closedAt" in req.body) {
                if (typeof req.body.closedAt !== "number" || !Number.isInteger(req.body.closedAt)) {
                    throw new TypeError("Unexpected value of closedAt");
                }
                closedAt = req.body.closedAt;
            }

            if ("order" in req.body) {
                if (typeof req.body.order !== "number" || !Number.isInteger(req.body.order)) {
                    throw new TypeError("Unexpected value of order");
                }
                order = req.body.order;
            }

            if ("status" in req.body) {
                if (typeof req.body.status !== "number" || !Number.isInteger(req.body.status)) {
                    throw new TypeError("Unexpected value of status");
                }
                status = req.body.status;
            }

            const schemaNoticeboard = Database.schemas.noticeboard;
            const tableNotice = schemaNoticeboard.tables.notice;

            const ENTRIES = Array.from(
                new Map<string, unknown>([
                    [tableNotice.columns.scheduledAt.name, scheduledAt ? new Date(scheduledAt) : null],
                    [tableNotice.columns.closedAt.name, closedAt ? new Date(closedAt) : null],
                    [tableNotice.columns.status.name, status],
                    [tableNotice.columns.order.name, order],
                ]),
            ).filter((entry) => {
                if (typeof entry[1] === "string") {
                    return entry[1].trim().length > 0;
                }
                return entry[1] !== null;
            });
            let argsIndex = 4;
            const COLUMN: string = ENTRIES.map((entry) => format.ident(entry[0])).join(", ");
            const ARGS: string = ENTRIES.map(() => `$${argsIndex++}`).join(", ");

            await Database.pool.query(
                format(
                    "INSERT INTO %I.%I (%I, %I, %I%s) VALUES ($1, $2, $3%s)",
                    schemaNoticeboard.name,
                    tableNotice.name,
                    tableNotice.columns.title.name,
                    tableNotice.columns.content.name,
                    tableNotice.columns.authorID.name,
                    COLUMN.trim().length > 0 ? `, ${COLUMN}` : "",
                    ARGS.trim().length > 0 ? `, ${ARGS}` : "",
                ),
                [
                    title,
                    content ?? null,
                    req.accessToken.payloadEntity.sub,
                    ...ENTRIES.map((entry) => entry[1]),
                ],
            );

            res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.created).json({
                message: "操作成功",
                success: true,
                data: {},
            });
            return;
        },
    ),
);

ROUTER.get(
    "/",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowGetNoticeData.name]),
    asyncRouterErrorHandler(async (req: RequestQuery<{ q: string }>, res: Response) => {
        const PARAMS = JSON.parse(decodeURIComponent(req.query.q));

        const schemaNoticeboard = Database.schemas.noticeboard;
        const tableNotice = schemaNoticeboard.tables.notice;
        const schemaNoticeboardAlias: string = "n";

        const schemaUser = Database.schemas.user;
        const tableData = schemaUser.tables.data;
        const schemaUserAlias: string = "u";

        const joins: JoinCondition[] = [
            {
                type: "INNER",
                schema: schemaUser,
                table: tableData,
                origin: { alias: schemaNoticeboardAlias, key: tableNotice.columns.authorID },
                reference: { alias: schemaUserAlias, key: tableData.columns.id },
            },
        ];
        const requires: (Column & { alias: string })[] = [
            { ...tableData.columns.id, alias: schemaUserAlias },
            { ...tableData.columns.username, alias: schemaUserAlias },
            { ...tableData.columns.email, alias: schemaUserAlias },
        ];

        const QUERY: Query = new Query(
            schemaNoticeboard,
            tableNotice,
            schemaNoticeboardAlias,
            Object.values(tableNotice.columns),
            PARAMS,
            joins,
            requires,
        );

        const RESULT = await Database.pool.query(QUERY.toSQL());
        if (RESULT.rowCount === null) {
            throw new HTTPError(
                HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError,
                "Unknown database query error",
            );
        }

        const data = Array.from(RESULT.rows).map((row) => {
            const author: Map<string, unknown> = new Map();
            const obj: Map<string, unknown> = new Map();

            for (const require of QUERY.requires ?? []) {
                const COLUMN_NAME = `${require.alias}_${require.name}`;
                let value = row[COLUMN_NAME];

                // biome-ignore lint/nursery/noMagicNumbers: Data type ID of Timestamp
                if (RESULT.fields.find((field) => field.name === COLUMN_NAME)?.dataTypeID === 1114) {
                    value = new Date(value).getTime();
                }

                if (require.alias === schemaUserAlias) {
                    author.set(require.name, value);
                }
                if (require.alias === schemaNoticeboardAlias) {
                    obj.set(require.name, value);
                }
            }

            for (const column of QUERY.columns) {
                const COLUMN_NAME = `${QUERY.alias}_${column}`;
                let value = row[COLUMN_NAME];

                // biome-ignore lint/nursery/noMagicNumbers: Data type ID of Timestamp
                if (RESULT.fields.find((field) => field.name === COLUMN_NAME)?.dataTypeID === 1114) {
                    value = new Date(value).getTime();
                }

                obj.set(column, value);
            }

            obj.set("author", Object.fromEntries(author));
            return Object.fromEntries(obj);
        });

        res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok).json({
            message: "成功獲取公告列表",
            data,
        });
        return;
    }),
);

ROUTER.get(
    "/:id",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowGetNoticeData.name]),
    asyncRouterErrorHandler(async (req: Request, res: Response) => {
        const NOTICE_ID: string = req.params.id;

        const schemaNoticeboard = Database.schemas.noticeboard;
        const tableNotice = schemaNoticeboard.tables.notice;

        const schemaUser = Database.schemas.user;
        const tableData = schemaUser.tables.data;

        const RESULT = await Database.pool.query(
            format(
                "SELECT n.*, u.%I, u.%I FROM %I.%I AS n JOIN %I.%I AS u ON u.%I = n.%I WHERE n.%I = $1",
                tableData.columns.username.name,
                tableData.columns.email.name,
                schemaNoticeboard.name,
                tableNotice.name,
                schemaUser.name,
                tableData.name,
                tableData.columns.id.name,
                tableNotice.columns.authorID.name,
                tableNotice.columns.id.name,
            ),
            [NOTICE_ID],
        );
        if (RESULT.rowCount === null) {
            throw new HTTPError(
                HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError,
                "Unknown database query error",
            );
        }
        if (RESULT.rowCount === 0) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.notFound);
        }

        const author: Map<string, unknown> = new Map();
        const obj: Map<string, unknown> = new Map();

        for (const entry of Object.entries(RESULT.rows[0])) {
            let value = entry[1];

            // biome-ignore lint/nursery/noMagicNumbers: Data type ID of Timestamp
            if (RESULT.fields.find((field) => field.name === entry[0])?.dataTypeID === 1114) {
                value = new Date(value as string).getTime();
            }

            if ([tableData.columns.username.name, tableData.columns.email.name].includes(entry[0])) {
                author.set(entry[0], value);
            } else if (entry[0] === tableNotice.columns.authorID.name) {
                author.set("id", value);
            } else {
                obj.set(entry[0], value);
            }
        }

        obj.set("author", Object.fromEntries(author));
        const data = Object.fromEntries(obj);

        res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok).json({
            message: "操作成功",
            data,
        });
        return;
    }),
);

ROUTER.patch(
    "/:id",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowEditNotice.name]),
    asyncRouterErrorHandler(
        async (
            req: RequestWithAccessToken<
                RequestBody<{
                    title: string;
                    content: string;
                    scheduledAt?: number;
                    closedAt?: number;
                    order?: number;
                    status?: number;
                }>
            >,
            res: Response,
        ) => {
            const NOTICE_ID: string = req.params.id;

            const title: string | null = req.body.title.trim().length > 0 ? req.body.title : null;
            const content: string | null = req.body.content.trim().length > 0 ? req.body.content : null;
            let scheduledAt: number | null = null;
            let closedAt: number | null = null;
            let order: number | null = null;
            let status: number | null = null;

            if (!title) {
                throw new Error("Missing title");
            }

            if ("scheduledAt" in req.body) {
                if (typeof req.body.scheduledAt !== "number" || !Number.isInteger(req.body.scheduledAt)) {
                    throw new TypeError("Unexpected value of scheduledAt");
                }
                scheduledAt = req.body.scheduledAt;
            }

            if ("closedAt" in req.body) {
                if (typeof req.body.closedAt !== "number" || !Number.isInteger(req.body.closedAt)) {
                    throw new TypeError("Unexpected value of closedAt");
                }
                closedAt = req.body.closedAt;
            }

            if ("order" in req.body) {
                if (typeof req.body.order !== "number" || !Number.isInteger(req.body.order)) {
                    throw new TypeError("Unexpected value of order");
                }
                order = req.body.order;
            }

            if ("status" in req.body) {
                if (typeof req.body.status !== "number" || !Number.isInteger(req.body.status)) {
                    throw new TypeError("Unexpected value of status");
                }
                status = req.body.status;
            }

            const schemaNoticeboard = Database.schemas.noticeboard;
            const tableNotice = schemaNoticeboard.tables.notice;

            const ENTRIES = Array.from(
                new Map<string, unknown>([
                    [tableNotice.columns.scheduledAt.name, scheduledAt ? new Date(scheduledAt) : null],
                    [tableNotice.columns.closedAt.name, closedAt ? new Date(closedAt) : null],
                    [tableNotice.columns.status.name, status],
                    [tableNotice.columns.order.name, order],
                ]),
            ).filter((entry) => {
                if (typeof entry[1] === "string") {
                    return entry[1].trim().length > 0;
                }
                return entry[1] !== null;
            });
            let argsIndex = 4;
            const COLUMN: string = ENTRIES.map((entry) => `${format.ident(entry[0])} = $${argsIndex++}`).join(
                ", ",
            );

            await Database.pool.query(
                format(
                    `UPDATE %I.%I SET %I = $1, %I = $2, %I = $3, %I = NOW()%s WHERE %I = $${argsIndex++}`,
                    schemaNoticeboard.name,
                    tableNotice.name,
                    tableNotice.columns.title.name,
                    tableNotice.columns.content.name,
                    tableNotice.columns.authorID.name,
                    tableNotice.columns.updatedAt.name,
                    COLUMN.trim().length > 0 ? `, ${COLUMN}` : "",
                    tableNotice.columns.id.name,
                ),
                [
                    title,
                    content ?? null,
                    req.accessToken.payloadEntity.sub,
                    ...ENTRIES.map((entry) => entry[1]),
                    NOTICE_ID,
                ],
            );

            res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.created).json({
                message: "操作成功",
                success: true,
                data: {},
            });
            return;
        },
    ),
);

ROUTER.delete(
    "/:id",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowDeleteNotice.name]),
    asyncRouterErrorHandler(async (req: Request, res: Response) => {
        const NOTICE_ID: string = req.params.id;

        const schemaNoticeboard = Database.schemas.noticeboard;
        const tableNotice = schemaNoticeboard.tables.notice;

        await Database.pool.query(
            format(
                "DELETE FROM %I.%I WHERE %I = $1",
                schemaNoticeboard.name,
                tableNotice.name,
                tableNotice.columns.id.name,
            ),
            [NOTICE_ID],
        );

        res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.created).json({
            message: "操作成功",
            success: true,
            data: {},
        });
        return;
    }),
);

export { ROUTER };
