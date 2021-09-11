import Interpreter, { OpTable } from './Interpreter';
import Operator from './Operator';
import StackWrapper from './StackWrapper';
import Token from './Token';
import Tokenizer, { RuleSet } from './Tokenizer';
import { isIterable } from './util';

export class InputExhausted extends Error {}
export class UnknownOperator extends Error {}

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
        }),
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
