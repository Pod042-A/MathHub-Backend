import { createClient } from "redis";
import type { Configuration } from "../../../config/RedisConfiguration/type.js";
import { CONFIGURATION } from "../../../config/RedisConfiguration/index.js";

export class Redis {
    /**
     * @description 產生 Redis 連線 URL 字串
     */
    private static url(configuration: Configuration): string {
        return `redis://${configuration.username ?? ""}${configuration.password ? `:${configuration.password}` : ""}${configuration.username || configuration.password ? "@" : ""}${configuration.host}${configuration.port ? `:${configuration.port}` : ""}`;
    }

    public static client: ReturnType<typeof createClient> = createClient({
        url: Redis.url(CONFIGURATION),
    });

    public static async connect(): Promise<void> {
        if (!Redis.client.isOpen) {
            await Redis.client.connect();
        }
        return;
    }

    /**
     * @description 關閉資料庫連線
     */
    public static async disconnect(): Promise<void> {
        // TODO: Log message formalize
        console.log("Closing Redis connection...");
        if (Redis.client.isOpen) {
            await Redis.client.quit();
        }
        console.log("Redis connection closed.");
    }
}
