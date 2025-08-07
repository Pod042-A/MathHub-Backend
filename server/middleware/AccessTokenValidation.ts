import type { Request, Response, NextFunction } from "express";
import { HTTP_RESPONSE_STATUS_CODE } from "../modules/Constant/HTTPResponseStatusCode/index.js";
import type { RequestWithAccessToken } from "../modules/types/Request/type.js";

import type { QueryResult } from "pg";
import format from "pg-format";
import { Database } from "../modules/Database/PostgreSQL/MathHubMainDatabase/index.js";
import { HTTPError } from "../modules/Error/HTTPError/index.js";
import { Redis } from "../modules/Database/Redis/index.js";
import { AccessToken } from "../modules/Security/Authentication/AccessToken.js";
import { Time } from "../modules/Time/Time.js";

const BEARER_TOKEN_FORMAT: RegExp = /^(bearer)\s+([\w-]+\.[\w-]+.[\w-]+)$/i;

/**
 * @description 驗證身分驗證令牌的中介軟體
 * @param requirePrivileges 所需的權限，屬性參考 Database 物件
 */
function accessTokenValidation(
    requirePrivileges: string[] = [],
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            const AUTHORIZATION_HEADER = req.headers.authorization;

            if (AUTHORIZATION_HEADER === undefined) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized,
                    "Missing Authorization header",
                );
            }

            const BEARER_TOKEN_MATCH = AUTHORIZATION_HEADER.match(BEARER_TOKEN_FORMAT);

            if (BEARER_TOKEN_MATCH === null) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized,
                    "Invalid Bearer token format",
                );
            }

            const ACCESS_TOKEN: AccessToken = AccessToken.createFromTokenString(BEARER_TOKEN_MATCH[2]);

            await Redis.connect();
            const REDIS_ACCESS_TOKEN = await Redis.client.get(
                `${AccessToken.prefix}:jti:${ACCESS_TOKEN.payloadEntity.jti}`,
            );

            if (REDIS_ACCESS_TOKEN === null) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized,
                    "Invalid Access token",
                );
            }

            const REDIS_ACCESS_TOKEN_VALUE: { userID: string; exp: number } = JSON.parse(REDIS_ACCESS_TOKEN);

            if (REDIS_ACCESS_TOKEN_VALUE.userID !== ACCESS_TOKEN.payloadEntity.sub) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized,
                    "Invalid Access token",
                );
            }

            const CURRENT_TIME: Time = new Time();

            if (ACCESS_TOKEN.payloadEntity.iat > CURRENT_TIME.valueOf()) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized,
                    "Access token issued in the future",
                );
            }

            if (ACCESS_TOKEN.payloadEntity.nbf > CURRENT_TIME.valueOf()) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized,
                    "Access token is not yet valid",
                );
            }

            if (ACCESS_TOKEN.payloadEntity.exp <= Time.now()) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.unauthorized,
                    "Access token has expired",
                );
            }

            const schemaUser = Database.schemas.user;
            const tableUserPrivileges = schemaUser.tables.userPrivileges;
            const tableGroupPrivileges = schemaUser.tables.groupPrivileges;

            const RESULT: QueryResult = await Database.pool.query(
                format(
                    `SELECT 1
                    FROM %I.%I up
                    JOIN %I.%I gp ON up.%I = gp.%I
                    WHERE up.%I = $1 %s`,
                    schemaUser.name,
                    tableUserPrivileges.name,
                    schemaUser.name,
                    tableGroupPrivileges.name,
                    tableUserPrivileges.columns.group.name,
                    tableGroupPrivileges.columns.key.name,
                    tableUserPrivileges.columns.id.name,
                    requirePrivileges.length > 0
                        ? requirePrivileges
                              .map((privilege) =>
                                  format(
                                      "AND (up.%I = TRUE OR (up.%I IS NULL AND gp.%I = TRUE))",
                                      privilege,
                                      privilege,
                                      privilege,
                                  ),
                              )
                              .join(" ")
                        : "",
                ),
                [ACCESS_TOKEN.payloadEntity.sub],
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
                    "Insufficient privileges",
                );
            }

            (req as RequestWithAccessToken).accessToken = ACCESS_TOKEN;
            next();
            return;
        } catch (error) {
            next(error);
        }
    };
}

export { accessTokenValidation };
