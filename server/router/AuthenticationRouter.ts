import express, { type Router, type Request, type Response } from "express";
import type {
    RequestBody,
    RequestWithAccessToken,
    RequestWithGoogleOAuth,
} from "../modules/types/Request/type.js";
import { asyncRouterErrorHandler } from "../handler/AsyncRouterErrorHandler.js";
import { HTTPError } from "../modules/Error/HTTPError/index.js";
import { HTTP_RESPONSE_STATUS_CODE } from "../modules/Constant/HTTPResponseStatusCode/index.js";
import type { QueryResult } from "pg";
import crypto, { type BinaryLike } from "node:crypto";
import { promisify } from "node:util";
import {
    AccessToken,
    Payload as AccessTokenPayload,
} from "../modules/Security/Authentication/AccessToken.js";
import { IDToken, Payload as IDTokenPayload } from "../modules/Security/Authentication/IDToken.js";
import { accessTokenValidation } from "../middleware/AccessTokenValidation.js";
import format from "pg-format";
import { google } from "googleapis";
import { CONFIGURATION as GoogleOAuthConfiguration } from "../config/GoogleOAuthConfiguration/index.js";
import { CONFIGURATION as GithubOAuthConfiguration } from "../config/GitHubOAuthConfiguration/index.js";
import type { OAuth2Client } from "googleapis-common";
import { Database } from "../modules/Database/PostgreSQL/MathHubMainDatabase/index.js";
import { Time } from "../modules/Time/Time.js";
import { Redis } from "../modules/Database/Redis/index.js";
import { PRIVILEGES } from "../modules/Database/PostgreSQL/MathHubMainDatabase/Schemas/user/common/Columns/privileges.js";
import { googleOAuthURLParser } from "../middleware/GoogleOAuthURLParser.js";
import { csrfTokenValidation } from "../middleware/CSRFTokenValidation.js";
import { URLSearchParams } from "node:url";
import axios from "axios";

const ROUTER: Router = express.Router();

// 有效用戶名稱格式
const USERNAME_FORMAT: RegExp = /^[\p{L}\p{N}_]+$/u;

// 有效密碼格式
const PASSWORD_FORMAT: RegExp =
    /^(?=.*[A-Z])(?=.*[!"#$%&'()*+,-./:;<=>?@^_`{|}~])[a-zA-Z0-9!"#$%&'()*+,-./:;<=>?@^_`{|}~]{8,32}$/;
/**
 * 有效電郵地址格式
 * @see {@link https://www.regular-expressions.info/email.html}
 */
const EMAIL_FORMAT: RegExp =
    /^(?=[a-z0-9@.!#$%&'*+/=?^_`{|}~-]{6,254}$)(?=[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:(?=[a-z0-9-]{1,63}\.)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?=[a-z0-9-]{1,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

const GOOGLE_STATE_FORMAT: RegExp = /^google:([\w-]+)$/;

const PROMISIFY_PBKDF2: (
    arg1: BinaryLike,
    arg2: BinaryLike,
    arg3: number,
    arg4: number,
    arg5: string,
) => Promise<Buffer<ArrayBufferLike>> = promisify(crypto.pbkdf2);

const oauth2Client: OAuth2Client = new google.auth.OAuth2({
    clientId: GoogleOAuthConfiguration.web.client_id,
    clientSecret: GoogleOAuthConfiguration.web.client_secret,
});

/** @see {@link https://developers.google.com/identity/protocols/oauth2/scopes?hl=zh-tw#oauth2} */
const scopes: string[] = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
];

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - 認證
 *     summary: 用戶註冊
 *     description: 使用電郵地址和密碼進行用戶註冊
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/RegisterRequest"
 *     responses:
 *       "201":
 *         description: 註冊成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SuccessResponse"
 *       "400":
 *         description: 註冊失敗，格式錯誤或電郵地址已存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/400ErrorResponse"
 *             examples:
 *               InvalidEmailFormat:
 *                 summary: 電郵地址格式錯誤
 *                 value:
 *                   message: Invalid email format
 *                   status: failed
 *                   data: {}
 *               InvalidUsernameFormat:
 *                 summary: 用戶名稱格式錯誤
 *                 value:
 *                   message: Invalid username format
 *                   status: failed
 *                   data: {}
 *               InvalidPasswordFormat:
 *                 summary: 密碼格式錯誤
 *                 value:
 *                   message: Invalid password format
 *                   status: failed
 *                   data: {}
 *               EmailAlreadyExists:
 *                 summary: 電郵地址已存在
 *                 value:
 *                   message: Email already exists
 *                   status: failed
 *                   data: {}
 *       "500":
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/5XXErrorResponse"
 */
ROUTER.post(
    "/register",
    asyncRouterErrorHandler(
        async (req: RequestBody<{ email: string; password: string; username: string }>, res: Response) => {
            const { email, password, username } = req.body;

            // 檢查格式
            if (!EMAIL_FORMAT.test(email)) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                    "Invalid email format",
                );
            }
            if (!USERNAME_FORMAT.test(username)) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                    "Invalid username format",
                );
            }
            if (!PASSWORD_FORMAT.test(password)) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                    "Invalid password format",
                );
            }

            const POOL = Database.pool;
            const schemaUser = Database.schemas.user;
            const tableData = schemaUser.tables.data;

            let result: QueryResult = await POOL.query(
                format(
                    "SELECT 1 FROM %I.%I WHERE %I = $1",
                    schemaUser.name,
                    tableData.name,
                    tableData.columns.email.name,
                ),
                [email],
            );
            if (result.rowCount === null) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError,
                    "Unknown database query error",
                );
            }
            if (result.rowCount > 0) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                    "Email already exists",
                );
            }

            const CLIENT = await POOL.connect();

            try {
                await CLIENT.query("BEGIN");

                // biome-ignore-start lint/nursery/noMagicNumbers: Reasonable value.
                const SALT: string = crypto.randomBytes(16).toString("hex");
                const HASHED_PASSWORD: Buffer = await PROMISIFY_PBKDF2(password, SALT, 100_000, 64, "sha512");
                // biome-ignore-end lint/nursery/noMagicNumbers: Reasonable value.

                result = await CLIENT.query(
                    format(
                        "INSERT INTO %I.%I (%I, %I, %I, %I) VALUES ($1, $2, $3, $4) RETURNING %I",
                        schemaUser.name,
                        tableData.name,
                        tableData.columns.username.name,
                        tableData.columns.email.name,
                        tableData.columns.hashedPassword.name,
                        tableData.columns.salt.name,
                        tableData.columns.id.name,
                    ),
                    [username, email, HASHED_PASSWORD, SALT],
                );

                const tableUserPrivileges = schemaUser.tables.userPrivileges;
                await CLIENT.query(
                    format(
                        "INSERT INTO %I.%I (%I) VALUES ($1)",
                        schemaUser.name,
                        tableUserPrivileges.name,
                        tableUserPrivileges.columns.id.name,
                    ),
                    [result.rows[0][tableData.columns.id.name]],
                );

                await CLIENT.query("COMMIT");

                // QUESTION: Response object abstraction
                res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.created).json({
                    message: "操作成功",
                    success: true,
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
 * @openapi
 * /auth/register/google:
 *   get:
 *     tags:
 *       - 認證
 *     summary: Google OAuth 相關操作進入點
 *     description: 使用 Google OAuth 進行認證
 *     parameters:
 *       - name: action
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [register, login]
 *     responses:
 *       "302":
 *         description: 重新導向至 Google 登入頁面
 *       "404":
 *         description: 非法連結
 */
ROUTER.get("/:action/google", (req: Request, res: Response) => {
    const ACTION: string = req.params.action;
    let redirectURI: string;
    let state: string;

    switch (ACTION) {
        case "register":
            redirectURI = GoogleOAuthConfiguration.web.redirect_uris[0];
            state = crypto.randomBytes(32).toString("base64url");
            break;
        case "login":
            redirectURI = GoogleOAuthConfiguration.web.redirect_uris[1];
            state = Buffer.from(
                JSON.stringify({
                    deviceID: req.query.deviceID,
                    nonce: req.query.nonce ?? null,
                    random: crypto.randomBytes(32).toString("base64url"),
                }),
            ).toString("base64url");
            break;
        default:
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.notFound);
    }

    req.session.state = `google:${state}`;

    const authorizationUrl = oauth2Client.generateAuthUrl({
        redirect_uri: redirectURI,
        access_type: "offline",
        scope: scopes,
        include_granted_scopes: true,
        state,
    });

    res.redirect(authorizationUrl);
});

ROUTER.get("/:action/github", (req: Request, res: Response) => {
    const ACTION: string = req.params.action;
    let state: string;

    switch (ACTION) {
        case "register":
            state = Buffer.from(
                JSON.stringify({
                    action: "register",
                    random: crypto.randomBytes(32).toString("base64url"),
                }),
            ).toString("base64url");
            break;
        case "login":
            state = Buffer.from(
                JSON.stringify({
                    action: "login",
                    deviceID: req.query.deviceID,
                    nonce: req.query.nonce ?? null,
                    random: crypto.randomBytes(32).toString("base64url"),
                }),
            ).toString("base64url");
            break;
        default:
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.notFound);
    }

    req.session.state = `github:${state}`;

    const params = new URLSearchParams({
        client_id: GithubOAuthConfiguration.id,
        redirect_uri: GithubOAuthConfiguration.uri.callback,
        /** @see {@link https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps} */
        scope: "read:user user:email",
        state,
    });

    res.redirect(`${GithubOAuthConfiguration.uri.entrypoint}?${params.toString()}`);
});

