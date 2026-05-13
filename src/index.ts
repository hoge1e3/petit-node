/* eslint-disable no-unused-vars */

import * as _FS from "@hoge1e3/fs2";
import {EventHandler} from "@hoge1e3/events";
import { Aliases } from "./alias.js";
//export { addAlias, addAliases,  getAliases } from "./alias.js";
import { ESModuleCompiler, traceInvalidImport } from "./ESModule.js";
export { ESModuleCompiler} from "./ESModule.js";
import { NodeModule } from "./NodeModule.js";
export { NodeModule } from "./NodeModule.js";
import { gen as genfs } from "./fsgen.js";
import * as espree from 'espree';
import * as chai from "chai";
import assert from "@hoge1e3/assert";// Replace with assert polyfill, chai.assert is slow.
import * as util from "@hoge1e3/util";
import * as url from "@hoge1e3/url";
import * as sfile from "@hoge1e3/sfile";
import { AliasHash, BootOptions, Core, ESModuleCompilerHandlers, ESModuleCompilerParam, IModuleCache, ImportOrRequire, Module, ModuleValue, PNode, ScriptingContext, TFS } from "../types/";
import {require} from "./CommonJS.js";
export {require, CJSCompiler} from "./CommonJS.js";
import { CompiledCJS, CompiledESModule, FileBasedModuleEntry } from "./Module.js";
export { CompiledESModule, FileBasedModuleEntry as ModuleEntry } from "./Module.js";
import { jsToBlobURL } from "./scriptTag.js";
import { JSZip,} from "@hoge1e3/fs2";
import * as querystring from "querystring";
import {createModulePolyfill} from "./polyfills/module.js";
import * as vm from "./polyfills/vm.js";
import * as constants from "./polyfills/constants.js";
import * as stream from "./polyfills/stream.js";
import { DeviceManager } from "petit-fs/src/vfsUtil.js";

