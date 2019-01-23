import {run} from "./stacker";

window.addEventListener("load", function(){
    const runCode = event => {
        const input = document.getElementById("input") as HTMLInputElement;
        const output = document.getElementById("output");
        try {
            const result = run(input.value);
            output.innerHTML = "";
            result.interpreter.stack.reverse().forEach(t => {
                const node = document.createElement("div");
                node.textContent = t.value;
                output.appendChild(node);
            });
        } catch (e) {
            output.textContent = e;
        }
    };
    document.getElementById("input").addEventListener("keyup", event => {
        runCode(event);
    }, false);
}, false);
