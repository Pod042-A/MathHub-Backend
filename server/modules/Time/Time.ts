/**
 * @class Time
 * @description 統一使用以秒為單位的 UNIX 時間戳
 */
export class Time {
    private static readonly durationFormat: RegExp = /^(\d+)([smhd])$/i;

    private _start: number;
    private _precision: number;
    private _duration: number;

    public static now(): number {
        return Math.floor(Date.now() / 1000);
    }

    /**
     * @param start 起始時間
     * @param duration 時間長度。參數為數字時單位為「秒」；參數為時間縮寫字串時，可使用格式如 `30s`、`5m`、`2h`、`1d` 的字串，忽略大小寫。
     */
    public constructor(start: number | Date = Time.now(), duration: number | string = 0) {
        if (typeof start === "number") {
            this._start = Math.floor(start);
            this._precision = start - this._start;
        } else if (start instanceof Date) {
            this._start = Math.floor(start.getTime() / 1000);
            this._precision = start.getTime() / 1000 - this._start;
        } else {
            throw new TypeError("Unexpected argument for Time object");
        }

        if (typeof duration === "number") {
            this._duration = Math.floor(duration);
        } else if (typeof duration === "string") {
            const match = duration.match(Time.durationFormat);

            if (!match) {
                throw new Error("Invalid duration format");
            }

            const [_, durationValue, durationUnit] = match;
            switch (durationUnit.toLowerCase()) {
                case "s":
                    this._duration = Number.parseInt(durationValue, 10);
                    break;
                case "m":
                    this._duration = Number.parseInt(durationValue, 10) * 60;
                    break;
                case "h":
                    this._duration = Number.parseInt(durationValue, 10) * 3600;
                    break;
                case "d":
                    this._duration = Number.parseInt(durationValue, 10) * 86400;
                    break;
                default:
                    throw new Error("Unexpected argument for Time object");
            }
        } else {
            throw new TypeError("Unexpected argument for Time object");
        }
    }

    public get start(): { second: number; millisecond: number } {
        return { second: this._start, millisecond: (this._start + this._precision) * 1000 };
    }

    public get duration(): { second: number; millisecond: number } {
        return { second: this._duration, millisecond: this._duration * 1000 };
    }

    public static isValid(obj: unknown): obj is number {
        return typeof obj === "number" && Number.isSafeInteger(obj) && obj >= 0;
    }

    public getMilliseconds(): number {
        return (this._start + this._precision + this._duration) * 1000;
    }

    public valueOf(): number {
        return this._start + this._duration;
    }
}
