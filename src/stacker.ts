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

class StackWrapper {
    stack: Array<Token>;
    caller?: string;
    private last: Token;

    constructor(stack: Array<Token>, params: {caller?: string}) {
        this.stack = stack;
        this.caller = params.caller;
    }

    pop({ignoreEmpty}: {ignoreEmpty?: boolean} = {}): Token {
        if (!this.stack.length) {
            if (ignoreEmpty) {
                return;
            }
            throw new Error(`"${this.caller}" expected another item on the stack, but it was empty.\nLast item was: ${this.last.serialize()}`);
        }
        this.last = this.stack.pop();
        return this.last;
    }

    push(...args: Array<Token>) {
        this.stack.push(...args);
    }

    popArgs(...argNames: Array<string>): {[k: string]: Token} {
        if (this.stack.length < argNames.length) {
            const argsList = argNames.map(name => `"${name}"`).join(", ");
            throw new Error(`"${this.caller}" expected at least ${argNames.length} items on the stack, but only ${this.stack.length} items were present.\nIt expects arguments ${argsList}.`);
        }
        const argObj = {};
        for (const name of [...argNames.reverse()]) {
            argObj[name] = this.pop();
        }
        return argObj;
    }

    popAll(): Array<Token> {
        const result = [];
        while (this.stack.length) {
            result.unshift(this.stack.pop());
        }
        return result;
    }
}

type OperatorResult = Iterable<Token> | Token | void;
type OperatorFunction = (args: {stack: StackWrapper, interpreter: Interpreter}) => OperatorResult;
export class Operator {
    func: OperatorFunction;
    arity: number | "none";
    protected interpreter: Interpreter;

    constructor(func: OperatorFunction, arity: number | "none" = "none") {
        this.func = func;
        this.arity = arity;
        this.interpreter = null;
    }

    protected pushResult(interpreter: Interpreter, result: OperatorResult) {
        if (isIterable(result)) {
            interpreter.stack.push(...result);
        } else if (result) {
            interpreter.stack.push(result);
        }
    }

    invoke(interpreter: Interpreter, name: string) {
        const stack = new StackWrapper(interpreter.stack, {caller: name});
        const result = this.func({stack, interpreter});
        this.pushResult(interpreter, result);
        return result;
    }
}

export type OpTable = {[operatorName: string]: Operator};