async function registerOAuth(
    res: Response,
    email: string,
    oauthID: string,
    oauthUsername: string,
    oauthColumnName: string,
): Promise<void> {
    const CLIENT = await Database.pool.connect();
    const schemaUser = Database.schemas.user;
    const tableData = schemaUser.tables.data;

    let result: QueryResult = await CLIENT.query(
        format(
            "SELECT %I FROM %I.%I WHERE %I = $1",
            oauthColumnName,
            schemaUser.name,
            tableData.name,
            tableData.columns.email.name,
        ),
        [email],
    );

    if (result.rowCount === null) {
        throw new HTTPError(
            HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError,
            "Unknown database query error",
        );
    }

    try {
        await CLIENT.query("BEGIN");

        if (result.rowCount === 0) {
            result = await CLIENT.query(
                format(
                    "INSERT INTO %I.%I (%I, %I, %I) VALUES ($1, $2, $3) RETURNING %I",
                    schemaUser.name,
                    tableData.name,
                    tableData.columns.username.name,
                    tableData.columns.email.name,
                    oauthColumnName,
                    tableData.columns.id.name,
                ),
                [oauthUsername, email, oauthID],
            );

            const tableUserPrivileges = schemaUser.tables.userPrivileges;
            await CLIENT.query(
                format(
                    "INSERT INTO %I.%I (%I) VALUES ($1)",
                    schemaUser.name,
                    tableUserPrivileges.name,
                    tableUserPrivileges.columns.id.name,
                ),
                [result.rows[0][tableData.columns.id.name]],
            );
        } else if (result.rows[0][oauthColumnName] === null) {
            await CLIENT.query(
                format(
                    "UPDATE %I.%I SET %I = $1 WHERE %I = $2",
                    schemaUser.name,
                    tableData.name,
                    oauthColumnName,
                    tableData.columns.email.name,
                ),
                [oauthID, email],
            );
        } else {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest);
        }

        await CLIENT.query("COMMIT");

        res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.created).json({
            message: "操作成功",
            success: true,
            data: {},
        });
        return;
    } catch (error) {
        await CLIENT.query("ROLLBACK");
        throw error;
    } finally {
        CLIENT.release();
    }
}

