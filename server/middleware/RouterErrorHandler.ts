import type { Request, Response, NextFunction } from "express";
import { HTTPError } from "../modules/Error/HTTPError/index.js";
import { HTTP_RESPONSE_STATUS_CODE } from "../modules/Constant/HTTPResponseStatusCode/index.js";

export function routerErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    console.error(err);

    if (err instanceof HTTPError) {
        // TODO: Error message needs default message instead of empty string.
        // TODO: Improve HTTP status code object (and HTTPError object uses error codes in static), abstraction into a class with static attributes
        res.status(err.statusCode).type("application/json").json({
            message: err.message,
            status: "failed",
            data: {},
        });
    } else if (err instanceof Error) {
        res.status(HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError)
            .type("application/json")
            .json({
                message: err.message,
                status: "failed",
                data: {},
            });
    } else {
        res.status(HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError)
            .type("application/json")
            .json({
                message: "Internal Server Error",
                status: "failed",
                data: {},
            });
    }

    return;
}
