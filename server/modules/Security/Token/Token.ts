import crypto from "node:crypto";
import { Key } from "./Key.js";

type PayloadObject = {
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    nbf: number;
    iat: number;
    jti: string;
};

class Payload {
    /**
     * @name "iss" (Issuer) Claim
     * @description 來源名稱，建議使用域名
     * @description The "iss" (issuer) claim identifies the principal that issued the JWT.
     * The processing of this claim is generally application specific.
     * The "iss" value is a case-sensitive string containing a StringOrURI value.
     * Use of this claim is OPTIONAL.
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1}
     */
    private _iss: string;

    /**
     * @name "sub" (Subject) Claim
     * @description 實體身分辨識碼，建議使用用戶 ID
     * @description The "sub" (subject) claim identifies the principal that is the subject of the JWT.
     * The claims in a JWT are normally statements about the subject.
     * The subject value MUST either be scoped to be locally unique in the context of the issuer or be globally unique.
     * The processing of this claim is generally application specific. The "sub" value is a case-sensitive string containing a StringOrURI value.
     * Use of this claim is OPTIONAL.
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.2}
     */
    private _sub: string;

    /**
     * @name "aud" (Audience) Claim
     * @description 接收對象名稱，建議使用域名
     * @description The "aud" (audience) claim identifies the recipients that the JWT is intended for.
     * Each principal intended to process the JWT MUST identify itself with a value in the audience claim.
     * If the principal processing the claim does not identify itself with a value in the "aud" claim when this claim is present, then the JWT MUST be rejected.
     * In the general case, the "aud" value is an array of case-sensitive strings, each containing a StringOrURI value.
     * In the special case when the JWT has one audience, the "aud" value MAY be a single case-sensitive string containing a StringOrURI value.
     * The interpretation of audience values is generally application specific.
     * Use of this claim is OPTIONAL.
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3}
     */
    private _aud: string;

    /**
     * @name "exp" (Expiration Time) Claim
     * @description 到期時間，使用以秒為單位的 UNIX 時間戳
     * @description The "exp" (expiration time) claim identifies the expiration time on or after which the JWT MUST NOT be accepted for processing.
     * The processing of the "exp" claim requires that the current date/time MUST be before the expiration date/time listed in the "exp" claim.
     * Implementers MAY provide for some small leeway, usually no more than a few minutes, to account for clock skew.
     * Its value MUST be a number containing a NumericDate value.
     * Use of this claim is OPTIONAL.
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.4}
     */
    private _exp: number;

    /**
     * @name "nbf" (Not Before) Claim
     * @description 生效時間，使用以秒為單位的 UNIX 時間戳
     * @description The "nbf" (not before) claim identifies the time before which the JWT MUST NOT be accepted for processing.
     * The processing of the "nbf" claim requires that the current date/time MUST be after or equal to the not-before date/time listed in the "nbf" claim.
     * Implementers MAY provide for some small leeway, usually no more than a few minutes, to account for clock skew.
     * Its value MUST be a number containing a NumericDate value.
     * Use of this claim is OPTIONAL.
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.5}
     */
    private _nbf: number;

    /**
     * @name "iat" (Issued At) Claim
     * @description 簽發時間，使用以秒為單位的 UNIX 時間戳
     * @description The "iat" (issued at) claim identifies the time at which the JWT was issued.
     * This claim can be used to determine the age of the JWT.
     * Its value MUST be a number containing a NumericDate value.
     * Use of this claim is OPTIONAL.
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.6}
     */
    private _iat: number;

    /**
     * @name "jti" (JWT ID) Claim
     * @description JWT 的唯一識別碼，產生新的 Token 時需要生成隨機 UUID
     * @description The "jti" (JWT ID) claim provides a unique identifier for the JWT.
     * The identifier value MUST be assigned in a manner that ensures that there is a negligible probability that the same value will be accidentally assigned to a different data object;
     * if the application uses multiple issuers, collisions MUST be prevented among values produced by different issuers as well.
     * The "jti" claim can be used to prevent the JWT from being replayed.
     * The "jti" value is a case-sensitive string.
     * Use of this claim is OPTIONAL.
     * @see {@link https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.7}
     */
    private _jti: string;

    /**
     * @param iss 來源名稱
     * @param sub 實體身分辨識碼
     * @param aud 接收對象名稱
     * @param exp 到期時間
     * @param nbf 生效時間
     * @param iat 簽發時間
     * @param jti JWT 的唯一識別碼
     */
    public constructor(
        iss: string,
        sub: string,
        aud: string,
        exp: number,
        nbf: number,
        iat: number,
        jti: string,
    ) {
        this._iss = iss;
        this._sub = sub;
        this._aud = aud;
        this._exp = exp;
        this._nbf = nbf;
        this._iat = iat;
        this._jti = jti;
    }

    public get iss(): string {
        return this._iss.trim().length > 0 ? this._iss : "";
    }

    public get sub(): string {
        return this._sub.trim().length > 0 ? this._sub : "";
    }

