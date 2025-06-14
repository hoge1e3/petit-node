/*global globalThis*/
export let pNode;
export let FS;
export let menus;
let autoexec;
export const timeout=(t)=>new Promise(s=>setTimeout(s,t));
export async function loadPNode(env){
    if (!env.PNODE_URL) throw new Error("PNODE_URL should set");
    pNode=await import(env.PNODE_URL);
    Object.assign(process.env, env);
    process.env.PNODE_VER=pNode.version;
    process.env.boot=process.env.TMP_BOOT||"/tmp/boot/";
    FS=pNode.FS;
}
function status(...a){
    console.log(...a);
}
export async function unzipURL(url, dest) {
    status("Fetching: "+url);
    const response = await fetch(url);
    console.log(response);
    let blob=await response.blob();
    return await unzipBlob(blob,dest);
}
export async function unzipBlob(blob, dest) {
    status("unzipping blob ");
    let zip=FS.get("/tmp/boot.zip");
    await zip.setBlob(blob);
    dest.mkdir();
    await FS.zip.unzip(zip,dest,{v:1});
}
export function fixrun(run){
    try{
        const ls=run.ls();
        //console.log(ls.join(","));
        if(!ls.includes("package.json")&&
        ls.length==1){
            run=run.rel(ls[0]);
        }
    }catch(e){
        console.error(e);
    }
    return run;
}
export async function networkBoot(url){
    const boot=FS.get(process.env.boot);
    await unzipURL(url, boot);
    status("Boot start!");
    rmbtn();
    await pNode.importModule(fixrun(boot));
}
export function initCss(){
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
export async function init(env){
    await loadPNode(env);
    initCss();
    //stopBtn();
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
            console.log("Mounting RAM/IDB");
            FS.mount("/tmp/","ram");
            await FS.mountAsync("/idb/","idb");
            console.log("Done");
            //networkBoot("acepad/setup.zip");
            afterInit(o);
        }
    });
    return pNode;
}
export function rmbtn(){
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
        //console.log("Compile start ",entry.file.path());
    },
    async oncompiled({module}) {
        if(quick)return;
        await timeout(0);
        console.log("Compile complete ",module.entry.file.path());
    },
    async oncachehit({entry}) {
        if(quick)return;
        await timeout(0);
        //if (entry) console.log("In cache ",entry.file.path());
    }
};
function afterInit({FS}){
    if (process.env.SETUP_URL) {
        btn("Setup/<br/>Restore",()=>networkBoot(process.env.SETUP_URL));
    }
    btn("Insert<br/>Boot Disk",()=>insertBootDisk());
    btn("Factory<br/>Reset",()=>resetall());
    
    const rp=FS.get("/package.json");
    //console.log("rp",rp.exists());
    if(rp.exists()){
        parseRootPackageJson(rp);
    }
}
export function parseMenus(menus){
    for(let k in menus){
        const main=menus[k];
        if(typeof main==="string"){
            menus[k]={main};
        }
    }
    return menus;
}
let prefetched_auto_url;
export function prefetchAuto({mainF}) {
    try {
        prefetched_auto_url=[];
        const e=pNode.resolveEntry(mainF);
        const compiler=pNode.ESModuleCompiler.create(handlers);
        compiler.compile(e).then(
        r=>{
            const f=prefetched_auto_url;
            prefetched_auto_url=r.url;
            console.log("Prefetched auto start",prefetched_auto_url);
            for(let h of f) h(prefetched_auto_url);
        },
        e=>console.error(e),
        );
    }catch(e) {
        prefetched_auto_url=undefined;
        console.error(e);
    }
}
export function parseRootPackageJson(rp) {
    const o=rp.obj();
    //console.log("rp.obj",o);
    if(o.menus){
        const menus=parseMenus(o.menus);
        for(let k in menus){
            const {main,auto}=menus[k];
            const mainF=fixrun(FS.get(main));
            if (auto) prefetchAuto({mainF});
            btn(k,async ()=>{
                rmbtn();
                process.env.boot=mainF.path();
                await console.log("start",process.env.boot);
                await timeout(1);
                if (auto && typeof prefetched_auto_url==="string") {
                    await import(prefetched_auto_url);   
                } else if (auto && Array.isArray(prefetched_auto_url)) {
                    prefetched_auto_url.push((u)=>import(u));
                } else {
                    await pNode.importModule(mainF);
                }
            },auto);
        }
    }
}
export function btn(c,a,auto){
    let b=document.createElement("button");
    b.classList.add("menubtn");
    b.innerHTML=c;
    menus.append(b);
    const act=async()=>{
        try {
            abortAuto();
            await a();
        }catch(e){console.error(e.message+"\n"+e.stack);}
    };
    b.addEventListener("click", act);	    
    if(auto){
        b.classList.add("autob");
        console.log("auto start ",c," in 2 seconds.");
        autoexec=act;
        stopBtn();
    }
}
export function abortAuto(){
    const b=document.querySelector("button.stop");
    if(b)document.body.removeChild(b);
    if (autoexec) console.log("Boot aborted.");
    autoexec=null;
}
export function stopBtn(){
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


export function loadScriptTag(url,attr={}){
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
export const prefetched={};// value:
export async function prefetchScript(url, options) {
    const {module, global, }=options||{};
    if (prefetched[url]) {
        console.log("Using prefeteched",url);
        return prefetched[url];
    }
    /*if (dependencies) {
        await Promise.all(dependencies.map(url=>prefetchScript(url)));
    }*/
    if (module) {
        const value=await import(url);
        prefetched[url]={value};
        return prefetched[url];
    } else {
        await loadScriptTag(url);
        const value=(global?globalThis[global]:null);
        prefetched[url]={value};
        return prefetched[url];
    }
}
globalThis.prefetchScript=prefetchScript;
export function insertBootDisk() {
    const cas=document.createElement("input");
    cas.setAttribute("type","file");
    document.body.appendChild(cas);
    if (process.env.BOOT_DISK_URL) {
        const dl=document.createElement("div");
        dl.innerHTML=`<a href="${process.env.BOOT_DISK_URL}">Download Sample Boot Disk</a>`;
        document.body.appendChild(dl);
    }
    
    //const cas=document.querySelector("#casette");
    cas.addEventListener("input",async function () {
        const run=FS.get(FS.getEnv("boot"));
        await unzipBlob(this.files[0],run);
        rmbtn();
        pNode.importModule(fixrun(run));
    });
}

export async function resetall(a){
    if(prompt("type 'really' to clear all data")!=="really")return;
    for(let k in localStorage){
        delete localStorage[k];
    }
}

export function getQueryString(key, default_) {
    if (arguments.length === 1) default_ = "";
    key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + key + "=([^&#]*)");
    var qs = regex.exec(location.href);
    if (qs == null) return default_;else return decodeURLComponentEx(qs[1]);
}
export function decodeURLComponentEx(s) {
    return decodeURIComponent(s.replace(/\+/g, '%20'));
}
export function onReady(callback) {
    if (document.readyState==="complete") callback();
    else addEventListener("load",callback);
}