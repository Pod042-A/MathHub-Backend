import crypto from "node:crypto";
import { promisify } from "node:util";
import { Redis } from "../../Database/Redis/index.js";

export class Key {
    private _publicKey: string;
    private _privateKey: string;

    private static readonly prefix: string = "key";

    private constructor(publicKey: string, privateKey: string) {
        this._publicKey = publicKey;
        this._privateKey = privateKey;
    }

    /**
     * @description 隨機產生密鑰對
     * @returns Key 物件
     */
    public static async generateKey(): Promise<Key> {
        const { publicKey, privateKey } = await promisify(crypto.generateKeyPair)("rsa", {
            modulusLength: 2048,
            publicKeyEncoding: { type: "spki", format: "pem" },
            privateKeyEncoding: { type: "pkcs8", format: "pem" },
        });

        await Redis.connect();
        await Promise.all([
            Redis.client.set(`${Key.prefix}:publicKey`, publicKey),
            Redis.client.set(`${Key.prefix}:privateKey`, privateKey),
        ]);

        return new Key(publicKey, privateKey);
    }

    /**
     * @description 根據密鑰字串建立 `Key` 物件
     * @param publicKey 公鑰字串
     * @param privateKey 私鑰字串
     * @returns Key 物件
     */
    public static from(publicKey: string, privateKey: string): Key {
        return new Key(publicKey, privateKey);
    }

    public get publicKey(): string {
        return this._publicKey;
    }

    public get privateKey(): string {
        return this._privateKey;
    }
}
