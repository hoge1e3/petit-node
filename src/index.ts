/* eslint-disable no-unused-vars */

import * as _FS from "@hoge1e3/fs2";
import {EventHandler} from "@hoge1e3/events";
import {convert} from "./convImport.js";
import { /*liases as aliasStore,*/ initModuleGlobal, addAlias, addAliases,getAliases, addURL } from "./alias.js";
import { ESModuleCompiler, traceInvalidImport } from "./ESModule.js";
export { ESModuleCompiler} from "./ESModule.js";
import { NodeModule } from "./NodeModule.js";
export { NodeModule } from "./NodeModule.js";
import { gen as genfs } from "./fsgen.js";
import * as espree from 'espree';
import * as chai from "chai";
import assert from "@hoge1e3/assert";// Replace with assert polyfill, chai.assert is slow.
import * as util from "@hoge1e3/util";
import * as sfile from "@hoge1e3/sfile";
import { Aliases, AliasHash, Module, ModuleValue, TFS } from "./types";
export {require, CJSCompiler} from "./CommonJS.js";
import {require, CJSCompiler} from "./CommonJS.js";
import { CompiledCJS, CompiledESModule, ModuleEntry } from "./Module.js";
import { jsToBlobURL } from "./scriptTag.js";
import { JSZip, PathUtil, zip } from "@hoge1e3/fs2";

