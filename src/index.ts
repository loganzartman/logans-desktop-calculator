import {run} from "./stacker";

window.addEventListener("load", function(){
    const runCode = event => {
        const input = document.getElementById("input") as HTMLInputElement;
        const registers = document.getElementById("registers");
        const output = document.getElementById("stack");
        try {
            const result = run(input.value);
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
    document.getElementById("input").addEventListener("keyup", event => {
        runCode(event);
    }, false);
}, false);
