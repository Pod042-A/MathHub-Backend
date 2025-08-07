import express, { type Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { HTTP_RESPONSE_STATUS_CODE } from "../modules/Constant/HTTPResponseStatusCode/index.js";

const ROUTER: Router = express.Router();

ROUTER.get("/csrf-token", (req: Request, res: Response) => {
    const csrfToken: string = crypto.randomBytes(32).toString("base64url");
    req.session.csrfToken = csrfToken;

    res.status(HTTP_RESPONSE_STATUS_CODE.successfulResponse.ok).json({ csrfToken });
});

export { ROUTER };
