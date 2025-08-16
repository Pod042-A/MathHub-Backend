// biome-ignore-all lint/nursery/noSecrets: Column name is not a secret.
import type { Column } from "../../../../type.js";

export const PRIVILEGES: Record<string, Column> = {
    isActivated: {
        name: "isActivated",
        type: "BOOLEAN",
    },
    allowLogin: {
        name: "allowLogin",
        type: "BOOLEAN",
    },
    allowGetQuestList: {
        name: "allowGetQuestList",
        type: "BOOLEAN",
    },
    allowGetQuestData: {
        name: "allowGetQuestData",
        type: "BOOLEAN",
    },
    allowCreateQuest: {
        name: "allowCreateQuest",
        type: "BOOLEAN",
    },
    allowAnswerQuest: {
        name: "allowAnswerQuest",
        type: "BOOLEAN",
    },
    allowGetNoticeData: {
        name: "allowGetNoticeData",
        type: "BOOLEAN",
    },
    allowCreateNotice: {
        name: "allowCreateNotice",
        type: "BOOLEAN",
    },
    allowEditNotice: {
        name: "allowEditNotice",
        type: "BOOLEAN",
    },
    allowDeleteNotice: {
        name: "allowDeleteNotice",
        type: "BOOLEAN",
    },
} as const;
