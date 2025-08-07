import { Pool } from "pg";
import { CONFIGURATION } from "../../../../config/PostgreSQLConfiguration/index.js";
import type { Schema } from "./type.js";
import { USER } from "./Schemas/index.js";
import { QUEST } from "./Schemas/quest/index.js";
import { NOTICEBOARD } from "./Schemas/noticeboard/index.js";

export class Database {
    /**
     * @description PostgreSQL 連線池
     */
    public static pool: Pool = new Pool(CONFIGURATION);

    public static readonly dbName: string = "main";
    public static readonly schemas: Record<string, Schema> = {
        user: USER,
        quest: QUEST,
        noticeboard: NOTICEBOARD,
    } as const;

    /**
     * @description 關閉資料庫連線
     */
    public static async disconnect(): Promise<void> {
        // TODO: Log message formalize
        console.log(`Disconnecting database "${CONFIGURATION.host}"...`);
        await Database.pool.end();
        console.log(`Disconnected database "${CONFIGURATION.host}"`);
    }
}