async function generateLoginTokens(
    id: string,
    lastLoginAt: Time,
    deviceID: string,
    nonce: string | null,
    expireTime: Time,
    refreshTokenExpireTime: Time,
): Promise<[AccessToken, IDToken, string]> {
    const CURRENT_TIME = expireTime.start;

    // Access Token
    const ACCESS_TOKEN_JTI: string = crypto.randomUUID().toString();
    const ACCESS_TOKEN_PAYLOAD: AccessTokenPayload = new AccessTokenPayload(
        AccessTokenPayload.iss,
        id,
        AccessTokenPayload.aud,
        expireTime.valueOf(),
        CURRENT_TIME.second,
        CURRENT_TIME.second,
        ACCESS_TOKEN_JTI,
    );
    const ACCESS_TOKEN: AccessToken = AccessToken.createFromPayload(ACCESS_TOKEN_PAYLOAD);

    // ID Token
    const ID_TOKEN_JTI: string = crypto.randomUUID().toString();
    const ID_TOKEN_PAYLOAD: IDTokenPayload = new IDTokenPayload(
        IDTokenPayload.iss,
        id,
        IDTokenPayload.aud,
        expireTime.valueOf(),
        CURRENT_TIME.second,
        CURRENT_TIME.second,
        ID_TOKEN_JTI,
        lastLoginAt.valueOf(),
        nonce ?? null,
        IDTokenPayload.createAtHash(ACCESS_TOKEN.toString()),
        IDTokenPayload.acrValue.login,
        [IDTokenPayload.amrValue.pwd],
    );
    const ID_TOKEN: IDToken = IDToken.createFromPayload(ID_TOKEN_PAYLOAD);

    // Refresh Token
    const REFRESH_TOKEN: string = crypto.randomBytes(64).toString("base64url");

    // 儲存令牌到 Redis
    await Redis.connect();

    // 清除舊有令牌
    const REDIS_USER_TOKENS = await Redis.client.get(`user:${id}:device:${deviceID}`);
    if (REDIS_USER_TOKENS !== null) {
        // TODO: Define jti record object type
        const REDIS_USER_TOKENS_VALUE: {
            accessToken: string;
            idToken: string;
            refreshToken: string;
        } = JSON.parse(REDIS_USER_TOKENS);

        await Promise.all([
            Redis.client.del(REDIS_USER_TOKENS_VALUE.accessToken),
            Redis.client.del(REDIS_USER_TOKENS_VALUE.idToken),
            Redis.client.del(REDIS_USER_TOKENS_VALUE.refreshToken),
        ]);
    }

    await Promise.all([
        Redis.client.set(
            `${AccessToken.prefix}:jti:${ACCESS_TOKEN_JTI}`,
            JSON.stringify({
                userID: id,
                deviceID,
                exp: expireTime.valueOf(),
            }),
            {
                expiration: {
                    type: "EXAT",
                    value: expireTime.valueOf(),
                },
            },
        ),
        Redis.client.set(
            `${IDToken.prefix}:jti:${ID_TOKEN_JTI}`,
            JSON.stringify({
                userID: id,
                deviceID,
                exp: expireTime.valueOf(),
            }),
            {
                expiration: {
                    type: "EXAT",
                    value: expireTime.valueOf(),
                },
            },
        ),
        Redis.client.set(
            `refreshToken:${REFRESH_TOKEN}`,
            JSON.stringify({
                userID: id,
                deviceID,
                exp: refreshTokenExpireTime.valueOf(),
            }),
            {
                expiration: {
                    type: "EXAT",
                    value: refreshTokenExpireTime.valueOf(),
                },
            },
        ),
        Redis.client.set(
            `user:${id}:device:${deviceID}`,
            JSON.stringify({
                accessToken: `${AccessToken.prefix}:jti:${ACCESS_TOKEN_JTI}`,
                idToken: `${IDToken.prefix}:jti:${ID_TOKEN_JTI}`,
                refreshToken: `refreshToken:${REFRESH_TOKEN}`,
            }),
            {
                expiration: {
                    type: "EXAT",
                    value: Math.max(refreshTokenExpireTime.valueOf(), expireTime.valueOf()),
                },
            },
        ),
        Database.pool.query(
            format(
                "UPDATE %I.%I SET %I = $1 WHERE %I = $2",
                Database.schemas.user.name,
                Database.schemas.user.tables.data.name,
                Database.schemas.user.tables.data.columns.lastLoginAt.name,
                Database.schemas.user.tables.data.columns.id.name,
            ),
            [new Date(CURRENT_TIME.millisecond), id],
        ),
    ]);

    return [ACCESS_TOKEN, ID_TOKEN, REFRESH_TOKEN];
}

