import { AnswerVariable, type APIObject as AnswerVariableAPIObject } from "./AnswerVariable.js";
import { QuestionVariable, type APIObject as QuestionVariableAPIObject } from "./QuestionVariable.js";

export type APIObject = {
    code: string;
    title: string;
    content?: string;
    imageURL?: string;
    solution?: string;
    questionVariable?: QuestionVariableAPIObject[];
    answerVariable: AnswerVariableAPIObject[];
    difficulty?: number;
    status?: number;
    tags?: number[];
};

export class QuestInput {
    private _code: string;
    private _title: string;
    private _content: string | null;
    private _imageURL: string | null;
    private _solution: string | null;
    private _questionVariable: QuestionVariable[] | null;
    private _answerVariable: AnswerVariable[] | null;
    private _difficulty: number | null;
    private _status: number | null;
    private _tags: Set<number> | null;

    public constructor(obj: unknown) {
        if (!QuestInput.isValid(obj)) {
            throw new TypeError("Invalid object for QuestInput object");
        }

        this._code = obj.code;
        this._title = obj.title;
        this._content = obj.content && obj.content.trim().length > 0 ? obj.content : null;
        this._imageURL = obj.imageURL && obj.imageURL.trim().length > 0 ? obj.imageURL : null;
        this._solution = obj.solution && obj.solution.trim().length > 0 ? obj.solution : null;
        this._questionVariable = obj.questionVariable
            ? obj.questionVariable.map((value) => new QuestionVariable(value))
            : [];
        this._answerVariable = obj.answerVariable.map((value) => new AnswerVariable(value));
        this._difficulty = obj.difficulty ?? null;
        this._status = obj.status ?? null;
        this._tags = new Set<number>(obj.tags);
    }

    public get code(): string {
        return this._code;
    }

    public get title(): string {
        return this._title;
    }

    public get content(): string | null {
        return this._content;
    }

    public get imageURL(): string | null {
        return this._imageURL;
    }

    public get solution(): string | null {
        return this._solution;
    }

    public get questionVariable(): QuestionVariable[] {
        return Array.from<QuestionVariable>(this._questionVariable ?? []);
    }

    public get answerVariable(): AnswerVariable[] {
        return Array.from<AnswerVariable>(this._answerVariable ?? []);
    }

    public get difficulty(): number | null {
        return this._difficulty;
    }

    public get status(): number | null {
        return this._status;
    }

    public get tags(): number[] {
        return Array.from<number>(this._tags ?? []);
    }

    public static isValid(obj: unknown): obj is APIObject {
        if (obj === undefined || obj === null || typeof obj !== "object") {
            return false;
        }

        const IS_VALID_CODE: boolean =
            "code" in obj && typeof obj.code === "string" && obj.code.trim().length > 0;
        const IS_VALID_TITLE: boolean =
            "title" in obj && typeof obj.title === "string" && obj.title.trim().length > 0;
        const IS_VALID_CONTENT: boolean =
            !("content" in obj) || ("content" in obj && typeof obj.content === "string");
        const IS_VALID_IMAGE_URL: boolean =
            !("imageURL" in obj) || ("imageURL" in obj && typeof obj.imageURL === "string");
        const IS_VALID_SOLUTION: boolean =
            !("solution" in obj) || ("solution" in obj && typeof obj.solution === "string");
        const IS_VALID_QUESTION_VARIABLE: boolean =
            !("questionVariable" in obj) ||
            ("questionVariable" in obj &&
                Array.isArray(obj.questionVariable) &&
                obj.questionVariable.every((value: unknown) => QuestionVariable.isValid(value)));
        const IS_VALID_ANSWER_VARIABLE: boolean =
            !("answerVariable" in obj) ||
            ("answerVariable" in obj &&
                Array.isArray(obj.answerVariable) &&
                obj.answerVariable.every((value: unknown) => AnswerVariable.isValid(value)));
        const IS_VALID_DIFFICULTY: boolean =
            !("difficulty" in obj) ||
            ("difficulty" in obj && typeof obj.difficulty === "number" && Number.isInteger(obj.difficulty));
        const IS_VALID_STATUS: boolean =
            !("status" in obj) ||
            ("status" in obj && typeof obj.status === "number" && Number.isInteger(obj.status));
        const IS_VALID_TAGS: boolean =
            !("tags" in obj) ||
            ("tags" in obj &&
                Array.isArray(obj.tags) &&
                obj.tags.every((value: unknown) => typeof value === "number" && Number.isInteger(value)));

        return (
            IS_VALID_CODE &&
            IS_VALID_TITLE &&
            IS_VALID_CONTENT &&
            IS_VALID_IMAGE_URL &&
            IS_VALID_SOLUTION &&
            IS_VALID_QUESTION_VARIABLE &&
            IS_VALID_ANSWER_VARIABLE &&
            IS_VALID_DIFFICULTY &&
            IS_VALID_STATUS &&
            IS_VALID_TAGS
        );
    }

    public toJSON(): APIObject {
        return {
            code: this.code,
            title: this.title,
            content: this.content ?? undefined,
            imageURL: this.imageURL ?? undefined,
            solution: this.solution ?? undefined,
            questionVariable: this.questionVariable.map((value) => value.toJSON()),
            answerVariable: this.answerVariable.map((value) => value.toJSON()),
            difficulty: this.difficulty ?? undefined,
            status: this.status ?? undefined,
            tags: this.tags,
        };
    }
}
