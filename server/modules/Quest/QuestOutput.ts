import { QuestInput, type APIObject as QuestInputAPIObject } from "./QuestInput.js";

export type APIObject = {
    id: string;
    publishTime: number | string;
    publisherName: string;
} & QuestInputAPIObject;

// FIXME: Change data structure
export class QuestOutput extends QuestInput {
    private _id: string;
    private _publishTime: number;
    private _publisherName: string;

    public constructor(obj: unknown) {
        if (!QuestOutput.isValid(obj)) {
            throw new TypeError("Invalid object for QuestOutput object");
        }

        super(obj);
        this._id = obj.id;
        this._publishTime = Number(obj.publishTime);
        this._publisherName = obj.publisherName;
    }

    public get id(): string {
        return this._id.trim().length > 0 ? this._id : "";
    }

    public get publishTime(): number {
        return this._publishTime;
    }

    public get publisherName(): string {
        return this._publisherName.trim().length > 0 ? this._publisherName : "";
    }

    public static isValid(obj: unknown): obj is APIObject {
        return (
            QuestInput.isValid(obj) &&
            "id" in obj &&
            typeof obj.id === "string" &&
            "publishTime" in obj &&
            ((typeof obj.publishTime === "string" && NUMBER_PATTERN.test(obj.publishTime)) ||
                (typeof obj.publishTime === "number" && Number.isInteger(obj.publishTime))) &&
            "publisherName" in obj &&
            typeof obj.publisherName === "string"
        );
    }

    public toJSON(): APIObject {
        return {
            id: this.id,
            publishTime: this.publishTime,
            publisherName: this.publisherName,
            code: this.code,
            title: this.title,
            question: this.question,
            questionVariable: this.questionVariable.map((value) => value.toJSON()),
            answerVariable: this.answerVariable.map((value) => value.toJSON()),
            status: this.status,
            tags: this.tags,
        };
    }

    public async forQuestion(): Promise<APIObject> {
        return {
            id: this.id,
            publishTime: this.publishTime,
            publisherName: this.publisherName,
            code: this.code,
            title: this.title,
            question: this.question,
            questionVariable: await Promise.all(this.questionVariable.map((value) => value.toConstant())),
            answerVariable: [],
            status: this.status,
            tags: this.tags,
        };
    }
}
