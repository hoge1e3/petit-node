/* eslint-disable no-unused-vars */

import FS from "@hoge1e3/fs";
import { jsToBlobURL } from "./scriptTag";
import { initModuleGlobal } from "./global";
import {EventHandler} from "@hoge1e3/events";
import {convert} from "./convImport";
import { aliases as aliasStore, Aliases,ModuleValue } from "./alias";
import { ESModule, NodeModule, cache } from "./Module";
export { ESModule, NodeModule } from "./Module";
window.convert=convert;
declare let window:any;
type Global={
    aliases: Aliases,
    //hooks: {[key: string]: (res:ModuleValue)=>void},
    //rawImport:(url:string)=>Promise<ModuleValue>,
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
const thisUrl=()=>(
    new URL(import.meta.url));
export let events=new EventHandler();
export let on=events.on.bind(events);
let pNode={
    boot, importModule, createModuleURL, ESModule, NodeModule, addAlias, addAliases,
    convertStack, loadedModules, urlToFile, events, on, urlToPath, 
    thisUrl,
    default:{} as any,
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
        await importModule(file);            
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
        if(path.isDir()){
            mod=new NodeModule(path).getMain();
        }else{
            mod=ESModule.fromFile(path);
        }
    }
    let u=mod.url;
    return import(/* webpackIgnore: true */u);
    //return gbl.rawImport(u);
}

export function createModuleURL(f:SFile):string{
    return ESModule.fromFile(f).url;
}
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
