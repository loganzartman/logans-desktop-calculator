import Token from './Token';

export default class StackWrapper {
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
