import { Variable, type APIObject as VariableAPIObject } from "./Variable.js";

type Parameter = {
	pattern: string;
	flags?: string;
	index: number;
};

export type APIObject = { parameters?: Parameter[] } & VariableAPIObject;

export class AnswerVariable extends Variable {
	private _parameters: Parameter[];

	public constructor(obj: unknown) {
		if (!AnswerVariable.isValid(obj)) {
			throw new TypeError("Invalid object for AnswerVariable object");
		}

		super(obj);
		this._parameters = obj.parameters ?? [];
	}

	private static isValidParameter(obj: unknown): obj is Parameter {
		if (
			obj === undefined ||
			obj === null ||
			typeof obj !== "object" ||
			!("pattern" in obj && typeof obj.pattern === "string")
		) {
			return false;
		}

		try {
			new RegExp(obj.pattern, "flags" in obj && typeof obj.flags === "string" ? obj.flags : "");

			return (
				"index" in obj &&
				typeof obj.index === "number" &&
				Number.isInteger(obj.index) &&
				obj.index >= 0
			);
		} catch {
			return false;
		}
	}

	public static isValid(obj: unknown): obj is APIObject {
		if (!Variable.isValid(obj)) {
			return false;
		}

		if (
			"parameters" in obj &&
			!(
				Array.isArray(obj.parameters) &&
				(obj.parameters as unknown[]).every((param) => AnswerVariable.isValidParameter(param))
			)
		) {
			return false;
		}

		return true;
	}

	public toJSON(): APIObject {
		return {
			parameters: this._parameters,
			type: this.type,
			value: this.value,
		};
	}

	public async toConstant(values: string[]): Promise<APIObject> {
		if (this.type === "constant") {
			return this.toJSON();
		}

		if (this.type === "variable") {
			let functionString = this.value;
			for (const param of this._parameters) {
				const regex = new RegExp(param.pattern, param.flags);
				functionString = functionString.replace(regex, values[param.index]);
			}

			return {
				parameters: this._parameters,
				type: this.type,
				value: await new Variable({ type: this.type, value: functionString }).getValue(),
			};
		}

		throw new TypeError("Unexpected type in AnswerVariable object");
	}
}
