import type Interpreter from "./Interpreter";
import StackWrapper from "./StackWrapper";
import Token from './Token';
import { isIterable } from "./util";

export type OperatorResult = Iterable<Token> | Token | void;
export type OperatorFunction = (args: {stack: StackWrapper, interpreter: Interpreter}) => OperatorResult;
export default class Operator {
    func: OperatorFunction;
    arity: number | "none";

    constructor(func: OperatorFunction, arity: number | "none" = "none") {
        this.func = func;
        this.arity = arity;
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
