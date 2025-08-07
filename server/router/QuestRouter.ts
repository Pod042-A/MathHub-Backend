import express, { type Router, type Request, type Response } from "express";
import { HTTPError } from "../modules/Error/HTTPError/index.js";
import { HTTP_RESPONSE_STATUS_CODE } from "../modules/Constant/HTTPResponseStatusCode/index.js";
import type { QueryResult } from "pg";
import type { RequestBody, RequestQuery, RequestWithAccessToken } from "../modules/types/Request/type.js";
import { asyncRouterErrorHandler } from "../handler/AsyncRouterErrorHandler.js";
import format from "pg-format";
import { QuestInput, type APIObject as QuestInputAPIObject } from "../modules/Quest/QuestInput.js";
import { QuestOutput } from "../modules/Quest/QuestOutput.js";
import {
    AnswerVariable,
    type APIObject as AnswerVariableAPIObject,
} from "../modules/Quest/AnswerVariable.js";
import { Database } from "../modules/Database/PostgreSQL/MathHubMainDatabase/index.js";
import { accessTokenValidation } from "../middleware/AccessTokenValidation.js";
import { type JoinCondition, Query } from "../modules/Database/PostgreSQL/Query.js";
import type { Column } from "../modules/Database/PostgreSQL/MathHubMainDatabase/type.js";

const ROUTER: Router = express.Router();

ROUTER.post(
    "/",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowCreateQuest.name]),
    asyncRouterErrorHandler(
        async (req: RequestWithAccessToken<RequestBody<QuestInputAPIObject>>, res: Response) => {
            const QUEST_INPUT: QuestInput = new QuestInput(req.body);

            const POOL = Database.pool;
            const schemaQuest = Database.schemas.quest;
            const tableData = schemaQuest.tables.data;

            const CLIENT = await POOL.connect();

            try {
                await CLIENT.query("BEGIN");

                const ENTRIES = Array.from(
                    new Map<string, unknown>([
                        [tableData.columns.content.name, QUEST_INPUT.content],
                        [tableData.columns.imageURL.name, QUEST_INPUT.imageURL],
                        [tableData.columns.solution.name, QUEST_INPUT.solution],
                        [
                            tableData.columns.questionVariable.name,
                            JSON.stringify(QUEST_INPUT.questionVariable),
                        ],
                        [tableData.columns.difficulty.name, QUEST_INPUT.difficulty],
                        [tableData.columns.status.name, QUEST_INPUT.status],
                    ]),
                ).filter((entry) => {
                    if (typeof entry[1] === "string") {
                        return entry[1].trim().length > 0;
                    }
                    return entry[1] !== null;
                });
                let argsIndex = 5;
                const COLUMN: string = ENTRIES.map((entry) => format.ident(entry[0])).join(", ");
                const ARGS: string = ENTRIES.map(() => `$${argsIndex++}`).join(", ");

                const RESULT: QueryResult = await CLIENT.query(
                    format(
                        `INSERT INTO %I.%I (%I, %I, %I, %I%s)
						VALUES ($1, $2, $3, $4%s) RETURNING %I`,
                        schemaQuest.name,
                        tableData.name,
                        tableData.columns.code.name,
                        tableData.columns.title.name,
                        tableData.columns.answerVariable.name,
                        tableData.columns.authorID.name,
                        COLUMN.trim().length > 0 ? `, ${COLUMN}` : "",
                        ARGS.trim().length > 0 ? `, ${ARGS}` : "",
                        tableData.columns.id.name,
                    ),
                    [
                        QUEST_INPUT.code,
                        QUEST_INPUT.title,
                        JSON.stringify(QUEST_INPUT.answerVariable),
                        req.accessToken.payloadEntity.sub,
                        ...ENTRIES.map((entry) => entry[1]),
                    ],
                );

                if (QUEST_INPUT.tags.length > 0) {
                    const tableQuestTags = schemaQuest.tables.questTags;
                    const QUEST_ID: string = RESULT.rows[0][tableData.columns.id.name];

                    await CLIENT.query(
                        format(
                            "INSERT INTO %I.%I (%I, %I) VALUES %L",
                            schemaQuest.name,
                            tableQuestTags.name,
                            tableQuestTags.columns.quest.name,
                            tableQuestTags.columns.tag.name,
                            QUEST_INPUT.tags.map((value) => [QUEST_ID, value]),
                        ),
                    );
                }

                await CLIENT.query("COMMIT");

                res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.created).json({
                    message: "操作成功",
                    data: {},
                });
                return;
            } catch (error) {
                await CLIENT.query("ROLLBACK");
                throw error;
            } finally {
                CLIENT.release();
            }
        },
    ),
);

/**
 * 取得題目列表
 */
