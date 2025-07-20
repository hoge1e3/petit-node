/*global globalThis*/

export let pNode;

export let FS;
export let menus;
export let submenus;
let autoexec;
function mp(){
    const t=()=>{
        let v=t,f,c=()=>v!==t&&f&&f(v);
        return{v:(_)=>c(v=_),f:(_)=>c(f=_)};
    },s=t(),e=t();return Object.assign(
    new Promise((a,b)=>s.f(a)+e.f(b)),
    {resolve:s.v, reject:e.v});
}
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
export async function fullBackup(){
    await FS.zip.zip(FS.get("/"));
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
        z-index:100;
    }
    .submenus {
        z-index:10;
        position: absolute;
        width:100%;
        left:0;
        top:0;
    }
    .submenus div {
        font-size: 18px;
        border: 1px solid black;
        background: linear-gradient(#fff, #ddd);
        padding: 5px;
    }
    .submenus div:active {
        background:#ccc;
    }
    `));
    document.head.appendChild(style);
    menus=document.createElement('div');
    menus.classList.add("menus");
    document.body.appendChild(menus);
    submenus=document.createElement('div');
    submenus.classList.add("submenus");
    document.body.appendChild(submenus);
    submenus.style.display="none";
    
}
export async function init(env){
    await loadPNode(env);
    return new Promise((s)=>{
        initCss();
        //stopBtn();
        console.log("init");
        pNode.boot({
            async init(o){
                globalThis.FS=FS=o.FS.default;
                /*console.log("Mounting RAM/IDB");
                FS.mount("/tmp/","ram");
                await FS.mountAsync("/idb/","idb");
                console.log("Done");*/
                s(pNode);
            }
        });
        //return pNode;
    });
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
export function showMenus(rp){
    if (process.env.SETUP_URL) {
        btn("Setup/<br/>Restore",()=>networkBoot(process.env.SETUP_URL));
    }
    btn("Insert<br/>Boot Disk",()=>insertBootDisk());
    btn("Factory<br/>Reset",()=>resetall());
    
    //console.log("rp",rp.exists());
    if(rp.exists()){
        showMainmenus(rp);
        showSubmenus(rp);
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
let prefetched_auto_url=mp();
export async function prefetchAuto({mainF}) {
    try {
        const e=pNode.resolveEntry(mainF);
        const compiler=pNode.ESModuleCompiler.create(handlers);
        const r=await compiler.compile(e);
        prefetched_auto_url.resolve(r.url);
        console.log("Prefetched auto start",r.url);
    }catch(e) {
        prefetched_auto_url.reject(e);
        console.error(e);
    }
}
export function initAutoexec(rp) {
    if (!rp.exists()) return;
    const o=rp.obj();
    //console.log("rp.obj",o);
    if(!o.menus) return;
    const menus=parseMenus(o.menus);
    for(let k in menus){
        const {main,auto, submenus}=menus[k];
        const mainF=fixrun(FS.get(main));
        if (auto) {
            
            prefetchAuto({mainF});
        }
    }
    
}
export function showMainmenus(rp) {
    const o=rp.obj();
    //console.log("rp.obj",o);
    if(!o.menus)return;
    const menus=parseMenus(o.menus);
    let hasAuto;
    for(let k in menus){
        const {main,auto, submenus}=menus[k];
        if (auto) hasAuto=true;
        btn(k,async ()=>{
            const mainF=fixrun(FS.get(main));
            rmbtn();
            process.env.boot=mainF.path();
            await console.log("start",process.env.boot);
            await timeout(1);
            if (auto) {
                prefetched_auto_url.then((u)=>import(u));
            } else {
                selectedSubmenu=null;
                await pNode.importModule(mainF);
            }
        },auto);
    }
    if (hasAuto) stopBtn();
    
}
export function getSelectedSubmenu() {
    return selectedSubmenu;
}
let selectedSubmenu;
export function showSubmenus(rp) {
    const o=rp.obj();
    if(!o.menus)return;
    const menus=parseMenus(o.menus);
    let submenuF;
    for(let k in menus){
        const {main,auto, submenus}=menus[k];
        if (auto && submenus) {
            submenuF=FS.get(submenus);
        }
    }
    if (!submenuF || !submenuF.exists()) return;
    for (let m of submenuF.obj()) {
        selectedSubmenu=selectedSubmenu||mp();
        submenus.style.display="block";
        const md=document.createElement("div");
        md.innerText=typeof m==="string"?m:m.label;
        md.addEventListener("click",()=>{
            const value=typeof m==="string"?m:m.value;
            console.log("Selected ", value);
            if (typeof process!=="undefined" && process.env){
                process.env.SUBMENU_SELECTED=value;   
                selectedSubmenu.resolve(value);
            }
            hideSubmenus();
            clickAutostartMenu();
        });
        submenus.appendChild(md);
    }
    
}
export function hideSubmenus(){
    submenus.style.display="none";
    
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
    }
    /*console.log("auto start ",c," in 2 seconds.");
    autoexec=act;
    stopBtn();
    */
}
export function abortAuto(){
    const b=document.querySelector("button.stop");
    if(b)document.body.removeChild(b);
    if (stopBtnTimer) console.log("Auto boot aborted.");
    clearTimeout(stopBtnTimer);
    stopBtnTimer=null;
}
let stopBtnTimer;
export function stopBtn(){
    if(document.querySelector("button.stop"))return ;
    const b=document.createElement("button");
    b.classList.add("menubtn");
    b.classList.add("stop");
    
    b.innerHTML="Stop<br>auto start<br>2";
    document.body.append(b);
    const act=async()=>{
        selectedSubmenu=null;
        hideSubmenus();
        abortAuto();
    };
    b.addEventListener("click", act);	    
    stopBtnTimer=setTimeout(async()=>{
        if(b.parentNode){
            b.parentNode.removeChild(b);
        }
        await timeout(10);
        clickAutostartMenu();
    },2000);
    setTimeout(()=>{
        b.innerHTML="Stop<br>auto start<br>1";
    },1000);
}
export function clickAutostartMenu(){
    const ab=document.querySelector("button.autob");
    if (ab) {
        ab.dispatchEvent(new Event("click"));
    }
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