import { Variable, type APIObject as VariableAPIObject } from "./Variable.js";

export type APIObject = {
	pattern: string;
	flags?: string;
} & VariableAPIObject;

export class QuestionVariable extends Variable {
	private _regex: RegExp;

	public constructor(obj: unknown) {
		if (!QuestionVariable.isValid(obj)) {
			throw new TypeError("Invalid object for QuestionVariable object");
		}

		super(obj);
		this._regex = new RegExp(obj.pattern, obj.flags);
	}

	public get regex(): RegExp {
		return this._regex;
	}

	public static isValid(obj: unknown): obj is APIObject {
		if (!(Variable.isValid(obj) && "pattern" in obj && typeof obj.pattern === "string")) {
			return false;
		}

		try {
			new RegExp(obj.pattern, "flags" in obj && typeof obj.flags === "string" ? obj.flags : "");
			return true;
		} catch {
			return false;
		}
	}

	public toJSON(): APIObject {
		return {
			pattern: this.regex.source,
			flags: this.regex.flags,
			type: this.type,
			value: this.value,
		};
	}

	public async toConstant(): Promise<APIObject> {
		return {
			pattern: this.regex.source,
			flags: this.regex.flags,
			type: this.type,
			value: await this.getValue(),
		};
	}
}
