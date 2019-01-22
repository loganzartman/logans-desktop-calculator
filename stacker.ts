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

export type OpTable = {[operatorName: string]: (...args: Token[]) => Token[] | Token | void};
export type RuleSet = [RegExp, (string) => Token | void][];

export class Tokenizer {
    ruleSet: RuleSet;

    constructor(ruleSet: RuleSet) {
        this.ruleSet = ruleSet;
    }

    *tokenize(input: string): Iterable<Token> {
        while (input.length > 0) {
            let longestLength = 0;
            let bestMatch = null;
            let bestRule = null;
            for (let [pattern, rule] of this.ruleSet) {
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
                const result = op(...args);
                if (result instanceof Array) {
                    stack.push(...result);
                } else if (result) {
                    stack.push(result);
                }
            }
        }
        if (stack.length > 1) { throw new Error(`Incomplete program; extra items on stack.`); }
        return stack.pop();
    }
}

export function run(input: string): Token {
    const opTable: OpTable = {
        "+": (a, b) => new Token({type: "symbol", value: a.value + b.value}),
        "-": (a, b) => new Token({type: "symbol", value: a.value - b.value}),
        "*": (a, b) => new Token({type: "symbol", value: a.value * b.value}),
        "/": (a, b) => new Token({type: "symbol", value: a.value / b.value}),
        "alias-op": (a, b) => {
            opTable[a.value] = opTable[b.value];
        }
    };

    const ruleSet: RuleSet = [
        [/\s+/, _ => {}],
        [/~[^~]*?~/, _ => {}],
        [/'\S+/, match => ({type: "symbol", value: match.slice(1)})],
        [/\S+/, match => {
            if (match in opTable) {
                return {type: "operator", value: match};
            } else {
                return {type: "symbol", value: Number.parseFloat(match)};
            }
        }]
    ];

    const tokenizer = new Tokenizer(ruleSet);
    const interpreter = new Interpreter(opTable);
    return interpreter.evaluate(logItems(tokenizer.tokenize(input))).value;
}

const fs = require("fs");
console.log(run(fs.readFileSync(0, "utf8")));