async function oauthLogin(
    res: Response,
    deviceID: string,
    nonce: string | null,
    oauthID: string,
    oauthColumnName: string,
): Promise<void> {
    // 取得用戶資料
    const schemaUser = Database.schemas.user;
    const tableData = schemaUser.tables.data;
    const tableUserPrivileges = schemaUser.tables.userPrivileges;
    const tableGroupPrivileges = schemaUser.tables.groupPrivileges;

    const RESULT: QueryResult = await Database.pool.query(
        format(
            `SELECT d.%I, d.%I, d.%I, d.%I, d.%I, d.%I, %s, %s
            FROM %I.%I d
            JOIN %I.%I up ON d.%I = up.%I
            JOIN %I.%I gp ON up.%I = gp.%I
            WHERE d.%I = $1
            AND (up.%I = TRUE OR (up.%I IS NULL AND gp.%I = TRUE))
            AND (up.%I = TRUE OR (up.%I IS NULL AND gp.%I = TRUE))`,
            tableData.columns.id.name,
            tableData.columns.email.name,
            tableData.columns.username.name,
            tableData.columns.birthday.name,
            tableData.columns.grade.name,
            tableData.columns.lastLoginAt.name,
            Object.keys(PRIVILEGES)
                .map((column) => format("up.%I AS %I", column, `up_${column}`))
                .join(", "),
            Object.keys(PRIVILEGES)
                .map((column) => format("gp.%I AS %I", column, `gp_${column}`))
                .join(", "),
            schemaUser.name,
            tableData.name,
            schemaUser.name,
            tableUserPrivileges.name,
            tableData.columns.id.name,
            tableUserPrivileges.columns.id.name,
            schemaUser.name,
            tableGroupPrivileges.name,
            tableUserPrivileges.columns.group.name,
            tableGroupPrivileges.columns.key.name,
            oauthColumnName,
            tableUserPrivileges.columns.isActivated.name,
            tableUserPrivileges.columns.isActivated.name,
            tableGroupPrivileges.columns.isActivated.name,
            tableUserPrivileges.columns.allowLogin.name,
            tableUserPrivileges.columns.allowLogin.name,
            tableGroupPrivileges.columns.allowLogin.name,
        ),
        [oauthID],
    );

    if (RESULT.rowCount === null) {
        throw new HTTPError(
            HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError,
            "Unknown database query error",
        );
    }
    if (RESULT.rowCount === 0) {
        throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized, "Invalid account");
    }

    // 產生令牌
    const ID = RESULT.rows[0][tableData.columns.id.name];
    const CURRENT_TIME: Time = new Time();
    const EXPIRE_TIME: Time = new Time(CURRENT_TIME.valueOf(), "1h");
    const REFRESH_TOKEN_EXPIRE_TIME: Time = new Time(CURRENT_TIME.valueOf(), "7d");
    const [ACCESS_TOKEN, ID_TOKEN, REFRESH_TOKEN] = await generateLoginTokens(
        ID,
        new Time(new Date(RESULT.rows[0][tableData.columns.lastLoginAt.name])),
        deviceID,
        nonce ?? null,
        EXPIRE_TIME,
        REFRESH_TOKEN_EXPIRE_TIME,
    );

    const permissionList: string[] = [];
    for (const column of Object.keys(PRIVILEGES)) {
        if (
            RESULT.rows[0][`up_${column}`] === true ||
            (RESULT.rows[0][`up_${column}`] === null && RESULT.rows[0][`gp_${column}`] === true)
        ) {
            permissionList.push(column);
        }
    }

    res.cookie("refreshToken", REFRESH_TOKEN, {
        httpOnly: true,
        // secure: true, // TODO: HTTPS
        sameSite: "none",
        maxAge: REFRESH_TOKEN_EXPIRE_TIME.duration.millisecond,
    })
        .status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok)
        .json({
            success: true,
            data: {
                accessToken: ACCESS_TOKEN.toString(),
                idToken: ID_TOKEN.toString(),
                expiresIn: EXPIRE_TIME.duration,
                user: {
                    id: ID,
                    name: RESULT.rows[0][tableData.columns.username.name],
                    email: RESULT.rows[0][tableData.columns.email.name],
                    permissionList,
                    birthday: RESULT.rows[0][tableData.columns.birthday.name]
                        ? new Date(RESULT.rows[0][tableData.columns.birthday.name]).getTime()
                        : null,
                    grade: RESULT.rows[0][tableData.columns.grade.name],
                    isActive: true,
                    createdAt: CURRENT_TIME.getMilliseconds(),
                    updatedAt: CURRENT_TIME.getMilliseconds(),
                },
            },
        });
    return;
}

ROUTER.get(
    "/github/callback",
    asyncRouterErrorHandler(async (req: Request, res: Response) => {
        if (req.session.state === undefined) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest, "Unknown state");
        }

        const { code, state } = req.query;

        if (typeof code !== "string" || typeof state !== "string") {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest);
        }

        if (`github:${state}` !== req.session.state) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest);
        }

        const stateObject = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
        const { action, deviceID, nonce: ID_TOKEN_NONCE } = stateObject;

        // biome-ignore-start lint/style/useNamingConvention: Library requirements.
        const GITHUB_ACCESS_TOKEN_RESPONSE = await axios.post(
            GithubOAuthConfiguration.uri.accessToken,
            new URLSearchParams({
                client_id: GithubOAuthConfiguration.id,
                client_secret: GithubOAuthConfiguration.secret,
                code,
                state,
            }),
            {
                headers: {
                    Accept: "application/json",
                },
            },
        );
        const GITHUB_ACCESS_TOKEN: unknown = GITHUB_ACCESS_TOKEN_RESPONSE.data.access_token;
        if (typeof GITHUB_ACCESS_TOKEN !== "string" || GITHUB_ACCESS_TOKEN.trim().length === 0) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError);
        }

        const [GITHUB_USER_DATA_RESPONSE, GITHUB_EMAILS_RESPONSE] = await Promise.all([
            axios.get(GithubOAuthConfiguration.uri.user, {
                headers: {
                    Authorization: `Bearer ${GITHUB_ACCESS_TOKEN}`,
                    Accept: "aapplication/vnd.github+json",
                },
            }),
            axios.get(GithubOAuthConfiguration.uri.emails, {
                headers: {
                    Authorization: `Bearer ${GITHUB_ACCESS_TOKEN}`,
                    Accept: "aapplication/vnd.github+json",
                },
            }),
        ]);
        // biome-ignore-end lint/style/useNamingConvention: Library requirements.

        const GITHUB_USER_DATA = GITHUB_USER_DATA_RESPONSE.data;
        if (
            GITHUB_USER_DATA === undefined ||
            GITHUB_USER_DATA === null ||
            typeof GITHUB_USER_DATA !== "object"
        ) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError);
        }

        const EMAIL: string | null = (() => {
            if (!(Array.isArray(GITHUB_EMAILS_RESPONSE.data) && GITHUB_EMAILS_RESPONSE.data.length > 0)) {
                return null;
            }

            const PRIMARY_EMAIL_DATA = GITHUB_EMAILS_RESPONSE.data.find(
                (data: unknown): data is { primary: boolean; email: string } => {
                    return (
                        data !== undefined &&
                        data !== null &&
                        typeof data === "object" &&
                        "primary" in data &&
                        typeof data.primary === "boolean" &&
                        data.primary === true &&
                        "email" in data &&
                        typeof data.email === "string" &&
                        data.email.trim().length > 0
                    );
                },
            );

            if (!PRIMARY_EMAIL_DATA) {
                return null;
            }

            return PRIMARY_EMAIL_DATA.email;
        })();

        if (EMAIL === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError);
        }

        const GITHUB_ID: string | null = (() => {
            if (!("id" in GITHUB_USER_DATA)) {
                return null;
            }

            if (typeof GITHUB_USER_DATA.id === "number") {
                return GITHUB_USER_DATA.id.toString();
            }

            if (typeof GITHUB_USER_DATA.id === "string" && GITHUB_USER_DATA.id.trim().length > 0) {
                return GITHUB_USER_DATA.id;
            }

            return null;
        })();

        if (GITHUB_ID === null) {
            throw new HTTPError(
                HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError,
                "Invalid Github ID",
            );
        }

        const GITHUB_USERNAME: string | null = (() => {
            if (
                "name" in GITHUB_USER_DATA &&
                typeof GITHUB_USER_DATA.name === "string" &&
                GITHUB_USER_DATA.name.trim().length > 0
            ) {
                return GITHUB_USER_DATA.name;
            }

            if (
                "login" in GITHUB_USER_DATA &&
                typeof GITHUB_USER_DATA.login === "string" &&
                GITHUB_USER_DATA.login.trim().length > 0
            ) {
                return GITHUB_USER_DATA.login;
            }

            return null;
        })();

        if (GITHUB_USERNAME === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError);
        }

        switch (action) {
            case "register":
                await registerOAuth(
                    res,
                    EMAIL,
                    GITHUB_ID,
                    GITHUB_USERNAME,
                    Database.schemas.user.tables.data.columns.github.name,
                );
                break;
            case "login":
                if (typeof deviceID !== "string" || deviceID.trim().length === 0) {
                    throw new HTTPError(
                        HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                        "Missing device id",
                    );
                }

                await oauthLogin(
                    res,
                    deviceID,
                    ID_TOKEN_NONCE ?? null,
                    GITHUB_ID,
                    Database.schemas.user.tables.data.columns.github.name,
                );
                break;
            default:
                throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.notFound);
        }

        return;
    }),
);