declare let globalThis:any;
//declare let global:any;
type SFile=sfile.SFile;
const VERSION_SRC="__VER__2.0.1__SION__";
export let version=VERSION_SRC.replace(/\_\_VER\_\_/,"").replace(/\_\_SION\_\_/,"");
function setupCore(){
    let res={
        FS:_FS as TFS, 
        ..._FS.nodePolyfill,
    };
    res.process.release.name="petit-node";
    res.process.version=version;
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

//export let FS:TFS|null=null;//=(mod2obj(core.FS));
export const thisUrl=()=>(
    new URL(/* webpackIgnore: true */import.meta.url));

export const ESModule=CompiledESModule;



function hackTimeouts(){
    const g=globalThis as any;
    for(let k of ["setTimeout","setInterval",
    "clearTimeout","clearInterval",]){
        g[k]=g[k].bind(g);
    }
}
/*:(typeof import("./index.js"))&{import:typeof importModule}={
    boot, importModule, import: importModule, init:boot, 
    createModuleURL, resolveEntry, 
    CompiledESModule, ModuleEntry, 
    ESModule: CompiledESModule, NodeModule, addAlias, addAliases,getAliases,
    ESModuleCompiler, CJSCompiler,
    convertStack, loadedModules, urlToFile, events, on, urlToPath, 
    thisUrl, FS:null as (null|TFS), require,core:null as (null|Core),version,
    file, getFS, getNodeLikeFs, getCore, getDeviceManager,
    addPrecompiledCJSModule,
    addPrecompiledESModule,
    default:{} as any,
};*/
const invalidSpec=()=>new Error("Invalid argument: either (file) or (str,file)");
type ErrorEvent={filename:string,colno:number,lineno:number,error:Error,message:string};

export let events=new EventHandler();
export let on=events.on.bind(events);
function createScriptingContext(g:any):ScriptingContext {
    return {
        process: g.process,
        Blob: g.Blob,
        URL: g.URL,
        Function: g.Function,
        eval: (s)=>g.eval(s),
        importModule: new g.Function("url","return import(/* webpackIgnore: true */url);"),  
    };
}
export function createInstance(_globalThis:any):PNode {
const scriptingContext:ScriptingContext=createScriptingContext(_globalThis);
return {
aliases: new Aliases(scriptingContext),
events, on,
core:null as Core|null,
version,
file(path:string):SFile{
    return this.getFS().get(path);
},
getFS(): TFS { 
    if (!this.FS) throw new Error("FS is not set");
    return this.FS; 
},
getNodeLikeFs(): typeof import("node:fs") {
    return this.getCore()?.fs;
},
getDeviceManager():DeviceManager {
    return this.getCore()?.dev;
},
getCore(){ return this.core; },
builtInAliases:{} as {[key:string]:ModuleValue},
dupNodePrefix(keys:string[]){
    for (let k of keys) {
        this.builtInAliases[`node:${k}`]=this.builtInAliases[k];
    }
},
FS:undefined as TFS|undefined,
async boot(options:BootOptions={
    aliases:undefined, init: undefined, core: undefined,
    main: undefined, fstab: undefined,
}) {
    await this.aliases.initModuleGlobal();
    const {aliases, init, fstab, main}=options;
    const core=options.core||setupCore();
    scriptingContext.process=core.process;
    const FS=mod2obj(core.FS);
    this.FS=FS;
    this.core=core;
    const builtInAliases:{[key:string]:ModuleValue}={
        //--
        //"petit-node": pNode,
        //--
        "pnode:main": this,
        "pnode:core": core,
        "pnode:FS": FS,
        "pnode:dev": core.dev,
        "pnode:sfile": sfile,
        fs: genfs(core.fs),
        os: core.os,
        path: core.path,
        process: core.process,
        buffer: core.Buffer,
        assert,
        util,
        url,
        // polyfills
        querystring,vm,constants,stream,
        module: createModulePolyfill(this.aliases, FS),
        "pnode:chai": chai,
        "pnode:jszip": JSZip,
        "pnode:espree": espree,
    };
    this.builtInAliases=builtInAliases;
    this.dupNodePrefix(["fs","os","path","process","buffer","assert","util","url",
        "querystring","vm","constants","stream","module"]);
    /*
    It seems not to be used... Especially in nw.js (globalThis.process===global.process)
    const extendEnv=(p:any)=>{
        const r={...p};
        r.env=Object.assign({},r.env);
        return r;
    };*/
    globalThis.process=globalThis.process||(core.process);
    globalThis.global=globalThis;
    globalThis.Buffer=globalThis.Buffer||core.Buffer;
    hackTimeouts();
    try{
       globalThis.addEventListener("error",this.errorHandler.bind(this));
       globalThis.addEventListener("unhandledrejection",this.errorHandler.bind(this));
    } catch(e){
        console.error(e);
    }
    for (let k in builtInAliases) {
        this.aliases.addAlias(k, builtInAliases[k] as ModuleValue);
    }
    if (aliases) {
        this.aliases.addAliases(aliases);
    }
    if (fstab) {
        await this.getDeviceManager().loadFstab(fstab);
    }
    if (init) {
        let path=await init({FS, pNode:this});
        if (!path) return;
        let file=(typeof path=="string"? FS.get(path): path as SFile);
        return await this.importModule(file);            
    } else if (main) {
        let file=(typeof main=="string"? FS.get(main): main as SFile);
        return await this.importModule(file);       
    }
},
init(options:BootOptions={
    aliases:undefined, init: undefined, core: undefined,
    main: undefined, fstab: undefined,
}){return this.boot(options);},
//resolveEntry(wantModuleType: ImportOrRequire, path: string|SFile):ModuleEntry;
//resolveEntry(wantModuleType: ImportOrRequire, path: string, base: string|SFile):ModuleEntry;
resolveEntry(wantModuleType: ImportOrRequire, path: string|SFile ,base?:string|SFile):FileBasedModuleEntry{
    let mod:FileBasedModuleEntry;
    if(base){
        if (typeof path!=="string") throw invalidSpec();
        mod=FileBasedModuleEntry.resolve(
            wantModuleType,
            path,
            typeof base==="string"?this.getFS().get(base):base
        );
    } else {
        if (typeof path==="string") path=this.getFS().get(path);// throw invalidSpec();
        if(path.isDir()){
            mod=FileBasedModuleEntry.fromNodeModule(wantModuleType, new NodeModule(path));
        }else{
            mod=FileBasedModuleEntry.fromFile(path);
        }
    }
    return mod;
},
//importModule(path: string|SFile):Promise<ModuleValue>;
//importModule(path: string, base: string|SFile):Promise<ModuleValue>;
async importModule(path: string|SFile, base?:string|SFile):Promise<ModuleValue>{
    let ent;
    const aliases=this.aliases;
    const _path=typeof path==="string"?path:path.path();
    const incache=aliases.cache.getByPath(_path);
    if (incache?.value) {
        return incache.value;
    } else if (base) {
        if (typeof path!=="string") throw invalidSpec();
        ent=this.resolveEntry("import",path,base);
    } else {
        ent=this.resolveEntry("import", path);
    }
    const compiler=ESModuleCompiler.create({
        aliases: this.aliases,
    });
    const compiled=await compiler.compile(ent);
    let u=compiled.url;
    try {
        return await this.aliases.scriptingContext.importModule(/* webpackIgnore: true */u);
    } catch(err) {
        const e=err as unknown as Error;
        if (e.message.match(/blob:/)) {
            throw traceInvalidImport(this.aliases.cache, e, compiled);
        }
        throw err;
    }
},
import(url:string){return this.importModule(url);},
async createModuleURL(f:SFile):Promise<string>{
    const compiler=ESModuleCompiler.create({
        aliases: this.aliases,
    });
    return (await compiler.compile(FileBasedModuleEntry.fromFile(f))).url;
},
createESModuleCompiler(handler: ESModuleCompilerHandlers={}):ESModuleCompiler{
    return ESModuleCompiler.create({
        ...handler,
        aliases: this.aliases,
    });
},
errorHandler(ee:ErrorEvent){
    this.convertStack(ee.error);
    events.fire("error",{
        filename:this.urlToPath(ee.filename),
        colno:ee.colno, lineno:ee.lineno,
        error: ee.error, message: this.convertStack(ee.message),
    });
},
convertStack<T extends string|Error>(stack:T):T {
    return stack as T;
},
/*
try{
    globalThis.convert=convert;
    globalThis.addEventListener("error",errorHandler);
} catch(e){
}
*/

loadedModules():IModuleCache {
    return this.aliases.cache;
},
urlToPath(url:string):string {
    let ent=this.loadedModules().getByURL(url, true);
    if (!ent) return url;
    return ent.path;
},
urlToFile(url:string):SFile {
    let mod=this.loadedModules().getByURL(url, true);
    if (!mod) throw new Error(`${url} is not loaded.`);
    if (mod instanceof CompiledESModule || mod instanceof CompiledCJS) {
        return mod.entry.file;
    }
    throw new Error(`${url}(${mod.path}) is not associated to a file.`);
},
addPrecompiledESModule(path:string, timestamp:number, compiledCode: string, dependencies:Module[]):CompiledESModule {
    const file=this.getFS().get(path);
    const aliases=this.aliases.cache;
    const entry=FileBasedModuleEntry.fromFile(file, timestamp);
    const deps=dependencies;
    const url=jsToBlobURL(this.aliases.scriptingContext, compiledCode);
    const res=new CompiledESModule(
        this.aliases.scriptingContext, entry, deps, url, compiledCode);
    aliases.add(res);
    return res;
},
addPrecompiledCJSModule(path:string, timestamp:number, compiledCode:Function, dependencyMap:Map<string,Module>):CompiledCJS {
    const file=this.getFS().get(path);
    const cache=this.aliases.cache;
    const base=file.up()!;
    const require=(path:string)=>{
        const builtin=cache.getByPath(path);
        if (builtin?.value) return builtin.value;
        const entry=FileBasedModuleEntry.resolve("require",path, base);
        const module=cache.getByPath(entry.file.path());
        if (module?.value) return module.value;
        throw new Error(`Cannot resolve ${path}`);
    };
    const exports={} as ModuleValue, module={exports}, filename=file.path(), dirname=base.path();
    const args=[require, exports, module, filename, dirname ];
    const value=compiledCode(...args);
    const entry=FileBasedModuleEntry.fromFile(file,timestamp);
    const res=new CompiledCJS(
        this.aliases.scriptingContext,entry, dependencyMap, value, "/*preCompiledModule*/"+compiledCode);
    cache.add(res);
    this.aliases.addURL(res);
    return res
},
getAliases(){return this.aliases.cache;},
addAliases(p:AliasHash){return this.aliases.addAliases(p);},
addAlias(path:string, value:ModuleValue, properties?:string[]) {
    return this.aliases.addAlias(path, value, properties);
},
require(porf:string|SFile, base?:SFile|string):ModuleValue{
    if(typeof porf==="string") {
        switch (typeof base) {
            case "undefined":
            return require(this.aliases, porf);
            case "string":
            return require(this.aliases, porf, base);
            default://SFile
            return require(this.aliases, porf, base);
        }
    }
    return require(this.aliases, porf);
},
clone(_globalThis:any):PNode {
    return createInstance(_globalThis);
},
default:undefined as (PNode|undefined),
};//of return
}// of createInstance

const pNode=createInstance(globalThis);
export default pNode;
pNode.default=pNode;


export const FS=pNode.FS;
export const addAlias=pNode.addAlias;
export const addAliases=pNode.addAliases;
export const addPrecompiledCJSModule=pNode.addPrecompiledCJSModule.bind(pNode);
export const addPrecompiledESModule=pNode.addPrecompiledESModule.bind(pNode);
export const boot=pNode.boot.bind(pNode);
export const convertStack=pNode.convertStack.bind(pNode);
export const core=pNode.core;
export const createModuleURL=pNode.createModuleURL.bind(pNode);
export const createESModuleCompiler=pNode.createESModuleCompiler.bind(pNode);
//export const events=pNode.events;
export const file=pNode.file.bind(pNode);
export const getAliases=pNode.getAliases;
export const getCore=pNode.getCore.bind(pNode);
export const getDeviceManager=pNode.getDeviceManager.bind(pNode);
export const getFS=pNode.getFS.bind(pNode);
export const getNodeLikeFs=pNode.getNodeLikeFs.bind(pNode);
export const importModule=pNode.importModule.bind(pNode);
export const init=pNode.init.bind(pNode);
export const loadedModules=pNode.loadedModules.bind(pNode);
//export const on=pNode.on;
//export const require=pNode.require;
export const resolveEntry=pNode.resolveEntry.bind(pNode);
export const urlToFile=pNode.urlToFile.bind(pNode);
export const urlToPath=pNode.urlToPath.bind(pNode);
