export class InputExhausted extends Error {}
export class UnknownOperator extends Error {}

function iterator<T>(x: Iterable<T>): Iterator<T> {
    return x[Symbol.iterator]();
}

function* newlineTerminate(input: Iterable<string>): Iterable<string> {
    yield* input;
    yield "\n";
}

function* logItems<T>(items: Iterable<T>): Iterable<T> {
    for (let item of items) {
        console.log(item);
        yield item;
    }
}

class Scanner {
    private input: Iterable<string>;
    private iter: Iterator<string>;
    private done: boolean = false;
    private buffer: string[] = [];

    constructor(input: Iterable<string>) {
        this.input = input;
        this.iter = iterator(newlineTerminate(this.input));
    }

    private scan(): boolean {
        if (this.done) { return false; }
        const item = this.iter.next();
        this.buffer.push(item.value);
        this.done = item.done;
        return true;
    }

    private getchar(): string | null {
        if (this.buffer.length > 0) { return this.buffer.shift(); }
        if (!this.scan()) { return null; }
        return this.buffer.shift();
    }

    empty(): boolean {
        return this.done;
    }

    next(n: number = 1, exact: boolean = false): string {
        const buffer = [];
        for (let i = 0; i < n; ++i) {
            const char = this.getchar();
            if (char !== null) { buffer.push(char); }
            else if (exact) { throw new InputExhausted(); }
            else { break; }
        }
        return buffer.join("");
    }

    peek(n: number = 1): string {
        const ahead = n - this.buffer.length;
        for (let i = 0; i < ahead; ++i) { this.scan(); }
        const available = Math.min(this.buffer.length, n);
        return this.buffer.slice(0, available).join("");
    }

    until(seq: string | string[], inclusive: boolean = false): string {
        if (typeof seq === "string") { seq = [seq]; }
        const peekDist = seq.reduce((prev, current) => Math.max(prev, current.length), 0);
        const buffer = [];
        while (!this.empty()) {
            const upcoming = this.peek(peekDist);
            const match = seq.find(item => upcoming.startsWith(item));
            if (match) {
                if (inclusive) { buffer.push(this.next(match.length)); }
                return buffer.join("");
            }
            buffer.push(this.next());
        }
        throw new InputExhausted();
    }
}

export type TokenType = "symbol" | "operator";

export class Token {
    type: TokenType;
    value: any;

    constructor({type, value}: {type: TokenType, value: any}) {
        this.type = type;
        this.value = value;
    }
}

export type OpTable = {[operatorName: string]: (...args: Token[]) => Token};

export class Tokenizer {
    tokenBuilder: (value: string) => Token;

    constructor(tokenBuilder: (value: string) => Token) {
        this.tokenBuilder = tokenBuilder;
    }

    *tokenize(input: string | Iterable<string>): Iterable<Token> {
        if (typeof input === "string") {
            input = input.split("");
        }

        const scanner = new Scanner(input);
        while (!scanner.empty()) {
            // eat extra whitespace
            if (/\s/.test(scanner.peek())) { scanner.next(); }

            // eat comments
            if (scanner.peek(2) === "/*") {
                scanner.next(2);
                while (scanner.peek(2) !== "*/") { scanner.next(1, true); }
                scanner.next(2);
            }

            if (/\S/.test(scanner.peek())) {
                const value = scanner.until([" ", "\t", "\n", "\r\n"]);
                yield this.tokenBuilder(value);
            }
        }
    }
}

export class Interpreter {
    opTable: OpTable;

    constructor(opTable: OpTable) {
        this.opTable = opTable;
    }

    getOp(name: string) {
        if (name in this.opTable) { return this.opTable[name]; }
        throw new UnknownOperator();
    }

    evaluate(input: Iterable<Token>): Token {
        const stack: Token[] = [];
        for (let tok of input) { 
            if (tok.type === "symbol") { stack.push(tok); }
            if (tok.type === "operator") {
                const op = this.getOp(tok.value);
                const args = [];
                for (let i = 0; i < op.length; ++i) { args.push(stack.pop()); }
                stack.push(op(...args));
            }
        }
        return stack.pop();
    }
}

export function run(input: string | Iterable<string>): Token {
    const opTable = {
        "+": (a, b) => new Token({type: "symbol", value: a.value + b.value}),
        "-": (a, b) => new Token({type: "symbol", value: a.value - b.value}),
        "*": (a, b) => new Token({type: "symbol", value: a.value * b.value}),
        "/": (a, b) => new Token({type: "symbol", value: a.value / b.value})
    };

    const tokenBuilder = (value): Token => {
        if (value in opTable) {
            return {type: "operator", value: value};
        } else {
            return {type: "symbol", value: Number.parseFloat(value)};
        }
    };

    const tokenizer = new Tokenizer(tokenBuilder);
    const interpreter = new Interpreter(opTable);
    return interpreter.evaluate(logItems(tokenizer.tokenize(input))).value;
}

declare const process: any;
console.log(run(process.argv.slice(2).join(" ")));
