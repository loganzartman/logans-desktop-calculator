import Token from "./Token";
import StackWrapper from "./StackWrapper";
import { OpTable } from "./Interpreter";
import Operator from "./Operator";
import { collectItems } from "./util";

const terminator = '\\';

const getAllProperties = (obj: any): Array<any> => {
    const props = new Set();
    for (const prop in obj) {
        props.add(prop);
    }
    Object.getOwnPropertyNames(obj).forEach((prop) => props.add(prop));
    return [...props];
};

export const doJsBind = ({opTable, object, namePrefix}: {opTable: OpTable, object: unknown, namePrefix: String}) => {
    const bindProp = (obj, prop, {isPrototype=false}={}) => {
        const opName = `${namePrefix}${prop}`;
        opTable[opName] = new Operator(({stack}) => {
            const value = obj[prop];
            if (typeof value === 'function') {
                console.log(`call ${isPrototype ? 'prototype ' : ''}func ${opName}`);
                const this_ = isPrototype ? stack.pop().value : obj;
                const args = collectItems(stack, terminator).map(x => x.value);
                stack.push(new Token({
                    type: "symbol",
                    value: value.apply(this_, args),
                }));
            } else {
                console.log(`get ${isPrototype ? 'prototype ' : ''}const ${opName}`);
                stack.push(new Token({
                    type: "symbol",
                    value,
                }));
            }
        });
        opTable[`${opName}-set`] = new Operator(({stack}) => {
            console.log(`set ${isPrototype ? 'prototype ' : ''}const ${opName}`);
            obj[prop] = stack.pop().value;
        });
    };
    if (typeof object === "object") {
        getAllProperties(object).forEach((k) => 
            bindProp(object, k)
        );
    } else if (typeof object === 'function' && object.prototype) {
        opTable[`${namePrefix}new`] = new Operator(({stack}) => {
            console.log(`constructing object ${namePrefix}`);
            const args = collectItems(stack, terminator).map(x => x.value);
            stack.push(new Token({
                type: "symbol",
                value: new (object as any)(...args),
            }));
        });
        getAllProperties(object.prototype).forEach((k) => 
            bindProp(object.prototype, k, {isPrototype: true})
        );
    } else {
        throw new Error(`Expression ${object} did not evaluate to an object or constructor.`);
    }
};
