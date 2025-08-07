import { CONFIGURATION } from "../../../config/ServerConfiguration/index.js";
import crypto from "node:crypto";
import { Time } from "../../Time/Time.js";
import { Token, Payload as BasePayload, type PayloadObject as BasePayloadObject } from "../Token/Token.js";

const ACR_VALUE = {
    login: "arc:backend:login",
} as const;

const AMR_VALUE = {
    pwd: "pwd",
} as const;

type PayloadObject = BasePayloadObject & {
    authTime: number;
    nonce: string | null;
    atHash: string;
    acr: (typeof ACR_VALUE)[keyof typeof ACR_VALUE];
    amr: (typeof AMR_VALUE)[keyof typeof AMR_VALUE][];
};

class Payload extends BasePayload {
    /**
     * @description 預設來源名稱
     */
    public static readonly iss: string = CONFIGURATION.idToken.iss;
    /**
     * @description 預設接收對象名稱
     */
    public static readonly aud: string = CONFIGURATION.idToken.aud;
    /**
     * @description 操作強度類別
     */
    public static readonly acrValue: typeof ACR_VALUE = ACR_VALUE;
    /**
     * @description 身分驗證方法類別
     * @see {@link https://www.rfc-editor.org/rfc/rfc8176.html#section-2}
     */
    public static readonly amrValue: typeof AMR_VALUE = AMR_VALUE;

    /**
     * @name auth_time
     * @description 最後一次身分驗證時間
     * @description Time when the End-User authentication occurred. Its value is a JSON number representing the number of seconds from 1970-01-01T00:00:00Z as measured in UTC until the date/time. When a max_age request is made then this Claim is REQUIRED; otherwise, its inclusion is OPTIONAL.
     * @see {@link https://openid.net/specs/openid-connect-basic-1_0-47.html#IDToken}
     */
    private _authTime: number;
    /**
     * @name nonce
     * @description 單次驗證用隨機字串，建議使用 UUID
     * @description OPTIONAL. String value used to associate a Client session with an ID Token, and to mitigate replay attacks. The value is passed through unmodified from the Authentication Request to the ID Token. The Client MUST verify that the nonce Claim Value is equal to the value of the nonce parameter sent in the Authentication Request. If present in the Authentication Request, Authorization Servers MUST include a nonce Claim in the ID Token with the Claim Value being the nonce value sent in the Authentication Request. The nonce value is a case-sensitive string.
     * @see {@link https://openid.net/specs/openid-connect-basic-1_0-47.html#IDToken}
     */
    private _nonce: string | null;
    /**
     * @name at_hash
     * @description Access Token 雜湊值前半字串
     * @description OPTIONAL. Access Token hash value. This is OPTIONAL when the ID Token is issued from the Token Endpoint, which is the case for this subset of OpenID Connect; nonetheless, an at_hash Claim MAY be present. Its value is the base64url encoding of the left-most half of the hash of the octets of the ASCII representation of the access_token value, where the hash algorithm used is the hash algorithm used in the alg Header Parameter of the ID Token's JOSE Header. For instance, if the alg is RS256, hash the access_token value with SHA-256, then take the left-most 128 bits and base64url-encode them. The at_hash value is a case-sensitive string.
     * @see {@link https://openid.net/specs/openid-connect-basic-1_0-47.html#IDToken}
     */
    private _atHash: string;
    /**
     * @name acr
     * @description 此次操作允許的強度，使用 {@link acrValue} 進行設定
     * @description OPTIONAL. Authentication Context Class Reference. String specifying an Authentication Context Class Reference value that identifies the Authentication Context Class that the authentication performed satisfied. The value "0" indicates the End-User authentication did not meet the requirements of ISO/IEC 29115 [ISO29115] level 1. For historic reasons, the value "0" is used to indicate that there is no confidence that the same person is actually there. Authentications with level 0 SHOULD NOT be used to authorize access to any resource of any monetary value. An absolute URI or an RFC 6711 [RFC6711] registered name SHOULD be used as the acr value; registered names MUST NOT be used with a different meaning than that which is registered. Parties using this claim will need to agree upon the meanings of the values used, which may be context specific. The acr value is a case-sensitive string.
     * @see {@link https://openid.net/specs/openid-connect-basic-1_0-47.html#IDToken}
     */
    private _acr: (typeof Payload.acrValue)[keyof typeof Payload.acrValue];
    /**
     * @name amr
     * @description 身分驗證方法，使用 {@link amrValue} 進行設定
     * @description OPTIONAL. Authentication Methods References. JSON array of strings that are identifiers for authentication methods used in the authentication. For instance, values might indicate that both password and OTP authentication methods were used. The amr value is an array of case-sensitive strings. Values used in the amr Claim SHOULD be from those registered in the IANA Authentication Method Reference Values registry [IANA.AMR] established by [RFC8176]; parties using this claim will need to agree upon the meanings of any unregistered values used, which may be context specific.
     * @see {@link https://openid.net/specs/openid-connect-basic-1_0-47.html#IDToken}
     */
    private _amr: (typeof Payload.amrValue)[keyof typeof Payload.amrValue][];

