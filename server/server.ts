import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";

import { CONFIGURATION } from "./config/ServerConfiguration/index.js";
import { ROUTER as AuthenticationRouter } from "./router/AuthenticationRouter.js";
import { ROUTER as SecurityRouter } from "./router/SecurityRouter.js";
import { ROUTER as AdminRouter } from "./router/AdminRouter.js";
import { ROUTER as QuestRouter } from "./router/QuestRouter.js";

import process from "node:process";
import { EventEmitter } from "node:events";
import { Database } from "./modules/Database/PostgreSQL/MathHubMainDatabase/index.js";
import { routerErrorHandler } from "./middleware/RouterErrorHandler.js";
import crypto from "node:crypto";

import swaggerJsdoc from "swagger-jsdoc";
import { serve, setup } from "swagger-ui-express";
import swagger from "./swagger.json";
import type { Server } from "node:http";
import { Redis } from "./modules/Database/Redis/index.js";
import { RedisStore } from "connect-redis";
import { Token } from "./modules/Security/Token/Token.js";
import { Time } from "./modules/Time/Time.js";

// 伺服器初始化函式
const PORT: number = CONFIGURATION.port;
let server: Server | null = null;
(async () => {
    // TODO: Secret rotation
    // biome-ignore-start lint/nursery/noMagicNumbers: Reasonable value.
    const SECRET: string = crypto.randomBytes(32).toString("hex");
    await Redis.connect();

    const REDIS_STORE: RedisStore = new RedisStore({
        client: Redis.client,
        prefix: "sess:",
    });

    const APP: Express = express();
    APP.use(cors());
    APP.use(express.json());
    APP.use(cookieParser(SECRET));
    APP.use(
        session({
            store: REDIS_STORE,
            secret: SECRET,
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                // secure: true, // TODO: 只在 HTTPS 下傳輸
                sameSite: "lax",
                maxAge: new Time(Time.now(), "15m").duration.millisecond,
            },
        }),
    );
    // biome-ignore-end lint/nursery/noMagicNumbers: Reasonable value.

    // 模組化路由函式
    APP.use(
        "/swagger",
        serve,
        setup(
            swaggerJsdoc({
                definition: swagger,
                apis: ["./build/router/*.js"],
            }),
            {
                customCss: ".header-example { word-break: break-all; }",
            },
        ),
    );
    APP.use("/security", SecurityRouter);
    APP.use("/auth", AuthenticationRouter);
    APP.use("/quest", QuestRouter);
    APP.use("/admin", AdminRouter);

    APP.get("/", (_req: Request, res: Response) => {
        res.send("MathHub API is running...");
        return;
    });

    // 路由函式錯誤處理中介層，必須在所有中介層及路由函式之後。
    APP.use(routerErrorHandler);

    await Token.initialize();

    server = APP.listen(PORT, () => {
        console.log(`Server running on port ${PORT}...`);
        return;
    });

    return;
})().catch((error) => {
    // TODO: Log message formalize
    console.error(error);
    process.exit(1);
});

/**
 * @description 伺服器終止函式
 */
async function shutdownServer(): Promise<void> {
    // TODO: Log message formalize
    console.log("Server shutting down...");

    await Promise.all([Database.disconnect(), Redis.disconnect()]);

    server?.close();

    console.log("Server shutdown complete.");
}

/**
 * 監聽程式終止訊號，以便觸發伺服器終止程序。\
 * 使用 `EventEmitter` 確保只會觸發一次伺服器終止函式。
 */
const SHUTDOWN_EMITTER: EventEmitter = new EventEmitter();
SHUTDOWN_EMITTER.once("shutdown", shutdownServer);

// Ctrl + C 終止
process.on("SIGINT", () => SHUTDOWN_EMITTER.emit("shutdown"));

// 系統發出的終止訊號
process.on("SIGTERM", () => SHUTDOWN_EMITTER.emit("shutdown"));
