"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_session_1 = __importDefault(require("express-session"));
const index_js_1 = require("./config/ServerConfiguration/index.js");
const AuthenticationRouter_js_1 = require("./router/AuthenticationRouter.js");
const SecurityRouter_js_1 = require("./router/SecurityRouter.js");
const AdminRouter_js_1 = require("./router/AdminRouter.js");
const node_process_1 = __importDefault(require("node:process"));
const node_events_1 = require("node:events");
const index_js_2 = require("./modules/Database/PostgreSQL/MathHubMainDatabase/index.js");
const RouterErrorHandler_js_1 = require("./middleware/RouterErrorHandler.js");
const node_crypto_1 = __importDefault(require("node:crypto"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = require("swagger-ui-express");
const swagger_json_1 = __importDefault(require("./swagger.json"));
const index_js_3 = require("./modules/Database/Redis/index.js");
const connect_redis_1 = require("connect-redis");
const Token_js_1 = require("./modules/Security/Token/Token.js");
const Time_js_1 = require("./modules/Time/Time.js");
// 伺服器初始化函式
const PORT = index_js_1.CONFIGURATION.port;
let server = null;
(async () => {
    // TODO: Secret rotation
    // biome-ignore-start lint/nursery/noMagicNumbers: Reasonable value.
    const SECRET = node_crypto_1.default.randomBytes(32).toString("hex");
    await index_js_3.Redis.connect();
    const REDIS_STORE = new connect_redis_1.RedisStore({
        client: index_js_3.Redis.client,
        prefix: "sess:",
    });
    const APP = (0, express_1.default)();
    APP.use((0, cors_1.default)());
    APP.use(express_1.default.json());
    APP.use((0, cookie_parser_1.default)(SECRET));
    APP.use((0, express_session_1.default)({
        store: REDIS_STORE,
        secret: SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            // secure: true, // TODO: 只在 HTTPS 下傳輸
            sameSite: "lax",
            maxAge: new Time_js_1.Time(Time_js_1.Time.now(), "15m").duration.millisecond,
        },
    }));
    // biome-ignore-end lint/nursery/noMagicNumbers: Reasonable value.
    // 模組化路由函式
    APP.use("/swagger", swagger_ui_express_1.serve, (0, swagger_ui_express_1.setup)((0, swagger_jsdoc_1.default)({
        definition: swagger_json_1.default,
        apis: ["./build/router/*.js"],
    }), {
        customCss: ".header-example { word-break: break-all; }",
    }));
    APP.use("/security", SecurityRouter_js_1.ROUTER);
    APP.use("/auth", AuthenticationRouter_js_1.ROUTER);
    // APP.use("/quest", QuestRouter);
    APP.use("/admin", AdminRouter_js_1.ROUTER);
    APP.get("/", (_req, res) => {
        res.send("MathHub API is running...");
        return;
    });
    // 路由函式錯誤處理中介層，必須在所有中介層及路由函式之後。
    APP.use(RouterErrorHandler_js_1.routerErrorHandler);
    await Token_js_1.Token.initialize();
    server = APP.listen(PORT, () => {
        console.log(`Server running on port ${PORT}...`);
        return;
    });
    return;
})().catch((error) => {
    // TODO: Log message formalize
    console.error(error);
    node_process_1.default.exit(1);
});
/**
 * @description 伺服器終止函式
 */
async function shutdownServer() {
    // TODO: Log message formalize
    console.log("Server shutting down...");
    await Promise.all([index_js_2.Database.disconnect(), index_js_3.Redis.disconnect()]);
    server?.close();
    console.log("Server shutdown complete.");
}
/**
 * 監聽程式終止訊號，以便觸發伺服器終止程序。\
 * 使用 `EventEmitter` 確保只會觸發一次伺服器終止函式。
 */
const SHUTDOWN_EMITTER = new node_events_1.EventEmitter();
SHUTDOWN_EMITTER.once("shutdown", shutdownServer);
// Ctrl + C 終止
node_process_1.default.on("SIGINT", () => SHUTDOWN_EMITTER.emit("shutdown"));
// 系統發出的終止訊號
node_process_1.default.on("SIGTERM", () => SHUTDOWN_EMITTER.emit("shutdown"));