// FIXME: Query Tags
ROUTER.get(
    "/",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowGetQuestData.name]),
    asyncRouterErrorHandler(async (req: RequestQuery<{ q: string }>, res: Response) => {
        // 查詢題目資料
        const PARAMS = JSON.parse(decodeURIComponent(req.query.q));

        const POOL = Database.pool;

        const schemaQuest = Database.schemas.quest;
        const tableQuestData = schemaQuest.tables.data;
        const schemaQuestAlias = "q";

        const schemaUser = Database.schemas.user;
        const tableUserData = schemaUser.tables.data;
        const schemaUserAlias = "u";

        const joins: JoinCondition[] = [
            {
                type: "INNER",
                schema: schemaUser,
                table: tableUserData,
                origin: { alias: schemaQuestAlias, key: tableQuestData.columns.authorID },
                reference: { alias: schemaUserAlias, key: tableUserData.columns.id },
            },
        ];
        const requires: (Column & { alias: string })[] = [
            { ...tableUserData.columns.id, alias: schemaUserAlias },
            { ...tableUserData.columns.username, alias: schemaUserAlias },
            { ...tableUserData.columns.email, alias: schemaUserAlias },
        ];

        const QUERY: Query = new Query(
            schemaQuest,
            tableQuestData,
            schemaQuestAlias,
            Object.values(tableQuestData.columns),
            PARAMS,
            joins,
            requires,
        );

        const RESULT: QueryResult = await POOL.query(QUERY.toSQL());
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
                if (require.alias === schemaQuestAlias) {
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
            message: "操作成功",
            data,
        });
        return;
    }),
);

/**
 * 取得題目資料
 */
/*
ROUTER.get(
    "/:id",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowGetQuestData.name]),
    asyncRouterErrorHandler(async (req: Request, res: Response) => {
        // 查詢題目內容
        const QUEST_ID: string = req.params.id;

        const POOL = Database.pool;
        const schemaUser = Database.schemas.user;
        const tableUserData = schemaUser.tables.data;
        const schemaQuest = Database.schemas.quest;
        const tableQuestData = schemaQuest.tables.data;
        const tableQuestTags = schemaQuest.tables.questTags;

        // LABEL: query author data
        const RESULT: QueryResult = await POOL.query(
            format(
                `SELECT q.*,  COALESCE(qt.tags, ARRAY[]::smallint[]) AS "tags"
                FROM %I.%I q
                JOIN %I.%I u ON q.%I = u.%I
                LEFT JOIN LATERAL (
                    SELECT ARRAY_AGG(qt.%I) AS tags
                    FROM %I.%I qt
                    WHERE qt.%I = q.%I
                ) qt ON TRUE
                WHERE q.%I = $1`,
                "",
                schemaQuest.name,
                tableQuestData.name,
                schemaUser.name,
                tableUserData.name,
                tableQuestData.columns.authorID.name,
                tableUserData.columns.id.name,
                tableQuestTags.columns.tag.name,
                schemaQuest.name,
                tableQuestTags.name,
                tableQuestTags.columns.quest.name,
                tableQuestData.columns.id.name,
                tableQuestData.columns.id.name,
            ),
            [QUEST_ID],
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

        const QUEST_OUTPUT: QuestOutput = new QuestOutput(RESULT.rows[0]);

        res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok).json({
            message: "操作成功",
            data: await QUEST_OUTPUT.forQuestion(),
        });
        return;
    }),
);
*/

/**
 * 比對題目資料中的答案，並返回結果
 */
ROUTER.post(
    "/answerQuest",
    accessTokenValidation([Database.schemas.user.tables.userPrivileges.columns.allowAnswerQuest.name]),
    asyncRouterErrorHandler(
        async (
            req: RequestWithAccessToken<
                RequestBody<{ questID: string; questionVariable: string[]; answerVariable: string[] }>
            >,
            res: Response,
        ) => {
            const QUEST_ID: string = req.body.questID;
            const QUESTION_VARIABLE = req.body.questionVariable;
            const answerVariable = req.body.answerVariable;

            const POOL = Database.pool;
            const schemaQuest = Database.schemas.quest;
            const tableQuestData = schemaQuest.tables.data;

            const RESULT: QueryResult = await POOL.query(
                format(
                    `SELECT %I
					FROM %I.%I
					WHERE %I = $1`,
                    tableQuestData.columns.answer.name,
                    schemaQuest.name,
                    tableQuestData.name,
                    tableQuestData.columns.id.name,
                ),
                [QUEST_ID],
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

            const { answer } = RESULT.rows[0];
            const ANSWER_VARIABLE: string[] = (
                await Promise.all(
                    (answer as AnswerVariableAPIObject[]).map((value) =>
                        new AnswerVariable(value).toConstant(QUESTION_VARIABLE),
                    ),
                )
            ).map((param) => param.value);

            if (answerVariable.length !== ANSWER_VARIABLE.length) {
                res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok).json({
                    message: "操作成功",
                    data: {
                        correct: false,
                    },
                });
                return;
            }

            for (let i = 0; i < answerVariable.length; ++i) {
                if (answerVariable[i] !== ANSWER_VARIABLE[i]) {
                    res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok).json({
                        message: "操作成功",
                        data: {
                            correct: false,
                        },
                    });
                    return;
                }
            }

            res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok).json({
                message: "操作成功",
                data: {
                    correct: true,
                },
            });
            return;
        },
    ),
);

export { ROUTER };
