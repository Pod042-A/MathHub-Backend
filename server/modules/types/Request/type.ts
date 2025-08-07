import type { Request } from "express";
import type { AccessToken } from "../../Security/Authentication/AccessToken.js";
import type { oauth2_v2 } from "googleapis";

// biome-ignore-start lint/suspicious/noExplicitAny: Any is necessary since Express defined.
type RequestBody<T> = Request<any, any, T>;
type RequestQuery<T> = Request<any, any, any, T>;
// biome-ignore-end lint/suspicious/noExplicitAny: Any is necessary since Express defined.

type RequestWithAccessToken<T extends Request = Request> = T & {
    accessToken: AccessToken;
};

type RequestWithGoogleOAuth<T extends Request = Request> = T & {
    profile: oauth2_v2.Schema$Userinfo;
};

export type { RequestBody, RequestQuery, RequestWithAccessToken, RequestWithGoogleOAuth };