    /**
     * @param iss 來源名稱
     * @param sub 實體身分辨識碼
     * @param aud 接收對象名稱
     * @param exp 到期時間
     * @param nbf 生效時間
     * @param iat 簽發時間
     * @param jti JWT 的唯一識別碼
     * @param authTime 最後一次身分驗證時間
     * @param nonce 單次驗證用隨機字串
     * @param atHash Access Token 雜湊值前半字串
     * @param acr 此次操作允許的強度
     * @param amr 身分驗證方法
     */
    public constructor(
        iss: string,
        sub: string,
        aud: string,
        exp: number,
        nbf: number,
        iat: number,
        jti: string,
        authTime: number,
        nonce: string | null,
        atHash: string,
        acr: (typeof ACR_VALUE)[keyof typeof ACR_VALUE],
        amr: (typeof AMR_VALUE)[keyof typeof AMR_VALUE][],
    ) {
        if (!Time.isValid(authTime)) {
            throw new Error("Unexpected argument for ID Token Payload object");
        }

        super(iss, sub, aud, exp, nbf, iat, jti);

        this._authTime = authTime;
        this._nonce = nonce;
        this._atHash = atHash;
        this._acr = acr;
        this._amr = amr;
    }

    private get authTime(): number {
        return this._authTime;
    }

    private get nonce(): string | null {
        if (typeof this._nonce === "string") {
            return this._nonce.trim().length > 0 ? this._nonce : "";
        }
        return null;
    }

    private get atHash(): string {
        return this._atHash.trim().length > 0 ? this._atHash : "";
    }

    private get acr(): (typeof Payload.acrValue)[keyof typeof Payload.acrValue] {
        return this._acr;
    }

    private get amr(): (typeof Payload.amrValue)[keyof typeof Payload.amrValue][] {
        return this._amr;
    }

    public static createAtHash(accessTokenString: string): string {
        const HASH: Buffer = crypto.createHash("sha256").update(accessTokenString, "ascii").digest();
        return HASH.subarray(0, HASH.length / 2).toString();
    }

    public static isValid(obj: unknown): obj is PayloadObject {
        return (
            BasePayload.isValid(obj) &&
            "authTime" in obj &&
            Time.isValid(obj.authTime) &&
            "nonce" in obj &&
            (obj.nonce === null || typeof obj.nonce === "string") &&
            "atHash" in obj &&
            typeof obj.atHash === "string" &&
            "acr" in obj &&
            typeof obj.acr === "string" &&
            (Object.values(Payload.acrValue) as readonly string[]).includes(obj.acr) &&
            "amr" in obj &&
            Array.isArray(obj.amr) &&
            obj.amr.every(
                (value: unknown): value is (typeof Payload.amrValue)[keyof typeof Payload.amrValue] =>
                    typeof value === "string" &&
                    (Object.values(Payload.amrValue) as readonly string[]).includes(value),
            )
        );
    }
}

class IDToken extends Token {
    /**
     * @description 在 Redis 中存取時使用的前綴
     */
    public static readonly prefix: string = "idToken";

    protected _payloadEntity: Payload;

    private constructor(
        header: string,
        payload: string,
        signature: string,
        payloadEntity: Payload | null = null,
    ) {
        super(header, payload, signature);

        if (payloadEntity !== null) {
            this._payloadEntity = payloadEntity;
            return;
        }

        const payloadObject: unknown = JSON.parse(Buffer.from(payload, "base64url").toString());

        if (!Payload.isValid(payloadObject)) {
            throw new Error("Invalid ID Token payload string");
        }

        this._payloadEntity = new Payload(
            payloadObject.iss,
            payloadObject.sub,
            payloadObject.aud,
            payloadObject.exp,
            payloadObject.nbf,
            payloadObject.iat,
            payloadObject.jti,
            payloadObject.authTime,
            payloadObject.nonce,
            payloadObject.atHash,
            payloadObject.acr,
            payloadObject.amr,
        );

        return;
    }

    public static createFromPayload(payload: Payload): IDToken {
        const PAYLOAD: string = Buffer.from(payload.toString()).toString("base64url");
        const SIGNATURE: string = crypto
            .sign("sha256", Buffer.from(`${Token.header}.${PAYLOAD}`), {
                key: Token.key.privateKey,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            })
            .toString("base64url");
        return new IDToken(Token.header, PAYLOAD, SIGNATURE, payload);
    }

    public static createFromTokenString(tokenString: string): IDToken {
        const TOKEN_STRING: string[] = tokenString.split(".");
        if (TOKEN_STRING.length !== 3) {
            throw new Error("Invalid token string");
        }
        const [HEADER, PAYLOAD, SIGNATURE] = TOKEN_STRING;
        return new IDToken(HEADER, PAYLOAD, SIGNATURE);
    }

    public get payloadEntity(): Payload {
        return this._payloadEntity;
    }
}

export { Payload, IDToken };
