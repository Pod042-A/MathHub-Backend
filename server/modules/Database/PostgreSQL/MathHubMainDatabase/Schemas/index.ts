import type { Schema } from "../type.js";
import { DATA } from "./user/data/index.js";
import { GROUP_PRIVILEGES } from "./user/groupPrivileges/index.js";
import { USER_PRIVILEGES } from "./user/userPrivileges/index.js";

export const USER: Schema = {
    name: "user",
    tables: {
        data: DATA,
        groupPrivileges: GROUP_PRIVILEGES,
        userPrivileges: USER_PRIVILEGES,
    },
} as const;
