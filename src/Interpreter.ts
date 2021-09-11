import Operator from './Operator';
import Token from './Token';
import Tokenizer from './Tokenizer';
import { absurd } from './util';

export type OpTable = {[operatorName: string]: Operator};

export default class Interpreter {
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