    public get aud(): string {
        return this._aud.trim().length > 0 ? this._aud : "";
    }

    public get exp(): number {
        return this._exp;
    }

    public get nbf(): number {
        return this._nbf;
    }

    public get iat(): number {
        return this._iat;
    }

    public get jti(): string {
        return this._jti.trim().length > 0 ? this._jti : "";
    }

    public static isValid(obj: unknown): obj is PayloadObject {
        if (obj === undefined || obj === null || typeof obj !== "object") {
            return false;
        }

        const OBJECT = obj as Record<string, unknown>;

        return (
            "iss" in OBJECT &&
            typeof OBJECT.iss === "string" &&
            "sub" in OBJECT &&
            typeof OBJECT.sub === "string" &&
            "aud" in OBJECT &&
            typeof OBJECT.aud === "string" &&
            "exp" in OBJECT &&
            typeof OBJECT.exp === "number" &&
            Number.isInteger(OBJECT.exp) &&
            "nbf" in OBJECT &&
            typeof OBJECT.nbf === "number" &&
            Number.isInteger(OBJECT.nbf) &&
            "iat" in OBJECT &&
            typeof OBJECT.iat === "number" &&
            Number.isInteger(OBJECT.iat) &&
            "jti" in OBJECT &&
            typeof OBJECT.jti === "string"
        );
    }

    public toJSON(): PayloadObject {
        return {
            iss: this.iss,
            sub: this.sub,
            aud: this.aud,
            exp: this.exp,
            nbf: this.nbf,
            iat: this.iat,
            jti: this.jti,
        };
    }

    public toString(): string {
        return JSON.stringify(this.toJSON());
    }
}

class Token {
    private _header: string;
    private _payload: string;
    private _signature: string;

    protected static key: Key;
    protected static header: string = Buffer.from(
        JSON.stringify({
            alg: "RS256",
            typ: "JWT",
        }),
    ).toString("base64url");

    protected _payloadEntity: Payload;

    /**
     * @description 初始化靜態屬性
     */
    public static async initialize(): Promise<void> {
        Token.key = await Key.generateKey();
        return;
    }

    public constructor(
        header: string,
        payload: string,
        signature: string,
        payloadEntity: Payload | null = null,
    ) {
        if (payloadEntity !== null) {
            this._payloadEntity = payloadEntity;
        }

        const payloadObject: unknown = JSON.parse(Buffer.from(payload, "base64url").toString());

        if (!Payload.isValid(payloadObject)) {
            throw new Error("Invalid Token payload string");
        }

        this._header = header;
        this._payload = payload;
        this._signature = signature;
        this._payloadEntity = new Payload(
            payloadObject.iss,
            payloadObject.sub,
            payloadObject.aud,
            payloadObject.exp,
            payloadObject.nbf,
            payloadObject.iat,
            payloadObject.jti,
        );

        return;
    }

    /**
     * @description 根據 `Payload` 物件建立 `Token` 物件
     * @param payload Token 負載資料 `Payload` 物件
     * @returns Token 物件
     */
    public static createFromPayload(payload: Payload): Token {
        const PAYLOAD: string = Buffer.from(payload.toString()).toString("base64url");
        const SIGNATURE: string = crypto
            .sign("sha256", Buffer.from(`${Token.header}.${PAYLOAD}`), {
                key: Token.key.privateKey,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            })
            .toString("base64url");
        return new Token(Token.header, PAYLOAD, SIGNATURE, payload);
    }

    /**
     * @description 根據 Token 字串建立 `Token` 物件
     * @param tokenString Token 字串
     * @returns Token 物件
     */
    public static createFromTokenString(tokenString: string): Token {
        const TOKEN_STRING: string[] = tokenString.split(".");
        if (TOKEN_STRING.length !== 3) {
            throw new Error("Invalid token string");
        }
        const [HEADER, PAYLOAD, SIGNATURE] = TOKEN_STRING;
        return new Token(HEADER, PAYLOAD, SIGNATURE);
    }

    /**
     * @description 驗證 `Token` 物件是否有效
     * @param token Token 物件
     */
    public static isValid(token: Token): boolean {
        return (
            token.header.length > 0 &&
            token.payload.length > 0 &&
            token.signature.length > 0 &&
            crypto.verify(
                "sha256",
                Buffer.from(`${token.header}.${token.payload}`),
                {
                    key: Token.key.publicKey,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                },
                Buffer.from(token.signature, "base64url"),
            )
        );
    }

    public get header(): string {
        return this._header.trim().length > 0 ? this._header : "";
    }

    public get payload(): string {
        return this._payload.trim().length > 0 ? this._payload : "";
    }

    public get signature(): string {
        return this._signature.trim().length > 0 ? this._signature : "";
    }

    public get payloadEntity(): Payload {
        return this._payloadEntity;
    }

    /**
     * @description 輸出 Token 字串
     * @returns Token 字串
     */
    public toString(): string {
        return `${this.header}.${this.payload}.${this.signature}`;
    }
}

export { type PayloadObject, Payload, Token };
