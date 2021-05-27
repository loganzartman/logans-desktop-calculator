export class InputExhausted extends Error {}
export class UnknownOperator extends Error {}

function isIterable(x): x is Iterable<any> {
    return x && Symbol.iterator in x;
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

    private tokenizeParen(input: string): [Token, string] {
        let depth = 0;
        let index = 0;
        do {
            if (index >= input.length) {
                throw new Error("Unmatched parentheses");
            }
            if (input[index] === "(") {
                ++depth;
            } else if (input[index] === ")") {
                --depth;
            }
            ++index;
        } while (depth > 0);
        const val = input.slice(1, index - 1);
        return [new Token({type: "symbol", value: val}), input.slice(index)];
    }

    *tokenize(input: string): Iterable<Token> {
        while (input.length > 0) {
            if (input[0] === "(") {
                const [tok, newInput] = this.tokenizeParen(input);
                input = newInput;
                yield tok;
                continue;
            }

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
    tokenizer: Tokenizer;

    constructor(opTable: OpTable, tokenizer: Tokenizer) {
        this.opTable = opTable;
        this.tokenizer = tokenizer;
    }

    getOp(name: string) {
        if (name in this.opTable) { return this.opTable[name]; }
        throw new Error(`"${name}" is not an operator`);
    }

    evaluate(str: string): Token {
        const input = this.tokenizer.tokenize(str);
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
    const valueOp = (lambda: (...args: any[]) => any): Operator => 
        new Operator((...args) => new Token({type: "symbol", value: lambda(...args.reverse())}), false, lambda.length);
    const opTable: OpTable = {
        "+": valueOp((a, b) => a.value + b.value),
        "-": valueOp((a, b) => a.value - b.value),
        "*": valueOp((a, b) => a.value * b.value),
        "/": valueOp((a, b) => a.value / b.value),
        "^": valueOp((a, b) => a.value ** b.value),
        "%": valueOp((a, b) => a.value % b.value),
        "xor": valueOp((a, b) => a.value ^ b.value),
        "==": valueOp((a, b) => a.value === b.value),
        "<": valueOp((a, b) => a.value < b.value),
        ">": valueOp((a, b) => a.value > b.value),
        "<=": valueOp((a, b) => a.value <= b.value),
        ">=": valueOp((a, b) => a.value >= b.value),
        "not": valueOp((a) => !a.value),
        "and": valueOp((a, b) => a.value && b.value),
        "or": valueOp((a, b) => a.value || b.value),
        "if": new Operator(function(otherwise, then, condition) {
            const result = this.interpreter.evaluate(condition.value);
            this.interpreter.stack.pop();
            if (result && result.value) {
                this.interpreter.evaluate(then.value);
            } else {
                this.interpreter.evaluate(otherwise.value);
            }
        }),
        "print": new Operator((a) => { console.log(a.value); }),
        "dup": new Operator((a) => [a, a.clone()]),
        "swap": new Operator((a, b) => [a, b]),
        "pop": new Operator((_) => {}),
        "clear": new Operator((...args) => {}, true),
        "reduce": new Operator(function(op, first, ...args) {
            const operator = this.interpreter.getOp(op.value) as Operator;
            if (operator.arity !== 2) { 
                throw new Error(`A reduce operator must accept 2 operands; "${op.value}" requires ${operator.arity}`); 
            }
            this.interpreter.stack.push(first);
            for (let a of args) {
                this.interpreter.stack.push(a);
                const result = operator.invoke(this.interpreter, op.value);
                if (isIterable(result)) {
                    throw new Error(`Reduce operator "${op.value}" produced more than one return value`);
                }
            }
            return this.interpreter.stack.pop();
        }, true),
        "map": new Operator(function(op, ...args) {
            const operator = this.interpreter.getOp(op.value) as Operator;
            if (operator.arity !== 1) { 
                throw new Error(`A map operator must accept 1 operand; "${op.value}" requires ${operator.arity}`); 
            }
            while (args.length > 0) {
                const a = args.pop();
                this.interpreter.stack.push(a);
                const result = operator.invoke(this.interpreter, op.value);
                if (isIterable(result)) {
                    throw new Error(`Map operator "${op.value}" produced more than one return value`);
                }
            }
            return this.interpreter.stack.pop();
        }, true),
        "filter": new Operator(function(op, ...args) {
            const operator = this.interpreter.getOp(op.value) as Operator;
            if (operator.arity !== 1) { 
                throw new Error(`A filter operator must accept 1 operand; "${op.value}" requires ${operator.arity}`); 
            }
            while (args.length > 0) {
                const a = args.pop();
                this.interpreter.stack.push(a);
                operator.invoke(this.interpreter, op.value);
                const result = this.interpreter.stack.pop();
                if (isIterable(result)) {
                    throw new Error(`Filter operator "${op.value}" produced more than one return value`);
                }
                if (result.value) {
                    this.interpreter.stack.push(a);
                }
            }
            return this.interpreter.stack.pop();
        }, true),
        "range": new Operator(function*(step, end, start) {
            if (typeof start.value !== "number" || typeof end.value !== "number" || typeof step.value !== "number") {
                throw new Error("range operator expects numerical arguments");
            }
            const dir = Math.sign(end.value - start.value);
            const steps = Math.abs(end.value - start.value) / step.value;
            let val = start.value;
            for (let i = 0; i < steps; ++i) {
                yield new Token({type: "symbol", value: val});
                val += dir * step.value;
            }
        }),
        "alias-op": new Operator((a, b) => {
            opTable[a.value] = opTable[b.value];
        }),
        "define-op": new Operator((code, arity, name) => {
            opTable[name.value] = new Operator(function(...args) {
                this.interpreter.stack.push(...args);
                this.interpreter.evaluate(code.value);
            }, false, arity.value);
        }),
        "del-op": new Operator((name) => {delete opTable[name.value]}),
        "store": new Operator((name, val) => {memory[name.value] = val}),
        "load": new Operator((name) => memory[name.value]),
        "delete": new Operator((name) => {delete memory[name.value]}),
        "pack": new Operator(function() {
            const packed = new Token({
                type: 'symbol', 
                value: this.interpreter.stack.map(x => `${x.value}`).join(" ")
            });

            while (this.interpreter.stack.length) {
                this.interpreter.stack.pop();
            }
            return packed;
        }),
        "eval": new Operator(function(str) {this.interpreter.evaluate(str.value);}),
        "js": new Operator(function(str) {
            const result = window.eval(str.value);
            if (typeof result !== "undefined") {
                this.interpreter.stack.push(new Token({type: 'symbol', value: result}));
            }
        })
    };

    const ruleSet: RuleSet = [
        // eat whitespace
        [/\s+/, _ => {}],

        // eat single-line comments
        [/\/\/.*?$/m, _ => {}],

        // eat multiline comments
        [/\*+[^*]*\*+(?:[^/*][^*]*\*+)*/, _ => {}],

        // strings with support for escapes
        [/"((?:[^"\\]|\\.)*?)"/, result => {
            const str = result[1].replace(/\\(.)/g, "$1");
            return new Token({type: "symbol", value: str});
        }],

        // symbol literal
        [/'([^\s']+)/, result => new Token({type: "symbol", value: result[1]})],

        // booleans
        [/true|false/, result => new Token({type: "symbol", value: result[0] === "true"})],

        // numbers 
        [/[+-]?\d*\.?[0-9]+([eE][+-]?\d+)?/, result => new Token({type: "symbol", value: Number.parseFloat(result[0])})],

        // identifiers
        [/\S+/, result => {
            const match = result[0];
            if (match in opTable) {
                return new Token({type: "operator", value: match});
            } else {
                return new Token({type: "symbol", value: match});
            }
        }]
    ];

    const tokenizer = new Tokenizer(ruleSet);
    const interpreter = new Interpreter(opTable, tokenizer);
    const result = interpreter.evaluate(input);
    if (result) { return {value: result.value, interpreter, memory}; }
    else { return {value: undefined, interpreter, memory}; }
}
