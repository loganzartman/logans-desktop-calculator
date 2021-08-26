export class InputExhausted extends Error {}
export class UnknownOperator extends Error {}
const absurd = (value: never, msg?: string) => {
    throw new Error(msg ?? "Invalid value");
}

export const RE = {
    commentLine: /\/\/.*?$/m,
    commentMulti: /\/\*+[^*]*\*+(?:[^/*][^*]*\*+)*\//,
    stringQuotes: /"((?:[^"\\]|\\.)*?)"/,
    stringSymbol: /'([^\s')]+)/,
    boolean: /true|false/,
    number: /[+-]?\d*\.?[0-9]+([eE][+-]?\d+)?/,
    identifier: /[^\s()]+/,
    localName: /@[^@\s()]+/,
};

function isIterable(x): x is Iterable<any> {
    return x && Symbol.iterator in x;
}

export type TokenType = "symbol" | "operator" | "local";

type TokenArgs = {type: TokenType, value: any, location?: number, length?: number, tags?: Set<string>};
export class Token {
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

type RuleMatchConsumer = (args: {match: string, location: number, length: number}) => Token | void;
export type RuleSet = [RegExp, RuleMatchConsumer][];

export class Tokenizer {
    ruleSet: RuleSet;

    constructor(ruleSet: RuleSet) {
        this.ruleSet = ruleSet;
    }

    private tokenizeParen(input: string, location: number): [Token, number] {
        const startLocation = location;
        let depth = 0;
        do {
            if (location >= input.length) {
                throw new Error("Unmatched parentheses");
            }
            if (input[location] === "(") {
                ++depth;
            } else if (input[location] === ")") {
                --depth;
            }
            ++location;
        } while (depth > 0);
        const val = input.slice(startLocation + 1, location - 1);
        const token = new Token({
            type: "symbol", 
            value: val, 
            location: startLocation + 1, 
            length: val.length, 
            tags: new Set(["string", "code"]),
        });
        return [token, location];
    }

    *tokenize(input: string): Iterable<Token> {
        let location = 0;
        while (location < input.length) {
            if (input[location] === "(") {
                const [tok, newLocation] = this.tokenizeParen(input, location);
                location = newLocation;
                yield tok;
                continue;
            }

            const rest = input.substring(location);
            let longestLength = 0;
            let bestMatch = null;
            let bestRule: RuleMatchConsumer | null = null;
            for (let [pattern, rule] of this.ruleSet) {
                const result = pattern.exec(rest);
                if (!result || result.index !== 0) { continue; }

                const length = result[0].length;
                if (length > longestLength) {
                    longestLength = length;
                    bestMatch = result;
                    bestRule = rule;
                }
            }
            if (longestLength === 0) { 
                throw new Error(`Unrecognized grammar starting here: ${rest.slice(0, 32)}`); 
            }
            
            const token = bestRule({match: bestMatch, location, length: longestLength});
            if (token) { yield token; }
            location += longestLength;
        }
    }

    edit(input: string, tokenReplacer: (token: Token) => string | null, opts?: {deep: boolean}): string {
        let result = input;
        let locationOffset = 0;
        for (const tok of this.tokenize(input)) {
            if (tok.location === null || tok.length === null) { continue; }

            const replaceStart = locationOffset + tok.location;
            const replaceEnd = replaceStart + tok.length;

            let replaceWith = null;
            if (opts?.deep && tok.tags?.has("code")) {
                const sub = result.substring(replaceStart, replaceEnd);
                replaceWith = this.edit(sub, tokenReplacer, opts);
            } else {
                replaceWith = tokenReplacer(tok);
            }

            if (replaceWith === null) { continue; }

            result = result.substring(0, replaceStart) + replaceWith + result.substring(replaceEnd);
            locationOffset += replaceWith.length - tok.length;
        }
        return result;
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

    get length() {
        return this.stack.length;
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
    localsUid: number;

    constructor(opTable: OpTable, tokenizer: Tokenizer) {
        this.opTable = opTable;
        this.tokenizer = tokenizer;
        this.localsUid = 0;
    }

    getOp(name: string) {
        if (name in this.opTable) { return this.opTable[name]; }
        throw new Error(`"${name}" is not an operator`);
    }

    evaluate(input: string): Token {
        // substitute locals
        const uid = this.localsUid++;
        const locals = new Set();
        for (const tok of this.tokenizer.tokenize(input)) {
            if (tok.type === "local") {
                locals.add(tok.value);
            }
        }
        input = this.tokenizer.edit(input, (tok) => {
            if (tok.type === "local" && locals.has(tok.value)) {
                const fullName = `${tok.value}@${uid}`;
                locals[tok.value] = fullName;
                return fullName;
            }
            return null;
        }, {deep: true});

        // eval
        for (const tok of this.tokenizer.tokenize(input)) { 
            if (tok.type === "symbol") { this.stack.push(tok); }
            else if (tok.type === "operator") {
                const op = this.getOp(tok.value);
                op.invoke(this, tok.value);
            }
            else if (tok.type === "local") {
                throw new Error(`Internal error: unreplaced local ${tok.value}`);
            }
            else {
                absurd(tok.type); 
            }
        }
        if (this.stack.length === 0) { return undefined; }
        return this.stack[this.stack.length - 1];
    }
}

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
            const {op} = stack.popArgs("op");
            const all = stack.popAll();
            let result;
            if (all.length > 0) {
                result = all.shift();
            }
            while (all.length > 0) {
                const next = all.shift();
                stack.push(result);
                stack.push(next);
                interpreter.evaluate(op.value);
                if (stack.length > 1) {
                    throw new Error(`Reduce operation ${op.serialize()} left more than one value on the stack.`);
                }
                result = stack.pop();
            }
            return result;
        }),
        "map": new Operator(({stack, interpreter}) => {
            const {op} = stack.popArgs("op");
            const all = stack.popAll();
            while (all.length > 0) {
                stack.push(all.shift());
                interpreter.evaluate(op.value);
            }
        }),
        "filter": new Operator(({stack, interpreter}) => {
            const {op} = stack.popArgs("op");
            const all = stack.popAll();
            while (all.length > 0) {
                const value = all.shift();
                stack.push(value.clone());
                const result = interpreter.evaluate(op.value);
                if (stack.length === 0) {
                    throw new Error(`Filter operation ${op.serialize()} didn't leave a value on the stack.`);
                }
                if (isIterable(result)) {
                    throw new Error(`Filter operation ${op.serialize()} added too many values to the stack.`);
                }
                stack.pop();
                if (result.value) {
                    stack.push(value);
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
        "serialize": valueOp(["value"], ({value}) => value.serialize()),
        "pack": new Operator(({stack}) => {
            const all = stack.popAll();
            return new Token({
                type: 'symbol', 
                value: all.map(x => x.serialize()).join(" ")
            });
        }),
        "eval": new Operator(({stack, interpreter}) => {interpreter.evaluate(stack.pop().value);}),
        "js": new Operator(({stack, interpreter}) => {
            const str = stack.pop();
            const evaluate = (code) => (function(code){return eval(code)}).call({
                stack,
                push: (...values) => {values.forEach(value => stack.push(new Token({type: 'symbol', value})))},
                pop: () => stack.pop().value,
                eval: (code) => interpreter.evaluate(code),
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
        [RE.stringQuotes, ({match, location, length}) => {
            const str = match[1].replace(/\\(.)/g, "$1");
            return new Token({
                type: "symbol", 
                value: str, 
                location, 
                length,
                tags: new Set(["string"]),
            });
        }],

        // symbol literal
        [RE.stringSymbol, ({match, location, length}) => new Token({
            type: "symbol", 
            value: match[1], 
            location, 
            length,
            tags: new Set(["string"]),
        })],

        // local literal
        [RE.localName, ({match, location, length}) => new Token({
            type: "local", 
            value: match[0], 
            location, 
            length,
            tags: new Set(["string"]),
        })],

        // booleans
        [RE.boolean, ({match, location, length}) => new Token({
            type: "symbol", 
            value: match[0] === "true", 
            location, 
            length,
            tags: new Set(["boolean"]),
        })],

        // numbers 
        [RE.number, ({match, location, length}) => new Token({
            type: "symbol", 
            value: Number.parseFloat(match[0]), 
            location, 
            length,
            tags: new Set(["number"]),
        })],

        // identifiers
        [RE.identifier, ({match, location, length}) => {
            const value = match[0];
            if (value in opTable) {
                return new Token({
                    type: "operator", 
                    value, 
                    location, 
                    length,
                });
            } else {
                return new Token({
                    type: "symbol", 
                    value, 
                    location, 
                    length,
                    tags: new Set(["string"]),
                });
            }
        }]
    ];

    const tokenizer = new Tokenizer(ruleSet);
    const interpreter = new Interpreter(opTable, tokenizer);
    const result = interpreter.evaluate(input);
    if (result) { return {value: result.value, interpreter, memory}; }
    else { return {value: undefined, interpreter, memory}; }
}
