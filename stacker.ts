export class InputExhausted extends Error {}
export class UnknownOperator extends Error {}

function* logItems<T>(items: Iterable<T>): Iterable<T> {
    for (let item of items) {
        console.log(item);
        yield item;
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

    *tokenize(input: string): Iterable<Token> {
        const rules: [RegExp, Function][] = [
            [/\s+/, _ => {}],
            [/~[^~]*?~/, _ => {}],
            [/\S+/, match => this.tokenBuilder(match)],
        ];

        while (input.length > 0) {
            let longestLength = 0;
            let bestMatch = null;
            let bestRule = null;
            for (let [pattern, rule] of rules) {
                const result = pattern.exec(input);
                if (!result || result.index !== 0) { continue; }

                const length = result[0].length;
                if (length > longestLength) {
                    longestLength = length;
                    bestMatch = result[0];
                    bestRule = rule;
                }
            }
            if (longestLength === 0) { 
                throw new Error(`Unrecognized grammar starting here: ${input.slice(0, 32)}`); 
            }
            
            const token = bestRule(bestMatch);
            if (token) { yield token; }
            input = input.slice(longestLength);
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
                for (let i = 0; i < op.length; ++i) { 
                    if (stack.length === 0) { throw new Error(`Expected ${op.length} operands for operator "${tok.value}"`); }
                    args.push(stack.pop()); 
                }
                stack.push(op(...args));
            }
        }
        if (stack.length > 1) { throw new Error(`Incomplete program; extra items on stack.`); }
        return stack.pop();
    }
}

export function run(input: string): Token {
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

const fs = require("fs");
console.log(run(fs.readFileSync(0, "utf8")));