/**
 * @openapi
 * /auth/register/google/callback:
 *   get:
 *     tags:
 *       - 認證
 *     summary: Google OAuth 用戶註冊流程
 *     description: 使用 Google OAuth 進行用戶註冊
 *     x-internal: true
 *     responses:
 *       "201":
 *         description: 註冊成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SuccessResponse"
 *       "500":
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/5XXErrorResponse"
 */
ROUTER.get(
    "/register/google/callback",
    googleOAuthURLParser(GoogleOAuthConfiguration.web.redirect_uris[0]),
    asyncRouterErrorHandler(async (req: RequestWithGoogleOAuth, res: Response) => {
        const profile = req.profile;

        const GOOGLE_ID = profile.id ?? null;
        const EMAIL = profile.email ?? null;
        const USERNAME = profile.name ?? `user_${crypto.randomBytes(8).toString("hex")}`;

        if (GOOGLE_ID === null || EMAIL === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized);
        }

        await registerOAuth(
            res,
            EMAIL,
            GOOGLE_ID,
            USERNAME,
            Database.schemas.user.tables.data.columns.google.name,
        );
        return;
    }),
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - 認證
 *     summary: 用戶登入
 *     description: 使用電子郵件和密碼進行用戶登入
 *     requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/LoginRequest"
 *     responses:
 *       "200":
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/LoginResponse"
 *       "400":
 *         description: 請求格式錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/400ErrorResponse"
 *       "401":
 *         description: 無法找到用戶資料
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/401ErrorResponse"
 *       "403":
 *         description: 密碼錯誤，無法通過身分驗證
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/403ErrorResponse"
 *       "500":
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/5XXErrorResponse"
 */
