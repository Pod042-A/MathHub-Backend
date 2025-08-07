import "express-session";

declare module "express-session" {
    interface SessionData {
        /**
         * @description OAuth session
         */
        state?: string;
        /**
         * @description CSRF Token
         */
        csrfToken?: string;
    }
}
