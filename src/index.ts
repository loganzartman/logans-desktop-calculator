import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import * as base2048 from "base2048";
import {run, RE, InterpreterError} from "./stacker";

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

const getLineCol = (source: string, location: number): [number, number] => {
    let i = 0;
    let line = 1;
    let col = 0;
    let last = null;
    while (i <= location) {
        const char = source[i];
        if (char === "\r" || (char === "\n" && last !== "\r")) {
            ++line;
            col = 0;
        }
        else if (char !== "\n") {
            ++col;
        }
        last = char;
        ++i;
    }
    return [line, col];
};

const runCode = ({code, editor}: {code: string, editor: monaco.editor.IStandaloneCodeEditor}) => {
    const registers = document.getElementById("registers");
    const output = document.getElementById("stack");
    try {
        monaco.editor.setModelMarkers(editor.getModel(), 'whatever', []);

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
        if (e instanceof InterpreterError && typeof e.location === 'number') {
            const [startLineNumber, startColumn] = getLineCol(code, e.location);
            const [endLineNumber, endColumn] = getLineCol(code, e.location + e.length ?? 1);
            monaco.editor.setModelMarkers(editor.getModel(), 'whatever', [
                {startLineNumber, startColumn, endLineNumber, endColumn, severity: monaco.MarkerSeverity.Error, message: e.message}
            ]);
        }
        output.textContent = e.message;
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
        runCode({code, editor});
        window.history.replaceState(undefined, undefined, `#${base2048.encode(new TextEncoder().encode(code))}`);
    }, false);
}, false);