ROUTER.post(
    "/login",
    asyncRouterErrorHandler(
        async (
            req: RequestBody<{ email: string; password: string; deviceID: string; nonce?: string }>,
            res: Response,
        ) => {
            const { email, password, deviceID, nonce: ID_TOKEN_NONCE } = req.body;

            // 檢查格式
            if (deviceID.trim().length === 0) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                    "Missing device id",
                );
            }
            if (!EMAIL_FORMAT.test(email)) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                    "Invalid email format",
                );
            }
            if (!PASSWORD_FORMAT.test(password)) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                    "Invalid password format",
                );
            }

            // 取得用戶資料
            const POOL = Database.pool;
            const schemaUser = Database.schemas.user;
            const tableData = schemaUser.tables.data;
            const tableUserPrivileges = schemaUser.tables.userPrivileges;
            const tableGroupPrivileges = schemaUser.tables.groupPrivileges;

            const RESULT: QueryResult = await POOL.query(
                format(
                    `SELECT d.%I, d.%I, d.%I, d.%I, d.%I, d.%I, d.%I, %s, %s
					FROM %I.%I d
					JOIN %I.%I up ON d.%I = up.%I
                    JOIN %I.%I gp ON up.%I = gp.%I
					WHERE d.%I = $1
					AND (up.%I = TRUE OR (up.%I IS NULL AND gp.%I = TRUE))
                    AND (up.%I = TRUE OR (up.%I IS NULL AND gp.%I = TRUE))`,
                    tableData.columns.id.name,
                    tableData.columns.username.name,
                    tableData.columns.hashedPassword.name,
                    tableData.columns.salt.name,
                    tableData.columns.birthday.name,
                    tableData.columns.grade.name,
                    tableData.columns.lastLoginAt.name,
                    Object.keys(PRIVILEGES)
                        .map((column) => format("up.%I AS %I", column, `up_${column}`))
                        .join(", "),
                    Object.keys(PRIVILEGES)
                        .map((column) => format("gp.%I AS %I", column, `gp_${column}`))
                        .join(", "),
                    schemaUser.name,
                    tableData.name,
                    schemaUser.name,
                    tableUserPrivileges.name,
                    tableData.columns.id.name,
                    tableUserPrivileges.columns.id.name,
                    schemaUser.name,
                    tableGroupPrivileges.name,
                    tableUserPrivileges.columns.group.name,
                    tableGroupPrivileges.columns.key.name,
                    tableData.columns.email.name,
                    tableUserPrivileges.columns.isActivated.name,
                    tableUserPrivileges.columns.isActivated.name,
                    tableGroupPrivileges.columns.isActivated.name,
                    tableUserPrivileges.columns.allowLogin.name,
                    tableUserPrivileges.columns.allowLogin.name,
                    tableGroupPrivileges.columns.allowLogin.name,
                ),
                [email],
            );
            if (RESULT.rowCount === null) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError,
                    "Unknown database query error",
                );
            }
            if (RESULT.rowCount === 0) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized,
                    "Invalid account",
                );
            }

            // 驗證密碼
            const SALT: string = RESULT.rows[0][tableData.columns.salt.name];
            const HASHED_PASSWORD: Buffer = RESULT.rows[0][tableData.columns.hashedPassword.name];
            const HASHED_INPUT_PASSWORD: Buffer = await PROMISIFY_PBKDF2(
                password,
                SALT,
                100_000,
                64,
                "sha512",
            );

            const IS_PASSWORD_VALID: boolean = crypto.timingSafeEqual(HASHED_INPUT_PASSWORD, HASHED_PASSWORD);

            if (!IS_PASSWORD_VALID) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.forbidden,
                    "Invalid account",
                );
            }

            // 產生令牌
            const ID = RESULT.rows[0][tableData.columns.id.name];
            const CURRENT_TIME: Time = new Time();
            const EXPIRE_TIME: Time = new Time(CURRENT_TIME.valueOf(), "1h");
            const REFRESH_TOKEN_EXPIRE_TIME: Time = new Time(CURRENT_TIME.valueOf(), "7d");
            const [ACCESS_TOKEN, ID_TOKEN, REFRESH_TOKEN] = await generateLoginTokens(
                ID,
                new Time(new Date(RESULT.rows[0][tableData.columns.lastLoginAt.name])),
                deviceID,
                ID_TOKEN_NONCE ?? null,
                EXPIRE_TIME,
                REFRESH_TOKEN_EXPIRE_TIME,
            );

            const permissionList: string[] = [];
            for (const column of Object.keys(PRIVILEGES)) {
                if (
                    RESULT.rows[0][`up_${column}`] === true ||
                    (RESULT.rows[0][`up_${column}`] === null && RESULT.rows[0][`gp_${column}`] === true)
                ) {
                    permissionList.push(column);
                }
            }

            res.cookie("refreshToken", REFRESH_TOKEN, {
                httpOnly: true,
                // secure: true, // TODO: HTTPS
                sameSite: "none",
                maxAge: REFRESH_TOKEN_EXPIRE_TIME.duration.millisecond,
            })
                .status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok)
                .json({
                    success: true,
                    data: {
                        accessToken: ACCESS_TOKEN.toString(),
                        idToken: ID_TOKEN.toString(),
                        expiresIn: EXPIRE_TIME.duration,
                        user: {
                            id: ID,
                            name: RESULT.rows[0][tableData.columns.username.name],
                            email,
                            permissionList,
                            birthday: RESULT.rows[0][tableData.columns.birthday.name]
                                ? new Date(RESULT.rows[0][tableData.columns.birthday.name]).getTime()
                                : null,
                            grade: RESULT.rows[0][tableData.columns.grade.name],
                            isActive: true,
                            createdAt: CURRENT_TIME.getMilliseconds(),
                            updatedAt: CURRENT_TIME.getMilliseconds(),
                        },
                    },
                });
            return;
        },
    ),
);

ROUTER.get(
    "/login/google/callback",
    googleOAuthURLParser(GoogleOAuthConfiguration.web.redirect_uris[1]),
    asyncRouterErrorHandler(async (req: RequestWithGoogleOAuth, res: Response) => {
        if (req.session.state === undefined) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest, "Unknown state");
        }

        const match = req.session.state.match(GOOGLE_STATE_FORMAT);
        if (match === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest, "Unknown state");
        }

        const state = JSON.parse(Buffer.from(match[1], "base64url").toString("utf-8"));
        const { deviceID, nonce: ID_TOKEN_NONCE } = state;
        const GOOGLE_ID: string | null = req.profile.id ?? null;

        if (typeof deviceID !== "string" || deviceID.trim().length === 0) {
            throw new HTTPError(
                HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest,
                "Missing device id",
            );
        }
        if (GOOGLE_ID === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized);
        }

        await oauthLogin(
            res,
            deviceID,
            ID_TOKEN_NONCE ?? null,
            GOOGLE_ID,
            Database.schemas.user.tables.data.columns.google.name,
        );
        return;
    }),
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags:
 *       - 認證
 *     summary: 替換更新 access token
 *     description: 使用 refresh token 重新替換更新 access token
 *     parameters:
 *       - in: cookie
 *         name: refreshToken
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceID:
 *                 type: string
 *                 description: 裝置識別碼
 *                 example: 4fcd0ed2-0000-0000-0000-283b3841e6ea
 *               nonce:
 *                 type: string
 *                 nullable: true
 *                 description: （可選）用於防止重播攻擊的隨機字串，由前端產生
 *     responses:
 *       "200":
 *         description: access token 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     idToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     expiresIn:
 *                       type: integer
 *                       example: 3600
 *       "401":
 *         description: Refresh token 無效或過期
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/401ErrorResponse"
 *       "500":
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/5XXErrorResponse"
 */