export class Interpreter {
    stack: Array<Token> = [];
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
        for (const tok of input) { 
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

export const RE = {
    commentLine: /\/\/.*?$/m,
    commentMulti: /\/\*+[^*]*\*+(?:[^/*][^*]*\*+)*\//,
    stringQuotes: /"((?:[^"\\]|\\.)*?)"/,
    stringSymbol: /'([^\s')]+)/,
    boolean: /true|false/,
    number: /[+-]?\d*\.?[0-9]+([eE][+-]?\d+)?/,
    identifier: /\S+/,
};

export function run(input: string) {
    const memory: {[key: string]: Token} = {};
    const valueOp = (argNames: Array<string>, lambda: (args) => any): Operator => {
        const opFn = ({stack}) => new Token({
            type: "symbol", 
            value: lambda(stack.popArgs(...argNames)),
        });
        return new Operator(opFn, argNames.length);
    }
    const opTable: OpTable = {
        "noop": new Operator(() => {}),
        "+": valueOp(["a", "b"], ({a, b}) => a.value + b.value),
        "-": valueOp(["a", "b"], ({a, b}) => a.value - b.value),
        "*": valueOp(["a", "b"], ({a, b}) => a.value * b.value),
        "/": valueOp(["a", "b"], ({a, b}) => a.value / b.value),
        "^": valueOp(["a", "b"], ({a, b}) => a.value ** b.value),
        "%": valueOp(["a", "b"], ({a, b}) => a.value % b.value),
        "xor": valueOp(["a", "b"], ({a, b}) => a.value ^ b.value),
        "==": valueOp(["a", "b"], ({a, b}) => a.value == b.value),
        "<": valueOp(["a", "b"], ({a, b}) => a.value < b.value),
        ">": valueOp(["a", "b"], ({a, b}) => a.value > b.value),
        ">=": valueOp(["a", "b"], ({a, b}) => a.value >= b.value),
        "<=": valueOp(["a", "b"], ({a, b}) => a.value <= b.value),
        "not": valueOp(["a"], ({a}) => !a.value),
        "and": valueOp(["a", "b"], ({a, b}) => a.value && b.value),
        "or": valueOp(["a", "b"], ({a, b}) => a.value || b.value),
        "if": new Operator(({stack, interpreter}) => {
            const {otherwise, then, condition} = stack.popArgs("condition", "then", "otherwise");
            interpreter.evaluate(condition.value);
            const result = stack.pop();
            if (result && result.value) {
                interpreter.evaluate(then.value);
            } else {
                interpreter.evaluate(otherwise.value);
            }
        }),
        "print": new Operator(({stack}) => { console.log(stack.pop().value); }),
        "dup": new Operator(({stack}) => {const x = stack.pop(); return [x, x.clone()];}),
        "swap": new Operator(({stack}) => {const {a, b} = stack.popArgs("a", "b"); return [b, a];}),
        "over": new Operator(({stack}) => {const {a, b} = stack.popArgs("a", "b"); return [a, b, a.clone()];}),
        "pick": new Operator(({stack}) => {const {a, b, c} = stack.popArgs("a", "b", "c"); return [a, b, c, a.clone()];}),
        "pop": new Operator(({stack}) => {stack.pop({ignoreEmpty: true});}),
        "clear": new Operator(({stack}) => {stack.popAll()}),
        "reduce": new Operator(({stack, interpreter}) => {
            const {op, first} = stack.popArgs("first", "op");
            const rest = stack.popAll();
            const operator = interpreter.getOp(op.value) as Operator;
            if (operator.arity !== 2 && operator.arity !== "none") { 
                throw new Error(`A reduce operator must accept 2 operands; "${op.value}" requires ${operator.arity}`); 
            }
            stack.push(first);
            for (const a of rest) {
                stack.push(a);
                const result = operator.invoke(interpreter, op.value);
                if (isIterable(result)) {
                    throw new Error(`Reduce operator "${op.value}" produced more than one return value`);
                }
            }
            return stack.pop();
        }),
        "map": new Operator(({stack, interpreter}) => {
            const {op} = stack.popArgs("op");
            const rest = stack.popAll();
            const operator = interpreter.getOp(op.value);
            if (operator.arity !== 1 && operator.arity !== "none") { 
                throw new Error(`A map operator must accept 1 operand; "${op.value}" requires ${operator.arity}`); 
            }
            for (const a of rest) {
                stack.push(a);
                operator.invoke(interpreter, op.value);
            }
            return stack.pop({ignoreEmpty: true});
        }),
        "filter": new Operator(({stack, interpreter}) => {
            const {op} = stack.popArgs("op");
            const rest = stack.popAll();
            const operator = interpreter.getOp(op.value);
            if (operator.arity !== 1 && operator.arity !== "none") { 
                throw new Error(`A filter operator must accept 1 operand; "${op.value}" requires ${operator.arity}`); 
            }
            for (const a of rest) {
                stack.push(a);
                operator.invoke(interpreter, op.value);
                const result = stack.pop();
                if (isIterable(result)) {
                    throw new Error(`Filter operator "${op.value}" produced more than one return value`);
                }
                if (result.value) {
                    stack.push(a);
                }
            }
            return stack.pop();
        }),
        "range": new Operator(({stack}) => {
            const {step, end, start} = stack.popArgs("start", "end", "step");
            if (typeof start.value !== "number" || typeof end.value !== "number" || typeof step.value !== "number") {
                throw new Error("range operator expects numerical arguments");
            }
            const dir = Math.sign(end.value - start.value);
            const steps = Math.abs(end.value - start.value) / step.value;
            let val = start.value;
            for (let i = 0; i < steps; ++i) {
                stack.push(new Token({type: "symbol", value: val}));
                val += dir * step.value;
            }
        }),
        "alias-op": new Operator(({stack}) => {const {a, b} = stack.popArgs("a", "b"); opTable[b.value] = opTable[a.value];}),
        "define-op": new Operator(({stack, interpreter}) => {
            const {code, arity, name} = stack.popArgs("name", "arity", "code");
            if (typeof arity.value !== "number" && arity.value !== "none") {
                throw new Error(`Invalid arity value ${arity.value}`);
            }
            opTable[name.value] = new Operator(() => {
                interpreter.evaluate(code.value);
            }, arity.value);
        }),
        "del-op": new Operator(({stack}) => {delete opTable[stack.pop().value];}),
        "store": new Operator(({stack}) => {const {val, name} = stack.popArgs("val", "name"); memory[name.value] = val;}),
        "load": new Operator(({stack}) => memory[stack.pop().value]),
        "delete": new Operator(({stack}) => {delete memory[stack.pop().value]}),
        "pack": new Operator(({stack}) => {
            const all = stack.popAll();
            return new Token({
                type: 'symbol', 
                value: all.map(x => x.serialize()).join(" ")
            });
        }),
        "eval": new Operator(({stack, interpreter}) => {interpreter.evaluate(stack.pop().value);}),
        "js": new Operator(({stack}) => {
            const str = stack.pop();
            const evaluate = (code) => (function(code){return eval(code)}).call({
                stack,
                push: (...values) => {values.forEach(value => stack.push(new Token({type: 'symbol', value})))},
                pop: () => stack.pop().value,
            },code);
            const result = evaluate(str.value);
            if (typeof result !== "undefined") {
                stack.push(new Token({type: 'symbol', value: result}));
            }
        })
    };

    const ruleSet: RuleSet = [
        // eat whitespace
        [/\s+/, _ => {}],

        // eat single-line comments
        [RE.commentLine, _ => {}],

        // eat multiline comments
        [RE.commentMulti, _ => {}],

        // strings with support for escapes
        [RE.stringQuotes, result => {
            const str = result[1].replace(/\\(.)/g, "$1");
            return new Token({type: "symbol", value: str});
        }],

        // symbol literal
        [RE.stringSymbol, result => new Token({type: "symbol", value: result[1]})],

        // booleans
        [RE.boolean, result => new Token({type: "symbol", value: result[0] === "true"})],

        // numbers 
        [RE.number, result => new Token({type: "symbol", value: Number.parseFloat(result[0])})],

        // identifiers
        [RE.identifier, result => {
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
