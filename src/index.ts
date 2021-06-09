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
            { token: 'delimiter.parenthesis', foreground: 'a3ffb8' }
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
        result.interpreter.stack.reverse().forEach(t => {
            const node = document.createElement("div");
            node.textContent = t.value;
            node.classList.add("stack-item");
            node.classList.add(`token--${typeof t.value}`);
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
            value.classList.add(`token--${typeof result.memory[k].value}`);
            value.textContent = `${result.memory[k].value}`;
            node.appendChild(label);
            node.appendChild(value);
            registers.appendChild(node);
        });
    } catch (e) {
        output.textContent = e;
    }
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

    document.getElementById("input").addEventListener("keyup", () => {
        const code = editor.getValue();
        runCode(code);
        window.history.replaceState(undefined, undefined, `#${base2048.encode(new TextEncoder().encode(code))}`);
    }, false);
}, false);
