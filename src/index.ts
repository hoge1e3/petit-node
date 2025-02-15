/* eslint-disable no-unused-vars */

import * as _FS from "@hoge1e3/fs2";
import {EventHandler} from "@hoge1e3/events";
import {convert} from "./convImport";
import { /*liases as aliasStore,*/ initModuleGlobal, addAlias, addAliases } from "./alias";
import { CompiledESModule, ESModule, ESModuleCompiler, ESModuleEntry, cache as cache, getPath, isAlias, traceInvalidImport } from "./ESModule";
export { CompiledESModule} from "./ESModule";
import { NodeModule } from "./NodeModule";
export { NodeModule } from "./NodeModule";
import { gen as genfs } from "./fsgen";
import * as espree from 'espree';
import * as chai from "chai";
import * as assert from "@hoge1e3/assert";// Replace with assert polyfill, chai.assert is slow.
import * as util from "@hoge1e3/util";
import * as sfile from "@hoge1e3/sfile";
import { Aliases, ModuleValue } from "./types";
export {require} from "./CommonJS";
import {require} from "./CommonJS";

type SFile=_FS.SFile;
declare let globalThis:any;
function mod2obj<T extends object>(o:T):T&{default:T}{
    const res={} as T;
    for (let k in o) {
        res[k]=o[k];
    }
    return {...res, default:res};
}
export const FS=mod2obj(_FS);
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

const thisUrl=()=>(
    new URL(import.meta.url));
export let events=new EventHandler();
export let on=events.on.bind(events);
let pNode={
    boot, importModule, import: importModule, 
    createModuleURL, resolveEntry, 
    CompiledESModule, ESModuleEntry, 
    ESModule: CompiledESModule, NodeModule, addAlias, addAliases,
    convertStack, loadedModules, urlToFile, events, on, urlToPath, 
    thisUrl, FS, require,
    default:{} as any,
};
export default pNode;
pNode.default=pNode;
let builtInAliases:{[key:string]:ModuleValue}={
    "petit-node": pNode,
    "@hoge1e3/fs": FS,
    "@hoge1e3/fs2": FS,
    "@hoge1e3/sfile": sfile,
    fs: genfs(FS.nodePolyfill.fs),
    os: FS.nodePolyfill.os,
    path: FS.nodePolyfill.path,
    process: FS.nodePolyfill.process,
    assert,
    util,
    chai,
    "jszip": FS.JSZip,
    espree,
};
globalThis.process=FS.nodePolyfill.process;
function dupNodePrefix(keys:string[]){
    for (let k of keys) {
        builtInAliases[`node:${k}`]=builtInAliases[k];
    }
}
dupNodePrefix(["fs","os","path","process","assert","util"]);
type Initializer=(p:{FS:typeof FS, pNode: typeof pNode })=>Promise<any>;

type BootOptions={
    aliases: Aliases|undefined,
    init: Initializer|undefined,
};
export async function boot(options:BootOptions={
    aliases:undefined, init: undefined,
}) {
    await initModuleGlobal();
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
            mod=ESModuleEntry.fromNodeModule(new NodeModule(path));
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
    const compiler=ESModuleCompiler.create();
    const compiled=await compiler.compile(ent);
    let u=compiled.url;
    try {
        return await import(/* webpackIgnore: true */u);
    } catch(err) {
        const e=err as unknown as Error;
        if (e.message.match(/blob:/)) {
            throw traceInvalidImport(e, compiled);
        }
        throw err;
    }
}
export async function createModuleURL(f:SFile):Promise<string>{
    const compiler=ESModuleCompiler.create();
    return (await compiler.compile(ESModuleEntry.fromFile(f))).url;
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

export function* loadedModules():Generator<ESModule> {
    for(var entry of cache){
        yield entry;
    }
}
export function urlToPath(url:string):string {
    let ent=cache.byURL.get(url);
    if (!ent) return url;
    return getPath(ent);
}
export function urlToFile(url:string):SFile {
    let ent=cache.byURL.get(url);
    if (!ent) throw new Error(`${url} is not loaded.`);
    if (isAlias(ent)) throw new Error(`${url} is an Alias(${getPath(ent)}) that is not associated to a file.`);
    return ent.file;
}
