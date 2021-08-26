import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as base2048 from "base2048";
import {run, RE} from "./stacker";

const createEditor = () => {
    monaco.languages.register({ id: 'ldc' });
    monaco.languages.setLanguageConfiguration('ldc', {
        brackets: [["(", ")"], ['"', '"']],
        wordPattern: /[^()\s]+/,
        folding: {
            markers: {
                start: /[(]/, 
                end: /[)].*\n/,
            }
        }
    });
    monaco.languages.setMonarchTokensProvider('ldc', {
        tokenizer: {
            root: [
                { include: '@whitespace' },
                [/[()]/, '@brackets'],
                [RE.boolean, "boolean"],
                [RE.number, "number"],
                [RE.stringQuotes, "string"],
                [RE.stringSymbol, "string"],
                [RE.localName, "identifier.local"],
                [RE.identifier, "identifier"],
            ],
            whitespace: [
                [/[ \t\r\n]+/, 'white'],
                [/\/\*/, 'comment', '@comment'],
                [/\/\/.*$/, 'comment'],
            ],
            comment: [
                [/[^\/*]+/, 'comment' ],
                [/\/\*/,    'comment', '@push' ], // nested comment
                ["\\*/",    'comment', '@pop'  ],
                [/[\/*]/,   'comment' ]
            ],
        }
    });
    monaco.editor.defineTheme('theme', {
        base: 'vs-dark',
        inherit: true,
        colors: {
            'editor.selectionBackground': '#a3ffb830',
        },
        rules: [
            { token: 'number', foreground: 'FF7563' },
            { token: 'string', foreground: 'a3ffb8' },
            { token: 'boolean', foreground: 'A763FF' },
            { token: 'comment', foreground: '888888' },
            { token: 'delimiter.parenthesis', foreground: 'a3ffb8' },
            { token: 'identifier.local', foreground: 'CCAF9B' },
        ]
    });

    return monaco.editor.create(document.getElementById("input"), {
        theme: 'theme',
        language: 'ldc',
        fontSize: 24,
        fontFamily: 'Inconsolata',
        lineNumbers: 'off',
        automaticLayout: true,
        tabSize: 2,
        minimap: {
            enabled: false,
        }
    });
}

const runCode = (code) => {
    const registers = document.getElementById("registers");
    const output = document.getElementById("stack");
    try {
        const result = run(code);
        output.innerHTML = "";
        result.interpreter.stack.reverse().forEach(token => {
            const node = document.createElement("div");
            node.textContent = token.value;
            node.classList.add("stack-item");
            node.classList.add(`token-${token.type}`);
            node.classList.add(`token-${token.type}--${typeof token.value}`);
            output.appendChild(node);
        });
        registers.innerHTML = "";
        Object.keys(result.memory).forEach(k => {
            const node = document.createElement("div");
            node.className = 'register';
            const label = document.createElement("div");
            label.className = 'register-label';
            label.textContent = `${k}`;
            const value = document.createElement("div");
            value.classList.add('register-value');
            const token = result.memory[k];
            value.classList.add(`token-${token.type}`);
            value.classList.add(`token-${token.type}--${typeof token.value}`);
            value.textContent = `${result.memory[k].value}`;
            node.appendChild(label);
            node.appendChild(value);
            registers.appendChild(node);
        });
    } catch (e) {
        output.textContent = e;
    }
};

const debounce = (fn, interval) => {
    let last = 0;
    let lastArgs = undefined;
    let timeout = null;
    return (...args) => {
        lastArgs = args;
        const timeElapsed = Date.now() - last;
        if (timeElapsed > interval) {
            last = Date.now();
            fn(...lastArgs);
        } else if (timeout === null) {
            timeout = setTimeout(() => {
                last = Date.now();
                fn(...lastArgs);
                timeout = null;
            }, interval - timeElapsed);
        } else {
        }
    };
};

window.addEventListener("load", function(){
    const editor = createEditor();
    try {
        const hash = decodeURIComponent(document.location.hash.substring(1));
        const bytes = base2048.decode(hash);
        const code = new TextDecoder().decode(bytes);
        editor.setValue(code);
    } catch (e) {
        console.error(e);
    }

    const updateHash = debounce((code) => {
        window.history.replaceState(undefined, undefined, `#${base2048.encode(new TextEncoder().encode(code))}`);
    }, 500);

    document.getElementById("input").addEventListener("keyup", () => {
        const code = editor.getValue();
        runCode(code);
        updateHash(code);
    }, false);
}, false);