ROUTER.post(
    "/refresh",
    csrfTokenValidation(),
    asyncRouterErrorHandler(async (req: RequestBody<{ deviceID: string; nonce?: string }>, res: Response) => {
        const REFRESH_TOKEN: string | null =
            "refreshToken" in req.cookies &&
            typeof req.cookies.refreshToken === "string" &&
            req.cookies.refreshToken.trim().length > 0
                ? req.cookies.refreshToken
                : null;
        const deviceID: string | null = req.body.deviceID.trim().length > 0 ? req.body.deviceID : null;
        const ID_TOKEN_NONCE: string | null =
            "nonce" in req.body && typeof req.body.nonce === "string" && req.body.nonce.trim().length > 0
                ? req.body.nonce
                : null;

        if (REFRESH_TOKEN === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized);
        }
        if (deviceID === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest);
        }

        await Redis.connect();
        const REDIS_REFRESH_TOKEN = await Redis.client.get(`refreshToken:${REFRESH_TOKEN}`);

        if (REDIS_REFRESH_TOKEN === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized);
        }

        const REDIS_REFRESH_TOKEN_VALUE: { userID: string; deviceID: string; exp: number } =
            JSON.parse(REDIS_REFRESH_TOKEN);

        if (REDIS_REFRESH_TOKEN_VALUE.deviceID !== deviceID) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.conflict);
        }

        const ID = REDIS_REFRESH_TOKEN_VALUE.userID;

        const REDIS_USER_TOKENS = await Redis.client.get(`user:${ID}:device:${deviceID}`);

        if (REDIS_USER_TOKENS !== null) {
            // TODO: Define jti record object type
            const REDIS_USER_TOKENS_VALUE: {
                accessToken: string;
                idToken: string;
                refreshToken: string;
            } = JSON.parse(REDIS_USER_TOKENS);

            await Promise.all([
                Redis.client.del(REDIS_USER_TOKENS_VALUE.accessToken),
                Redis.client.del(REDIS_USER_TOKENS_VALUE.idToken),
                Redis.client.del(REDIS_USER_TOKENS_VALUE.refreshToken),
            ]);
        }

        const schemaUser = Database.schemas.user;
        const tableData = schemaUser.tables.data;
        const RESULT: QueryResult = await Database.pool.query(
            format(
                "SELECT %I FROM %I.%I WHERE %I = $1",
                tableData.columns.lastLoginAt.name,
                schemaUser.name,
                tableData.name,
                tableData.columns.id.name,
            ),
            [ID],
        );

        if (RESULT.rowCount === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError);
        }
        if (RESULT.rowCount === 0) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized);
        }

        const LAST_LOGIN_AT: Time = new Time(new Date(RESULT.rows[0][tableData.columns.lastLoginAt.name]));
        const CURRENT_TIME: Time = new Time();
        const EXPIRE_TIME: Time = new Time(CURRENT_TIME.valueOf(), "1h");
        const REFRESH_TOKEN_EXPIRE_TIME: Time = new Time(CURRENT_TIME.valueOf(), "7d");

        const ACCESS_TOKEN_JTI: string = crypto.randomUUID().toString();
        const ACCESS_TOKEN_PAYLOAD: AccessTokenPayload = new AccessTokenPayload(
            AccessTokenPayload.iss,
            ID,
            AccessTokenPayload.aud,
            EXPIRE_TIME.valueOf(),
            CURRENT_TIME.valueOf(),
            CURRENT_TIME.valueOf(),
            ACCESS_TOKEN_JTI,
        );
        const ACCESS_TOKEN: AccessToken = AccessToken.createFromPayload(ACCESS_TOKEN_PAYLOAD);

        const ID_TOKEN_JTI: string = crypto.randomUUID().toString();
        const ID_TOKEN_PAYLOAD: IDTokenPayload = new IDTokenPayload(
            IDTokenPayload.iss,
            ID,
            IDTokenPayload.aud,
            EXPIRE_TIME.valueOf(),
            CURRENT_TIME.valueOf(),
            CURRENT_TIME.valueOf(),
            ID_TOKEN_JTI,
            LAST_LOGIN_AT.valueOf(),
            ID_TOKEN_NONCE ?? null,
            IDTokenPayload.createAtHash(ACCESS_TOKEN.toString()),
            IDTokenPayload.acrValue.login,
            [IDTokenPayload.amrValue.pwd],
        );
        const ID_TOKEN: IDToken = IDToken.createFromPayload(ID_TOKEN_PAYLOAD);

        const NEW_REFRESH_TOKEN: string = crypto.randomBytes(64).toString("base64url");

        await Promise.all([
            Redis.client.set(
                `${AccessToken.prefix}:jti:${ACCESS_TOKEN_JTI}`,
                JSON.stringify({
                    userID: ID,
                    deviceID,
                    exp: EXPIRE_TIME.valueOf(),
                }),
                {
                    expiration: {
                        type: "EXAT",
                        value: EXPIRE_TIME.valueOf(),
                    },
                },
            ),
            Redis.client.set(
                `${IDToken.prefix}:jti:${ID_TOKEN_JTI}`,
                JSON.stringify({
                    userID: ID,
                    deviceID,
                    exp: EXPIRE_TIME.valueOf(),
                }),
                {
                    expiration: {
                        type: "EXAT",
                        value: EXPIRE_TIME.valueOf(),
                    },
                },
            ),
            Redis.client.set(
                `refreshToken:${NEW_REFRESH_TOKEN}`,
                JSON.stringify({
                    userID: ID,
                    deviceID,
                    exp: REFRESH_TOKEN_EXPIRE_TIME.valueOf(),
                }),
                {
                    expiration: {
                        type: "EXAT",
                        value: REFRESH_TOKEN_EXPIRE_TIME.valueOf(),
                    },
                },
            ),
            Redis.client.set(
                `user:${ID}:device:${deviceID}`,
                JSON.stringify({
                    accessToken: `${AccessToken.prefix}:jti:${ACCESS_TOKEN_JTI}`,
                    idToken: `${IDToken.prefix}:jti:${ID_TOKEN_JTI}`,
                    refreshToken: `refreshToken:${NEW_REFRESH_TOKEN}`,
                }),
                {
                    expiration: {
                        type: "EXAT",
                        value: Math.max(REFRESH_TOKEN_EXPIRE_TIME.valueOf(), EXPIRE_TIME.valueOf()),
                    },
                },
            ),
            Database.pool.query(
                format(
                    "UPDATE %I.%I SET %I = $1 WHERE %I = $2",
                    schemaUser.name,
                    tableData.name,
                    tableData.columns.lastLoginAt.name,
                    tableData.columns.id.name,
                ),
                [new Date(CURRENT_TIME.getMilliseconds()), ID],
            ),
        ]);

        res.cookie("refreshToken", NEW_REFRESH_TOKEN, {
            httpOnly: true,
            // secure: true, // TODO: HTTPS
            sameSite: "none",
            maxAge: REFRESH_TOKEN_EXPIRE_TIME.duration.millisecond,
        })
            .status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok)
            .json({
                success: true,
                data: {
                    accessToken: ACCESS_TOKEN.toString(),
                    idToken: ID_TOKEN.toString(),
                    expiresIn: EXPIRE_TIME.duration,
                },
            });
        return;
    }),
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - 認證
 *     summary: 用戶登出
 *     description: 登出當前用戶
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceID:
 *                 type: string
 *                 description: 裝置識別碼
 *                 example: 4fcd0ed2-0000-0000-0000-283b3841e6ea
 *     responses:
 *       "200":
 *         description: 登出成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/SuccessResponse"
 *       "401":
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/401ErrorResponse"
 *       "500":
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/5XXErrorResponse"
 */
