import * as monaco from "monaco-editor";
import {run} from "./stacker";

const createEditor = () => {
    return monaco.editor.create(document.getElementById("input"), {
        theme: 'vs-dark',
        minimap: {
            enabled: false
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
    document.getElementById("input").addEventListener("keyup", () => {
        runCode(editor.getValue());
    }, false);
}, false);
