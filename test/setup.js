/* global pNode */
function loadFixture(dir,fixture) {
    for (let name in fixture) {
        const f=dir.rel(name);
        const val=fixture[name];
        if (f.isDir()) {
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
async function main(fixture,aliases){
    checkModuleExports(pNode);
    await pNode.boot({
        async init({FS}){
            FS.mount("/node/",FS.LSFS.ramDisk());
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