ROUTER.post(
    "/logout",
    csrfTokenValidation(),
    accessTokenValidation(),
    asyncRouterErrorHandler(
        async (req: RequestWithAccessToken<RequestBody<{ deviceID: string }>>, res: Response) => {
            const ACCESS_TOKEN: AccessToken = req.accessToken;
            const deviceID: string | null = req.body.deviceID.trim().length > 0 ? req.body.deviceID : null;

            if (deviceID === null) {
                throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest);
            }

            await Redis.connect();
            const REDIS_ACCESS_TOKEN = await Redis.client.get(
                `accessToken:jti:${ACCESS_TOKEN.payloadEntity.jti}`,
            );

            if (REDIS_ACCESS_TOKEN === null) {
                throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized);
            }

            const REDIS_ACCESS_TOKEN_VALUE: { userID: string; deviceID: string; exp: number } =
                JSON.parse(REDIS_ACCESS_TOKEN);

            if (REDIS_ACCESS_TOKEN_VALUE.deviceID !== deviceID) {
                throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.conflict);
            }

            const REDIS_USER_TOKENS = await Redis.client.get(
                `user:${ACCESS_TOKEN.payloadEntity.sub}:device:${deviceID}`,
            );

            if (REDIS_USER_TOKENS === null) {
                res.clearCookie("refreshToken", {
                    httpOnly: true,
                    // secure: true, // TODO: HTTPS
                    sameSite: "none",
                })
                    .status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok)
                    .json({
                        message: "No tokens record",
                        success: true,
                        data: {},
                    });
                return;
            }

            // TODO: Define jti record object type
            const REDIS_USER_TOKENS_VALUE: { accessToken: string; idToken: string; refreshToken: string } =
                JSON.parse(REDIS_USER_TOKENS);

            await Promise.all([
                Redis.client.del(REDIS_USER_TOKENS_VALUE.accessToken),
                Redis.client.del(REDIS_USER_TOKENS_VALUE.idToken),
                Redis.client.del(REDIS_USER_TOKENS_VALUE.refreshToken),
                Redis.client.del(`user:${ACCESS_TOKEN.payloadEntity.sub}:device:${deviceID}`),
            ]);

            res.clearCookie("refreshToken", {
                httpOnly: true,
                // secure: true, // TODO: HTTPS
                sameSite: "none",
            })
                .status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok)
                .json({
                    message: "操作成功",
                    success: true,
                    data: {},
                });
            return;
        },
    ),
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags:
 *       - 認證
 *     summary: 獲取當前用戶資訊
 *     description: 獲取當前登入用戶的詳細資訊
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       "200":
 *         description: 成功獲取用戶資訊
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: "#/components/schemas/User"
 *       "401":
 *         description: 未授權
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/401ErrorResponse"
 *       "500":
 *         description: 伺服器錯誤
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/5XXErrorResponse"
 */
ROUTER.get(
    "/me",
    accessTokenValidation(),
    asyncRouterErrorHandler(async (req: RequestWithAccessToken, res: Response) => {
        const ACCESS_TOKEN: AccessToken = req.accessToken;
        const ID = ACCESS_TOKEN.payloadEntity.sub;

        const schemaUser = Database.schemas.user;
        const tableData = schemaUser.tables.data;
        const tableUserPrivileges = schemaUser.tables.userPrivileges;
        const tableGroupPrivileges = schemaUser.tables.groupPrivileges;

        const RESULT: QueryResult = await Database.pool.query(
            format(
                `SELECT d.%I, d.%I, d.%I, d.%I, d.%I, %s, %s
                FROM %I.%I d
                JOIN %I.%I up ON d.%I = up.%I
                JOIN %I.%I gp ON up.%I = gp.%I
                WHERE d.%I = $1`,
                tableData.columns.username.name,
                tableData.columns.email.name,
                tableData.columns.birthday.name,
                tableData.columns.grade.name,
                tableData.columns.lastLoginAt.name,
                Object.keys(PRIVILEGES)
                    .map((column) => format("up.%I AS %I", column, `up_${column}`))
                    .join(", "),
                Object.keys(PRIVILEGES)
                    .map((column) => format("gp.%I AS %I", column, `gp_${column}`))
                    .join(", "),
                schemaUser.name,
                tableData.name,
                schemaUser.name,
                tableUserPrivileges.name,
                tableData.columns.id.name,
                tableUserPrivileges.columns.id.name,
                schemaUser.name,
                tableGroupPrivileges.name,
                tableUserPrivileges.columns.group.name,
                tableGroupPrivileges.columns.key.name,
                tableData.columns.id.name,
            ),
            [ID],
        );

        if (RESULT.rowCount === null) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError);
        }
        if (RESULT.rowCount === 0) {
            throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.notFound);
        }

        const permissionList: string[] = [];
        for (const column of Object.keys(PRIVILEGES)) {
            if (
                RESULT.rows[0][`up_${column}`] === true ||
                (RESULT.rows[0][`up_${column}`] === null && RESULT.rows[0][`gp_${column}`] === true)
            ) {
                permissionList.push(column);
            }
        }

        const CURRENT_TIME: Time = new Time();

        res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok).json({
            success: true,
            data: {
                id: ID,
                name: RESULT.rows[0][tableData.columns.username.name],
                email: RESULT.rows[0][tableData.columns.email.name],
                permissionList,
                birthday: RESULT.rows[0][tableData.columns.birthday.name]
                    ? new Date(RESULT.rows[0][tableData.columns.birthday.name]).getTime()
                    : null,
                grade: RESULT.rows[0][tableData.columns.grade.name],
                isActive: true,
                createdAt: CURRENT_TIME.getMilliseconds(),
                updatedAt: CURRENT_TIME.getMilliseconds(),
            },
        });
        return;
    }),
);

export { ROUTER };
