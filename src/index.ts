import {run} from "./stacker";

window.addEventListener("load", function(){
    const runCode = event => {
        const input = document.getElementById("input") as HTMLInputElement;
        const output = document.getElementById("output");
        try {
            const result = run(input.value);
            output.textContent = `${result}`;
        } catch (e) {
            output.textContent = e;
        }
    };
    document.getElementById("input").addEventListener("keyup", event => {
        runCode(event);
    }, false);
}, false);
