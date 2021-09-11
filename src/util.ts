import type StackWrapper from "./StackWrapper";
import type Token from "./Token";

export function isIterable(x): x is Iterable<any> {
    return x && Symbol.iterator in x;
}

export const absurd = (value: never, msg?: string) => {
    throw new Error(msg ?? "Invalid value");
}

export const collectItems = (stack: StackWrapper, terminator: String): Array<Token> => {
    const args = [];
    while (stack.length > 0) {
        const item = stack.pop();
        if (item.value === terminator) {
            break;
        }
        args.push(item);
    }
    return args;
};
