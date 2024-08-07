/* eslint-disable no-unused-vars */

import FS from "@hoge1e3/fs";
import { loadScriptTag, jsToBlobURL } from "./scriptTag";
import { initModuleGlobal } from "./global";
import {EventHandler} from "@hoge1e3/events";
import {convert} from "./convImport";
import { aliases as aliasStore, Aliases,ModuleValue } from "./alias";
import { ESModule, NodeModule, cache } from "./Module";
export { ESModule, NodeModule } from "./Module";
//import {convertStack2} from "./convertStack";
//export {convertStack2} from "./convertStack";
window.convert=convert;
declare let window:any;
type Global={
    aliases: Aliases,
    //hooks: {[key: string]: (res:ModuleValue)=>void},
    rawImport:(url:string)=>Promise<ModuleValue>,
};
type CreateScriptURLOption={
    deps:SFile[]|undefined,
};
type CreateURLOption=CreateScriptURLOption&{
    blob:Blob|undefined,
}
/*type URLs={
    url: string, path:string, lastUpdate:number,
    deps: SFile[],
}*/
let gbl:Global;
let gbl_url:string;
export let events=new EventHandler();
export let on=events.on.bind(events);
let pNode={
    boot, importModule, loadModule, createModuleURL, ESModule, NodeModule, addAlias, addAliases,
    convertStack, loadedModules, urlToFile, events, on, urlToPath, default:{} as any,
};
export default pNode;
pNode.default=pNode;
let builtInAliases:{[key:string]:ModuleValue}={
    "petit-node": pNode,
    "@hoge1e3/fs": FS,
};
type Initializer=(p:{FS:typeof FS, pNode: typeof pNode })=>Promise<any>;

