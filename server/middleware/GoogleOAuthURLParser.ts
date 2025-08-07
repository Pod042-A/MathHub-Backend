import type { NextFunction, Request, Response } from "express";
import { HTTPError } from "../modules/Error/HTTPError/index.js";
import { HTTP_RESPONSE_STATUS_CODE } from "../modules/Constant/HTTPResponseStatusCode/index.js";
import { google, type oauth2_v2 } from "googleapis";
import type { OAuth2Client } from "googleapis-common";
import { CONFIGURATION as GoogleOAuthConfiguration } from "../config/GoogleOAuthConfiguration/index.js";
import url from "node:url";
import type { ParsedUrlQuery } from "node:querystring";
import type { RequestWithGoogleOAuth } from "../modules/types/Request/type.js";

const oauth2Client: OAuth2Client = new google.auth.OAuth2({
    clientId: GoogleOAuthConfiguration.web.client_id,
    clientSecret: GoogleOAuthConfiguration.web.client_secret,
});

function googleOAuthURLParser(
    redirectUri: string,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            const q: ParsedUrlQuery = url.parse(req.url, true).query;

            if (q.error) {
                throw new HTTPError(
                    HTTP_RESPONSE_STATUS_CODE.serverErrorResponse.internalServerError,
                    String(q.error),
                );
            }
            if (`google:${q.state}` !== req.session.state) {
                throw new HTTPError(HTTP_RESPONSE_STATUS_CODE.clientErrorResponse.conflict, "State mismatch");
            }

            const { tokens } = await oauth2Client.getToken({
                code: String(q.code),
                redirect_uri: redirectUri,
            });
            oauth2Client.setCredentials(tokens);

            const oauth2: oauth2_v2.Oauth2 = google.oauth2({
                auth: oauth2Client,
                version: "v2",
            });

            (req as RequestWithGoogleOAuth).profile = (await oauth2.userinfo.get()).data;
            next();
            return;
        } catch (error) {
            next(error);
        }
    };
}

export { oauth2Client, googleOAuthURLParser };
