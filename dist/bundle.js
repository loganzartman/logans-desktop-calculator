!function(e){var t={};function r(n){if(t[n])return t[n].exports;var o=t[n]={i:n,l:!1,exports:{}};return e[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}r.m=e,r.c=t,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="",r(r.s=0)}([function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});const n=r(1);window.addEventListener("load",function(){document.getElementById("input").addEventListener("keyup",e=>{(e=>{const t=document.getElementById("input"),r=document.getElementById("registers"),o=document.getElementById("stack");try{const e=n.run(t.value);o.innerHTML="",e.interpreter.stack.reverse().forEach(e=>{const t=document.createElement("div");t.textContent=e.value,o.appendChild(t)}),r.innerHTML="",Object.keys(e.memory).forEach(t=>{const n=document.createElement("span");n.textContent=`${t}: ${e.memory[t].value}`,r.appendChild(n)})}catch(e){o.textContent=e}})()},!1)},!1)},function(e,t,r){"use strict";Object.defineProperty(t,"__esModule",{value:!0});t.InputExhausted=class extends Error{};function n(e){return e&&Symbol.iterator in e}t.UnknownOperator=class extends Error{};class o{constructor({type:e,value:t}){this.type=e,this.value=t}clone(){const{type:e,value:t}=this;return new o({type:e,value:t})}}t.Token=o;class a{constructor(e){this.ruleSet=e}tokenizeParen(e){let t=0,r=0;do{if(r>=e.length)throw new Error("Unmatched parentheses");"("===e[r]?++t:")"===e[r]&&--t,++r}while(t>0);const n=e.slice(1,r-1);return[new o({type:"symbol",value:n}),e.slice(r)]}*tokenize(e){for(;e.length>0;){if("("===e[0]){const[t,r]=this.tokenizeParen(e);e=r,yield t;continue}let t=0,r=null,n=null;for(let[o,a]of this.ruleSet){const u=o.exec(e);if(!u||0!==u.index)continue;const l=u[0].length;l>t&&(t=l,r=u,n=a)}if(0===t)throw new Error(`Unrecognized grammar starting here: ${e.slice(0,32)}`);const o=n(r);o&&(yield o),e=e.slice(t)}}}t.Tokenizer=a;class u{constructor(e,t=!1,r=e.length){this.func=e,this.arity=r,this.rest=t,this.interpreter=null}collectArgs(e,t){const r=[];for(let n=0;n<this.arity;++n){if(0===e.stack.length)throw new Error(`Expected ${this.arity} operands for operator "${t}"`);r.push(e.stack.pop())}if(this.rest)for(;e.stack.length>0;)r.push(e.stack.pop());return r}pushResult(e,t){n(t)?e.stack.push(...t):t&&e.stack.push(t)}invoke(e,t){const r=this.collectArgs(e,t);this.interpreter=e;const n=this.func.apply(this,r);return this.interpreter=null,this.pushResult(e,n),n}}t.Operator=u;class l{constructor(e,t){this.stack=[],this.opTable=e,this.tokenizer=t}getOp(e){if(e in this.opTable)return this.opTable[e];throw new Error(`"${e}" is not an operator`)}evaluate(e){const t=this.tokenizer.tokenize(e);for(let e of t)if("symbol"===e.type&&this.stack.push(e),"operator"===e.type){this.getOp(e.value).invoke(this,e.value)}if(0!==this.stack.length)return this.stack[this.stack.length-1]}}t.Interpreter=l,t.run=function(e){const t={},r=e=>new u((...t)=>new o({type:"symbol",value:e(...t)}),!1,e.length),s={"+":r((e,t)=>e.value+t.value),"-":r((e,t)=>e.value-t.value),"*":r((e,t)=>e.value*t.value),"/":r((e,t)=>e.value/t.value),"^":r((e,t)=>e.value**t.value),"==":r((e,t)=>e.value===t.value),"<":r((e,t)=>e.value<t.value),">":r((e,t)=>e.value>t.value),"<=":r((e,t)=>e.value<=t.value),">=":r((e,t)=>e.value>=t.value),not:r(e=>!e.value),and:r((e,t)=>e.value&&t.value),or:r((e,t)=>e.value||t.value),if:new u(function(e,t,r){const n=this.interpreter.evaluate(e.value);this.interpreter.stack.pop(),n&&n.value?this.interpreter.evaluate(t.value):this.interpreter.evaluate(r.value)}),print:new u(e=>{console.log(e.value)}),dup:new u(e=>[e,e.clone()]),swap:new u((e,t)=>[e,t]),pop:new u(e=>{}),clear:new u((...e)=>{},!0),reduce:new u(function(e,t,...r){const o=this.interpreter.getOp(e.value);if(2!==o.arity)throw new Error(`A reduce operator must accept 2 operands; "${e.value}" requires ${o.arity}`);this.interpreter.stack.push(t);for(let t of r)if(this.interpreter.stack.push(t),n(o.invoke(this.interpreter,e.value)))throw new Error(`Reduce operator "${e.value}" produced more than one return value`);return this.interpreter.stack.pop()},!0),map:new u(function(e,...t){const r=this.interpreter.getOp(e.value);if(1!==r.arity)throw new Error(`A map operator must accept 1 operand; "${e.value}" requires ${r.arity}`);for(;t.length>0;){const o=t.pop();if(this.interpreter.stack.push(o),n(r.invoke(this.interpreter,e.value)))throw new Error(`Map operator "${e.value}" produced more than one return value`)}return this.interpreter.stack.pop()},!0),range:new u(function*(e,t,r){if("number"!=typeof e.value||"number"!=typeof t.value||"number"!=typeof r.value)throw new Error("range operator expects numerical arguments");const n=Math.sign(t.value-e.value),a=Math.abs(t.value-e.value)/r.value;let u=e.value;for(let e=0;e<a;++e)yield new o({type:"symbol",value:u}),u+=n*r.value}),"alias-op":new u((e,t)=>{s[e.value]=s[t.value]}),"define-op":new u((e,t,r)=>{s[r.value]=new u(function(...t){this.interpreter.stack.push(...t),this.interpreter.evaluate(e.value)},!1,t.value)}),"del-op":new u(e=>{delete s[e.value]}),store:new u((e,r)=>{t[e.value]=r}),load:new u(e=>t[e.value]),delete:new u(e=>{delete t[e.value]}),eval:new u(function(e){this.interpreter.evaluate(e.value)})},i=new a([[/\s+/,e=>{}],[/\/\/.*?$/m,e=>{}],[/\*+[^*]*\*+(?:[^\/*][^*]*\*+)*/,e=>{}],[/("|')((?:[^\1\\]|\\.)*?)\1/,e=>{const t=e[2].replace(/\\(.)/g,"$1");return new o({type:"symbol",value:t})}],[/true|false/,e=>new o({type:"symbol",value:"true"===e[0]})],[/[+-]?\d*\.?[0-9]+([eE][+-]?\d+)?/,e=>new o({type:"symbol",value:Number.parseFloat(e[0])})],[/\S+/,e=>{const t=e[0];return new o(t in s?{type:"operator",value:t}:{type:"symbol",value:t})}]]),c=new l(s,i),p=c.evaluate(e);return p?{value:p.value,interpreter:c,memory:t}:{value:void 0,interpreter:c,memory:t}}}]);