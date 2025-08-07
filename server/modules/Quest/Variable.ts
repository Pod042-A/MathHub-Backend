import IsolatedVM from "isolated-vm";

const TYPE = ["constant", "variable"] as const;

export type APIObject = {
	type: (typeof TYPE)[number];
	value: string;
};

export class Variable {
	public static readonly Type: typeof TYPE = TYPE;

	protected type: (typeof Variable.Type)[number];
	protected value: string;

	public constructor(obj: unknown) {
		if (!Variable.isValid(obj)) {
			throw new TypeError("Invalid object for Variable object");
		}

		this.type = obj.type;
		this.value = obj.value;
	}

	public async getValue(): Promise<string> {
		if (this.type === "constant") {
			return this.value.trim().length > 0 ? this.value : "";
		}

		if (this.type === "variable") {
			const ISOLATE = new IsolatedVM.Isolate({ memoryLimit: 8 });
			const CONTEXT = await ISOLATE.createContext();
			const JAIL = CONTEXT.global;
			JAIL.set("global", JAIL.derefInto());

			try {
				const SCRIPT = await ISOLATE.compileScript(`(${this.value})()`);
				const RESULT = await SCRIPT.run(CONTEXT, { timeout: 5000 });
				return String(RESULT);
			} finally {
				CONTEXT.release();
				ISOLATE.dispose();
			}
		}

		throw new TypeError("Unexpected type in Variable object");
	}

	public static isValid(obj: unknown): obj is APIObject {
		if (obj === undefined || obj === null || typeof obj !== "object") {
			return false;
		}

		const OBJECT = obj as Record<string, unknown>;

		return (
			"type" in OBJECT &&
			typeof OBJECT.type === "string" &&
			(Variable.Type as readonly string[]).includes(OBJECT.type) &&
			"value" in OBJECT &&
			typeof OBJECT.value === "string"
		);
	}
}
