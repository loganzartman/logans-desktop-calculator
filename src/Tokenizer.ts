import Token from './Token';

type RuleMatchConsumer = (args: {match: string, location: number, length: number}) => Token | void;
export type RuleSet = [RegExp, RuleMatchConsumer][];

export default class Tokenizer {
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