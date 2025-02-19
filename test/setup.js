import pNode from "../dist/index.js";
export function loadFixture(dir,fixture) {
    for (let name in fixture) {
        const f=dir.rel(name);
        const val=fixture[name];
        if (f.isDirPath()) {
            loadFixture(f, val);
        } else {
            if (typeof val==="object") {
                f.obj(val);
            } else {
                f.text(val);
            }
        }
    }
}
export const sleep=(t=1000)=>new Promise(s=>setTimeout(s,t));
export async function main(fixture,aliases){
    checkModuleExports(pNode);
    return await pNode.boot({
        async init({FS}){
            FS.mount("/node/","ram");
            let node=FS.get("/node/");
            loadFixture(node, fixture);
            if (aliases) {
                pNode.addAliases(aliases);
            }
            return node.rel("main.js");
        },
    });
}   
function checkModuleExports(mod) {
    const errors=[];
    for (let k in mod) {
        if (k==="default") continue;
        if (mod[k]!==mod.default[k]) errors.push("+"+k);//throw new Error("Attribute missing in default: "+k);
    }
    for (let k in mod.default) {
        if (k==="default") continue;
        if (mod[k]!==mod.default[k]) errors.push("-"+k);//throw new Error("Attribute missing in non-default: "+k);
    }
    if (errors.length) throw new Error("Attribute missing +:default -:non-default  "+errors.join(", "));
}
export function prt(...args){
    const content=document.createElement("div");
    content.innerText=args.join(" ");
    document.body.appendChild(content);
}