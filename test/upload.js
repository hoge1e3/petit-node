/*global globalThis*/
const PNODE_URL="../dist/index.js";
const pNode= await import(PNODE_URL);
const tmpBoot="/tmp/boot";
import "./console.js";
const timeout=(t)=>new Promise(s=>setTimeout(s,t));
globalThis.pNode=pNode;
let FS;
let menus;
let autoexec;
function status(...a){
    console.log(...a);
}
async function unzipURL(url, dest) {
    status("Fetching: "+url);
    const response = await fetch(url);
    console.log(response);
    let blob=await response.blob();
    return await unzipBlob(blob,dest);
}
async function unzipBlob(blob, dest) {
    status("unzipping blob ");
    let zip=FS.get("/tmp/setup.zip");
    await zip.setBlob(blob);
    dest.mkdir();
    await FS.zip.unzip(zip,dest,{v:true});
}
function fixrun(run){
    const ls=run.ls();
    
    console.log(ls.join(","));
    if(!ls.includes("package.json")&&
    ls.length==1){
        run=run.rel(ls[0]);
    }
    return run;
}
async function networkBoot(url){
    const boot=FS.get(FS.getEnv("boot"));
    await unzipURL(url, boot);
    status("Boot start!");
    rmbtn();
    await pNode.importModule(fixrun(boot));
}
function initCss(){
    const style = document.createElement('style');
    style.appendChild(document.createTextNode(`
    .menubtn {
        color: #008;
        width:100px;
        height:100px;
    }
    button:active{
        background:#ccc;
    }
    .menus{
        display: flex;
        flex-wrap: wrap;
    }
    .autob{
        background: #dc2;
    }
    .stop{
        background: #d20;
        position:absolute;
        bottom: 0px;
        right: 0px;
    }
    `));
    document.head.appendChild(style);
    menus=document.createElement('div');
    menus.classList.add("menus");
    document.body.appendChild(menus);
}
function fixBoot(boot){
    const ls=boot.ls();   
    console.log(ls.join(","));
    if(!ls.includes("package.json")&&
    ls.length==1){
        boot=boot.rel(ls[0]);
    }
    return boot;
}
function init(){
    initCss();
    console.log("init");
    pNode.boot({
        async init(o){
            globalThis.FS=FS=o.FS.default;
            FS.os={
                importModule:pNode.importModule,
                loadModule:pNode.importModule,
                createModuleURL:pNode.createModuleURL,
                urlToPath:pNode.urlToPath,
                convertStack:pNode.convertStack,
                loadScriptTag,
            };
            FS.setEnv("PNODE_VER",pNode.version);
            FS.setEnv("PNODE_URL",PNODE_URL);
            FS.setEnv("boot",tmpBoot);
            console.log("Mounting RAM/IDB");
            await FS.mountAsync("/tmp/","ram");
            await FS.mountAsync("/idb/","idb");
            console.log("Done");
            afterInit(o);
        }
    });
}
function rmbtn(){
    for(let b of document.querySelectorAll('button')){
        b.parentNode.removeChild(b);
    }
    quick=1;
}
let quick;
const handlers={
    async oncompilestart({entry}) {
        if(quick)return;
        await timeout(0);
        console.log("Compile start ",entry.file.path());
    },
    async oncompiled({module}) {
        if(quick)return;
        await timeout(0);
        console.log("Compile complete ",module.entry.file.path());
    },
    async oncachehit({entry}) {
        if(quick)return;
        await timeout(0);
        console.log("In cache ",entry.file.path());
    }
};
function afterInit({FS}){
    const rp=FS.get("/package.json");
    //btn("Setup/<br/>Restore",()=>networkBoot(SETUP_URL));
    btn("Insert<br/>Boot Disk",()=>insertBootDisk());
    console.log(rp.exists());
    if(rp.exists()){
        const o=rp.obj();
        if(o.menus){
            for(let k in o.menus){
                const run=o.menus[k];
                let main,auto;
                if(typeof run==="object"){
                    main=run.main;
                    auto=run.auto;
                    try {
                        const e=pNode.resolveEntry(FS.get(main));
                        const compiler=pNode.ESModuleCompiler.create(handlers);
                        compiler.compile(e).then(
                            r=>console.log("Prefetched auto start",r.url),
                            e=>console.error(e),
                        );
                    }catch(e) {
                        console.error(e);
                    }
                }else{
                    main=run;
                }
                btn(k,async ()=>{
                    rmbtn();
                    await console.log("start",main);
                    await timeout(10);
                    let mainF=fixBoot(FS.get(main));
                    FS.setEnv("boot",mainF.path());
                    await pNode.importModule(mainF);
                },auto);
            }
        }
    }
}
function onReady(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback);
    } else {
        callback();
    }
}
onReady(init);
function btn(c,a,auto){
    let b=document.createElement("button");
    b.classList.add("menubtn");
    b.innerHTML=c;
    menus.append(b);
    const act=async()=>{
        try {
            abortAuto();
            await a();
        }catch(e){
            console.error(e);
            alert(e.stack||e);
        }
    };
    b.addEventListener("click", act);	    
    if(auto){
        b.classList.add("autob");
        console.log("auto start ",c," in 2 seconds.");
        autoexec=act;
        stopBtn();
    }
}
function abortAuto(){
    const b=document.querySelector("button.stop");
    if(b)document.body.removeChild(b);
    console.log("Boot aborted.");
    autoexec=null;
}
function stopBtn(){
    if(document.querySelector("button.stop"))return ;
    const b=document.createElement("button");
    b.classList.add("menubtn");
    b.classList.add("stop");
    b.innerHTML="Stop<br>auto start<br>2";
    document.body.append(b);
    const act=async()=>{
        abortAuto();
    };
    b.addEventListener("click", act);	    
    setTimeout(async()=>{
        if(b.parentNode){
            b.parentNode.removeChild(b);
        }
        await timeout(10);
        if(autoexec)autoexec();
    },2000);
    setTimeout(()=>{
        b.innerHTML="Stop<br>auto start<br>1";
    },1000);
}
function loadScriptTag(url,attr){
    /*global define,requirejs*/
    if (attr.type!=="module" && 
    typeof define==="function" && 
    define.amd && 
    typeof requirejs==="function") {
        return new Promise(
        (s)=>requirejs([url],(r)=>s(r)));
    }
    const script = document.createElement('script');
    script.src = url;
    for(let k in attr){
        script.setAttribute(k,attr[k]);
    }
    return new Promise(
    function (resolve,reject){
        script.addEventListener("load",resolve);
        script.addEventListener("error",reject);
        document.head.appendChild(script);
    });
}
function insertBootDisk() {
    const cas=document.createElement("input");
    cas.setAttribute("type","file");
    document.body.appendChild(cas);
    const dl=document.createElement("div");
    dl.innerHTML=`<a href="https://github.com/hoge1e3/acepad-dev/archive/refs/heads/main.zip">Download Sample Boot Disk</a>`;
    document.body.appendChild(dl);
    cas.addEventListener("input",async function () {
        let boot=FS.get(tmpBoot);
        await unzipBlob(this.files[0],boot);
        rmbtn();
        boot=fixBoot(boot);
        FS.setEnv("boot",boot.path());
        pNode.importModule(boot);
    });
}
