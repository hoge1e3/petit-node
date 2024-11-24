/* eslint-disable no-unused-vars */

import _FS from "@hoge1e3/fs";
import { jsToBlobURL } from "./scriptTag";
import { initModuleGlobal } from "./global";
import {EventHandler} from "@hoge1e3/events";
import {convert} from "./convImport";
import { aliases as aliasStore, Aliases,ModuleValue } from "./alias";
import { CompiledESModule, ESModuleEntry, NodeModule, compiledCache as cache } from "./Module";
export { CompiledESModule, NodeModule } from "./Module";
declare let globalThis:any;
export const FS=_FS;
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
    boot, importModule, createModuleURL, resolveEntry, 
    CompiledESModule, ESModuleEntry, 
    ESModule: CompiledESModule, NodeModule, addAlias, addAliases,
    convertStack, loadedModules, urlToFile, events, on, urlToPath, 
    thisUrl, FS,
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
    gbl_url=ginf.url;
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
        return await importModule(file);            
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
const invalidSpec=()=>new Error("Invalid argument: either (file) or (str,file)");
export function resolveEntry(path: SFile):ESModuleEntry;
export function resolveEntry(path: string, base: string|SFile):ESModuleEntry;
export function resolveEntry(path: string|SFile ,base?:string|SFile):ESModuleEntry{
    let mod:ESModuleEntry;
    if(base){
        if (typeof path!=="string") throw invalidSpec();
        mod=ESModuleEntry.resolve(
            path,
            typeof base==="string"?FS.get(base):base
        );
    } else {
        if (typeof path==="string") throw invalidSpec();
        if(path.isDir()){
            mod=new NodeModule(path).getMain();
        }else{
            mod=ESModuleEntry.fromFile(path);
        }
    }
    return mod;
}
export async function importModule(path: SFile):Promise<ModuleValue>;
export async function importModule(path: string, base: string|SFile):Promise<ModuleValue>;
export async function importModule(path: string|SFile ,base?:string|SFile):Promise<ModuleValue>{
    let ent;
    if (base) {
        if (typeof path!=="string") throw invalidSpec();
        ent=resolveEntry(path,base);
    } else {
        if (typeof path==="string") throw invalidSpec();
        ent=resolveEntry(path);
    }
    let u=(await ent.compile()).url;
    return import(/* webpackIgnore: true */u);
}
export async function createModuleURL(f:SFile):Promise<string>{
    return (await ESModuleEntry.fromFile(f).compile()).url;
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
try{
    globalThis.convert=convert;
    globalThis.addEventListener("error",errorHandler);
} catch(e){
}

export function* loadedModules():Generator<CompiledESModule> {
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