type BootOptions={
    aliases: Aliases|undefined,
    init: Initializer|undefined,
};
export async function boot(options:BootOptions={
    aliases:undefined, init: undefined,
}) {
    const ginf=await initModuleGlobal();
    gbl=ginf.value;
    gbl.aliases=aliasStore;
    //gbl.hooks={};
    gbl_url=ginf.url;
    /*if (!gbl || !gbl_url) {
        console.log(ginf);
        throw new Error("Module Global init error");
    }*/
    const {aliases, init}=options;
    for (let k in builtInAliases) {
        addAlias(k, builtInAliases[k] as ModuleValue);
    }
    if (aliases) {
        addAliases(aliases);
    }
    if (init) {
        let path=await init({FS, pNode});
        if (!path) return;
        let file=(typeof path=="string"? FS.get(path): path as SFile);
        await loadModule(file);            
    }
}
export function addAliases(p:Aliases){
    for (let k in p) {
        addAlias(k, p[k]);
    }
}
export function addAlias(name:string, value:ModuleValue) {
    const jsCodeString=`
import gbl from "${gbl_url}";
let p=gbl.aliases["${name}"].value;
${Object.keys(value as any).map((key)=>
    key=="default"?
`export default p.default;`:
`export let ${key}=p.${key};`
    ).join("\n")}
`;
    let blobUrl = jsToBlobURL(jsCodeString);
    gbl.aliases[name]={
        url:blobUrl,
        value,
    };
}
export function importModule(path: SFile):Promise<ModuleValue>;
export function importModule(path: string, base: string|SFile):Promise<ModuleValue>;
export function importModule(path:string|SFile ,base?:string|SFile):Promise<ModuleValue>{
    let mod:ESModule;
    if(base){
        if (typeof path!=="string") {
            throw new Error("Invalid argument: either (file) or (str,file)");
        }
        mod=ESModule.resolve(path,
        typeof base==="string"?FS.get(base):base);
    } else {
        if (typeof path==="string") {
            throw new Error("Invalid argument: either (file) or (str,file)");
        }
        mod=ESModule.fromFile(path);
    }
    let u=mod.url;
    return gbl.rawImport(u);
//    return import(u);
/*
    let id=Math.random()+"";
    var blobUrl = jsToBlobURL(`
import * as m from "${u}";
import gbl from "${gbl_url}";
gbl.hooks['${id}'](m);
`);
    let hooks=gbl.hooks;
    return new Promise((s,err)=>{
        hooks[id]=(res)=>{
            URL.revokeObjectURL(blobUrl);
            delete hooks[id];
            s(res);
        };
        loadScriptTag(blobUrl,{
            type:"module"
        }).then(()=>0,err);
    });*/
}
export function loadModule(f:SFile){
    return loadScriptTag(createModuleURL(f),{
        type:"module"
    });
}
export function createModuleURL(f:SFile):string{
    return ESModule.fromFile(f).url;
/*
    let c=urlInCache(f);
    if(c)return c;
    let jsCodeString=f.text();
    let deps=[] as SFile[];
    let base=f.up();
    let a=(path:string):string=>{
        if (gbl.aliases[path]) {
            return gbl.aliases[path].url;
        }
        let d=resolveModule(path,base);
        deps.push(d);
        return createModuleURL(d);
    };
    jsCodeString=convert(f.path(),jsCodeString,a);
    let m:RegExpExecArray|null;
    let after="";
    m=/IMPORT END/.exec(jsCodeString);
    if(m){
        after=jsCodeString.substring(m.index);
        jsCodeString=jsCodeString.substring(0,m.index);
    }
    const commentRegExp = /\/\*[\s\S]*?\*\/|([^:"'=]|^)\/\/.*$/mg;
    const REPL="!ufXwu"+"fwfwefw!";
    let rqs=[] as string[];
    jsCodeString=jsCodeString.replace(commentRegExp,(_:string)=>{
        let id=rqs.length;
        rqs[id]=_;
        return REPL+id+REPL;
    });
    jsCodeString=jsCodeString.replace(
        /(import\s.*\sfrom\s+["'])(.+)(["'])/g,
        (_,pre,path,post)=>pre+a(path)+post
    )+after;
    jsCodeString=jsCodeString.replace(new RegExp(`${REPL}(\\d+)${REPL}`,"g"), (_,id)=>rqs[id]);
    if(jsCodeString.match(/\b__dirname\b/)){
        jsCodeString=`const __dirname=${
            JSON.stringify(base.path())
        };${jsCodeString}`;
    }
    return createScriptURL(jsCodeString,f,{deps});*/
}
/*
function urlInCache(f:SFile){
    let e=urls.get({path:f.path()});
    if(!e)return e;
    const miss=()=>{
        URL.revokeObjectURL(e.url);
        return undefined;
    };        
    if(f.lastUpdate()>e.lastUpdate)
        return miss();
    for(let f of e.deps){
        if(!urlInCache(f))
            return miss();
    }
    return e.url;
}
function createScriptURL(jsCodeString:string ,f:SFile,{deps}:CreateScriptURLOption){
    const blob = new Blob(
    [jsCodeString],
    { type: 'application/javascript' });
    return createURL(f,{blob,deps});
}
function createURL(f:SFile,opt:CreateURLOption={deps:undefined,blob:undefined}){
    if(!f.exists()){
        throw new Error(`Cannot createURL ${f}: not exists`);
    }
    let {blob,deps}=opt;
    if(!blob){
        blob=f.getBlob();
    }
    var blobUrl = URL.createObjectURL(blob);
    let name=f.path();
    urls.set({
        lastUpdate:f.lastUpdate(),
        path:name,url:blobUrl,deps:deps||[]
    });
    return blobUrl;
}*/
function isError(e:any):e is Error{
    return e&&typeof e.stack==="string";
}
type ErrorEvent={filename:string,colno:number,lineno:number,error:Error,message:string};
function errorHandler(ee:ErrorEvent){
    convertStack(ee.error);
    events.fire("error",{
        filename:urlToPath(ee.filename),
        colno:ee.colno, lineno:ee.lineno,
        error: ee.error, message: convertStack(ee.message),
    });
}
export function convertStack<T extends string|Error>(stack:T):T {
    return stack as T;
    /*if (typeof stack!=="string") {
        let e:Error=stack;
        if (!e) return e;
        if (typeof e.stack==="string") e.stack=convertStack(e.stack);
        if (typeof e.message==="string") e.message=convertStack(e.message);
    } else {
        let s:string=stack;
        for(var {url,file} of cache){
            s=s.replaceAll(url,file.path());
        }
        return s as T;    
    }*/
}
window.addEventListener("error",errorHandler);


export function* loadedModules():Generator<ESModule> {
    for(var entry of cache){
        yield entry;
    }
}
export function urlToPath(url:string):string {
    let ent=cache.byURL.get(url);
    if (!ent) return url;
    return ent.file.path();
}
export function urlToFile(url:string):SFile {
    let ent=cache.byURL.get(url);
    if (!ent) throw new Error("`${url} is not loaded.`");
    return ent.file;
}