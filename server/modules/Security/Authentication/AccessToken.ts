import { Payload as BasePayload, Token } from "../Token/Token.js";
import { CONFIGURATION } from "../../../config/ServerConfiguration/index.js";

class Payload extends BasePayload {
    /**
     * @description 預設來源名稱
     */
    public static readonly iss: string = CONFIGURATION.accessToken.iss;
    /**
     * @description 預設接收對象名稱
     */
    public static readonly aud: string = CONFIGURATION.accessToken.aud;
}

class AccessToken extends Token {
    /**
     * @description 在 Redis 中存取時使用的前綴
     */
    public static readonly prefix: string = "accessToken";
}

export { Payload, AccessToken };
