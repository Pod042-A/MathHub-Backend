import type { NextFunction, Request, Response } from "express";
import { HTTPError } from "../modules/Error/HTTPError/index.js";
import { HTTP_RESPONSE_STATUS_CODE } from "../modules/Constant/HTTPResponseStatusCode/index.js";

function csrfTokenValidation(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            if (typeof req.session.csrfToken !== "string" || req.session.csrfToken.trim().length === 0) {
                throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest);
            }

            const HEADER_CSRF_TOKEN: unknown = req.headers["x-csrf-token"];
            const BODY_CSRF_TOKEN: unknown = req.body.csrfToken;

            const HEADER_TOKEN_EXIST: boolean =
                typeof HEADER_CSRF_TOKEN === "string" && HEADER_CSRF_TOKEN.trim().length > 0;
            const BODY_TOKEN_EXIST: boolean =
                typeof BODY_CSRF_TOKEN === "string" && BODY_CSRF_TOKEN.trim().length > 0;

            const HEADER_TOKEN_EQUAL: boolean = HEADER_CSRF_TOKEN === req.session.csrfToken;
            const BODY_TOKEN_EQUAL: boolean = BODY_CSRF_TOKEN === req.session.csrfToken;

            const IS_VALID: boolean =
                (HEADER_TOKEN_EXIST && BODY_TOKEN_EXIST && HEADER_TOKEN_EQUAL && BODY_TOKEN_EQUAL) ||
                (HEADER_TOKEN_EXIST && !BODY_TOKEN_EXIST && HEADER_TOKEN_EQUAL) ||
                (!HEADER_TOKEN_EXIST && BODY_TOKEN_EXIST && BODY_TOKEN_EQUAL);

            if (!IS_VALID) {
                throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.badRequest);
            }

            next();
            return;
        } catch (error) {
            next(error);
        }
    };
}

export { csrfTokenValidation };
