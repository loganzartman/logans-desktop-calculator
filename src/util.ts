export function isIterable(x): x is Iterable<any> {
    return x && Symbol.iterator in x;
}

export const absurd = (value: never, msg?: string) => {
    throw new Error(msg ?? "Invalid value");
}
