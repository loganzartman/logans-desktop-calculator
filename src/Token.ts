export type TokenType = "symbol" | "operator" | "local";

export type TokenArgs = {type: TokenType, value: any, location?: number, length?: number, tags?: Set<string>};

export default class Token {
    type: TokenType;
    value: any;
    location?: number;
    length?: number;
    tags?: Set<string>;

    constructor({type, value, location, length, tags}: TokenArgs) {
        this.type = type;
        this.value = value;
        this.location = location;
        this.length = length;
        this.tags = tags;
    }

    clone(args?: Partial<TokenArgs>): Token {
        const {type, value, location, length, tags} = {...this, ...args};
        return new Token({type, value, location, length, tags});
    }

    serialize(): string {
        if (this.type === "operator") {
            return `${this.value}`;
        }
        if (typeof this.value === "string") {
            return `(${this.value})`;
        }
        return `${this.value}`;
    }
}