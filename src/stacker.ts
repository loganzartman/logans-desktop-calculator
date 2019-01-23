export class InputExhausted extends Error {}
export class UnknownOperator extends Error {}

function isIterable(x): x is Iterable<any> {
    return x && Symbol.iterator in x;
}

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

    clone(): Token {
        const {type, value} = this;
        return new Token({type, value});
    }
}

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
                    bestMatch = result;
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

type OperatorResult = Iterable<Token> | Token | void;
type OperatorFunction = (...args: Token[]) => OperatorResult;
export class Operator {
    func: OperatorFunction;
    arity: number;
    rest: boolean;
    protected interpreter: Interpreter;

    constructor(func: OperatorFunction, rest = false, arity = func.length) {
        this.func = func;
        this.arity = arity;
        this.rest = rest;
        this.interpreter = null;
    }

    protected collectArgs(interpreter: Interpreter, name: string) {
        // collect positional arguments
        const args = [];
        for (let i = 0; i < this.arity; ++i) { 
            if (interpreter.stack.length === 0) { throw new Error(`Expected ${this.arity} operands for operator "${name}"`); }
            args.push(interpreter.stack.pop()); 
        }

        // collect rest arguments
        if (this.rest) {
            while (interpreter.stack.length > 0) {
                args.push(interpreter.stack.pop());
            }
        }
        return args;
    }

    protected pushResult(interpreter: Interpreter, result: OperatorResult) {
        if (isIterable(result)) {
            interpreter.stack.push(...result);
        } else if (result) {
            interpreter.stack.push(result);
        }
    }

    invoke(interpreter: Interpreter, name: string) {
        const args = this.collectArgs(interpreter, name);
        this.interpreter = interpreter;
        const result = this.func.apply(this, args);
        this.interpreter = null;
        this.pushResult(interpreter, result);
        return result;
    }
}

export type OpTable = {[operatorName: string]: Operator};

export class Interpreter {
    stack: Token[] = [];
    opTable: OpTable;

    constructor(opTable: OpTable) {
        this.opTable = opTable;
    }

    getOp(name: string) {
        if (name in this.opTable) { return this.opTable[name]; }
        throw new Error(`"${name}" is not an operator`);
    }

    evaluate(input: Iterable<Token>): Token {
        for (let tok of input) { 
            if (tok.type === "symbol") { this.stack.push(tok); }
            if (tok.type === "operator") {
                const op = this.getOp(tok.value);
                op.invoke(this, tok.value);
            }
        }
        if (this.stack.length === 0) { return undefined; }
        return this.stack[this.stack.length - 1];
    }
}

export function run(input: string) {
    const memory: {[key: string]: Token} = {};
    const opTable: OpTable = {
        "+": new Operator((a, b) => new Token({type: "symbol", value: a.value + b.value})),
        "-": new Operator((a, b) => new Token({type: "symbol", value: a.value - b.value})),
        "*": new Operator((a, b) => new Token({type: "symbol", value: a.value * b.value})),
        "/": new Operator((a, b) => new Token({type: "symbol", value: a.value / b.value})),
        "^": new Operator((a, b) => new Token({type: "symbol", value: a.value ** b.value})),
        "print": new Operator((a) => { console.log(a.value); }),
        "dup": new Operator((a) => [a, a.clone()]),
        "swap": new Operator((a, b) => [a, b]),
        "pop": new Operator((_) => {}),
        "clear": new Operator((...args) => {}, true),
        "reduce": new Operator(function(op, first, ...args) {
            const operator = this.interpreter.getOp(op.value) as Operator;
            if (operator.arity !== 2) { 
                throw new Error(`A reduce operation must accept 2 operands; "${op.value}" requires ${operator.arity}`); 
            }
            this.interpreter.stack.push(first);
            for (let a of args) {
                this.interpreter.stack.push(a);
                const result = operator.invoke(this.interpreter, op.value);
                if (isIterable(result)) {
                    throw new Error(`Reduce operation "${op.value}" produced more than one return value`);
                }
            }
            return this.interpreter.stack.pop();
        }, true),
        "alias-op": new Operator((a, b) => {
            opTable[a.value] = opTable[b.value];
        }),
        "store": new Operator((name, val) => {memory[name.value] = val}),
        "load": new Operator((name) => memory[name.value]),
        "delete": new Operator((name) => {delete memory[name.value]})
    };

    const ruleSet: RuleSet = [
        // eat whitespace
        [/\s+/, _ => {}],

        // eat single-line comments
        [/\/\/.*?$/m, _ => {}],

        // eat multiline comments
        [/\*+[^*]*\*+(?:[^/*][^*]*\*+)*/, _ => {}],

        // strings with support for arbitrary escapes
        [/"((?:[^"\\]|\\.)*?)"/, result => new Token({type: "symbol", value: result[1]})],
        
        // identifiers
        [/\S+/, result => {
            const match = result[0];
            if (match in opTable) {
                return new Token({type: "operator", value: match});
            } else {
                return new Token({type: "symbol", value: Number.parseFloat(match)});
            }
        }]
    ];

    const tokenizer = new Tokenizer(ruleSet);
    const interpreter = new Interpreter(opTable);
    const result = interpreter.evaluate(logItems(tokenizer.tokenize(input)));
    if (result) { return {value: result.value, interpreter, memory}; }
    else { return {value: undefined, interpreter, memory}; }
}