const core=setupCore();
declare let globalThis:any;
//declare let global:any;
type SFile=sfile.SFile;
const VERSION_SRC="__VER__1.4.7__SION__";
export let version=VERSION_SRC.replace(/\_\_VER\_\_/,"").replace(/\_\_SION\_\_/,"");
function setupCore(){
    let res;
    if (typeof globalThis!=="undefined" && globalThis.__nwpolyfill) {
        console.log("Using __nwpolyfill");
        const {fs,path,os}=globalThis.__nwpolyfill;
        const FS=new sfile.FileSystemFactory({fs, path, Buffer}) as unknown as TFS;
        FS.getEnv=function getEnv(name?:string): any {
            if (name == null) {
                return process.env;
            }
            return process.env[name];
        };
        FS.setEnv=function setEnv(name:string, value:string){
            process.env[name]=value;
        };
        FS.expand=function expand(str:string) {
            return str.replace(/\$\{([a-zA-Z0-9_]+)\}/g, function (a, key) {
                return FS.getEnv(key)||"";
            });
        }
        FS.expandPath=function expandPath(path:string) {
            path = FS.expand(path);
            path = path.replace(/\/+/g, "/");
            path = path.replace(/^[a-z][a-z]+:\//, (r)=>`${r}/`);
            return path;
        }
        FS.resolve=function resolve(path:SFile|string, base?:SFile|string){ 
            if (sfile.SFile.is(path)) return path;
            path = FS.expandPath(path);
            if (base && !PathUtil.isAbsolutePath(path)) {
                if (typeof base==="string"){
                    base = FS.expandPath(base);
                    return FS.get(base).rel(path);    
                } else {
                    return base.rel(path);
                }
            }
            return FS.get(path);
        };
        FS.PathUtil=PathUtil;
        FS.zip=zip;
        FS.SFile=sfile.SFile;
        res={
            FS,
            os,
            fs,
            path,
            process,
            Buffer,
        };
    } else {
        res={
            FS:_FS as TFS, 
            ..._FS.nodePolyfill,
        };
        res.process.release.name="petit-node";
    }
    return res;
}
function mod2obj<T extends object>(o:T):T&{default:T}{
    try {
        const res=o as T&{default:T};
        res.default=o;
        return res;
    } catch(e) {
        const res={} as T;
        for (let k in o) {
            res[k]=o[k];
        }
        return {...res, default:res};    
    }
}
/*
function wrapFSGet(FS:TFS):TFS {
    const props: (keyof TFS)[] = [
        "get", "getEnv", "setEnv", "PathUtil", "zip", "SFile", "expand", "expandPath", "resolve",
        "mount", "unmount", "getRootFS", "mountAsync","setDefaultPolicy",
        "deps", "mimeTypes", "_normalizePath", "addMIMEType",
    ];
    const res={} as TFS;
    for (let k of props) {
        res[k]=(FS as any)[k];
    }
    const orig=res.get.bind(res);
    res.get=(path:string):SFile=>{
        if (path.startsWith("blob:")) {
            path=urlToPath(path);
        }
        return orig(path);
    }
    (res as any).default=res;
    return res;
}*/
// FS.get uses #privateMember which causes error on wrapFSGet.
export const FS=/*wrapFSGet*/(mod2obj(core.FS));

const thisUrl=()=>(
    new URL(import.meta.url));
export let events=new EventHandler();
export let on=events.on.bind(events);
let pNode={
    boot, importModule, import: importModule, 
    createModuleURL, resolveEntry, 
    CompiledESModule, ModuleEntry, 
    ESModule: CompiledESModule, NodeModule, addAlias, addAliases,getAliases,
    ESModuleCompiler, CJSCompiler,
    convertStack, loadedModules, urlToFile, events, on, urlToPath, 
    thisUrl, FS, require,core,version,
    default:{} as any,
};
export default pNode;
pNode.default=pNode;
let builtInAliases:{[key:string]:ModuleValue}={
    "petit-node": pNode,
    "@hoge1e3/fs": FS,
    "@hoge1e3/fs2": FS,
    "@hoge1e3/sfile": sfile,
    fs: genfs(core.fs),
    os: core.os,
    path: core.path,
    process: core.process,
    buffer: core.Buffer,
    assert,
    util,
    chai,
    "jszip": JSZip,
    espree,
};
globalThis.process=globalThis.process||core.process;
globalThis.Buffer=globalThis.Buffer||core.Buffer;
function dupNodePrefix(keys:string[]){
    for (let k of keys) {
        builtInAliases[`node:${k}`]=builtInAliases[k];
    }
}
dupNodePrefix(["fs","os","path","process","assert","util"]);
type Initializer=(p:{FS:typeof FS, pNode: typeof pNode })=>Promise<any>;

type BootOptions={
    aliases: AliasHash|undefined,
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
export function resolveEntry(path: string|SFile):ModuleEntry;
export function resolveEntry(path: string, base: string|SFile):ModuleEntry;
export function resolveEntry(path: string|SFile ,base?:string|SFile):ModuleEntry{
    let mod:ModuleEntry;
    if(base){
        if (typeof path!=="string") throw invalidSpec();
        mod=ModuleEntry.resolve(
            path,
            typeof base==="string"?FS.get(base):base
        );
    } else {
        if (typeof path==="string") path=FS.get(path);// throw invalidSpec();
        if(path.isDir()){
            mod=ModuleEntry.fromNodeModule(new NodeModule(path));
        }else{
            mod=ModuleEntry.fromFile(path);
        }
    }
    return mod;
}
export async function importModule(path: string|SFile):Promise<ModuleValue>;
export async function importModule(path: string, base: string|SFile):Promise<ModuleValue>;
export async function importModule(path: string|SFile, base?:string|SFile):Promise<ModuleValue>{
    let ent;
    const aliases=getAliases();
    const _path=typeof path==="string"?path:path.path();
    const incache=aliases.getByPath(_path);
    if (incache?.value) {
        return incache.value;
    } else if (base) {
        if (typeof path!=="string") throw invalidSpec();
        ent=resolveEntry(path,base);
    } else {
        //if (typeof path==="string") throw invalidSpec();
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
    return (await compiler.compile(ModuleEntry.fromFile(f))).url;
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

export function loadedModules() {
    return getAliases();
}
export function urlToPath(url:string):string {
    let ent=loadedModules().getByURL(url, true);
    if (!ent) return url;
    return ent.path;
}
export function urlToFile(url:string):SFile {
    let mod=loadedModules().getByURL(url, true);
    if (!mod) throw new Error(`${url} is not loaded.`);
    if (mod instanceof CompiledESModule || mod instanceof CompiledCJS) {
        return mod.entry.file;
    }
    throw new Error(`${url}(${mod.path}) is not associated to a file.`);
}
export function addPrecompiledESModule(path:string, timestamp:number, compiledCode: string, dependencies:Module[]):CompiledESModule {
    const file=FS.get(path);
    const aliases=getAliases();
    const entry=ModuleEntry.fromFile(file, timestamp);
    const deps=dependencies;
    const url=jsToBlobURL(compiledCode);
    const res=new CompiledESModule(entry, deps, url, compiledCode);
    aliases.add(res);
    return res;
}
export function addPrecompiledCJSModule(path:string, timestamp:number, compiledCode:Function, dependencies:Module[]):CompiledCJS {
    const file=FS.get(path);
    const aliases=getAliases();
    const base=file.up()!;
    const require=(path:string)=>{
        const builtin=aliases.getByPath(path);
        if (builtin?.value) return builtin.value;
        const entry=ModuleEntry.resolve(path, base);
        const module=aliases.getByPath(entry.file.path());
        if (module?.value) return module.value;
        throw new Error(`Cannot resolve ${path}`);
    };
    const exports={} as ModuleValue, module={exports}, filename=file.path(), dirname=base.path();
    const args=[require, exports, module, filename, dirname ];
    const value=compiledCode(...args);
    const entry=ModuleEntry.fromFile(file,timestamp);
    const deps=dependencies;
    const res=new CompiledCJS(entry, deps, value, "/*preCompiledModule*/"+compiledCode);
    aliases.add(res);
    addURL(res);
    return res
}
