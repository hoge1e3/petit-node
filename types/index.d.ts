
//declare type SFileGetter = (path:string)=> SFile;
/*declare class ContentFactory {
    plainText(text:string, contentType?:string):Content;
}
declare type Content={
    toURL():string;
}*/
import {SFile} from "@hoge1e3/fs2";
import { DependencyContainer, Policy } from "@hoge1e3/sfile";
import { MIMETypes } from "@hoge1e3/sfile/src/MIMETypes";
import RootFS from "petit-fs/src/fs/RootFS";
import { IFileSystem } from "petit-fs/src/fs/types";
import { DeviceManager } from "petit-fs/src/vfsUtil.js";
import { Fstab } from "petit-fs/src/types.js";
import { EventHandler } from "@hoge1e3/events";
export type TFS={
    get(path:string):SFile;
    setDefaultPolicy(policy?:Policy):void;
    getEnv():typeof process.env;
    getEnv(name:string):string|undefined;
    setEnv(name:string, value:string):void;
    PathUtil: typeof import("@hoge1e3/fs2").PathUtil;
    zip: typeof import("@hoge1e3/fs2").zip;
    SFile: typeof import("@hoge1e3/fs2").SFile;
    expand: typeof import("@hoge1e3/fs2").expand;
    expandPath: typeof import("@hoge1e3/fs2").expandPath;
    resolve: typeof import("@hoge1e3/fs2").resolve;
    //--- not for nw.js, only petit-fs ---
    mount?(mountPoint:string, fs:string|IFileSystem):IFileSystem;
    mountAsync?(mountPoint:string, fs:string):Promise<IFileSystem>;    
    unmount?(mountPoint:string):void;
    getRootFS?():RootFS;
    //--- see SFile.ts 
    deps?: DependencyContainer;
    mimeTypes?: MIMETypes;
    addMIMEType?(extension:string, contentType:string):void;
    _normalizePath?(inputPath:string):string;
  };
export type FSDEPS={
    path:typeof import("node:path"),
    fs:typeof import("node:fs"),
    //os:typeof import("node:os"),
    //process:typeof import("node:process"),
    Buffer:typeof import("node:buffer").Buffer,
    //JSZip:typeof import("jszip"),
}
export type ImportOrRequire="import"|"require";
export interface FileBasedModule extends Module {
    readonly type:FileBasedModuleType;
    entry:IFileBasedModuleEntry;
}
export type FileBasedModuleType="ES"|"CJS";
export type ModuleType=FileBasedModuleType|"Builtin"|"External"|"CDN";
export interface Module{
    type: ModuleType,
    path: string,
    value?: ModuleValue,
    url?: string,
    dependencies: Module[],
    shouldReload():boolean;
    shouldReloadLoop(path: Set<Module>): boolean;
    dispose(): void;
}
export interface IAliases {
    addAliases(p:AliasHash):void;
    addAlias(path:string, value:ModuleValue, properties?:string[]):void;
    cache:IModuleCache;
    addURL(module:ICompiledCJS/*, properties?:string[]*/):void;
    scriptingContext: ScriptingContext;
    initModuleGlobal():Promise<GlobalInfo>;
}
export interface ESModuleCompilerParam extends ESModuleCompilerHandlers{
    aliases: IAliases,
}
export interface ESModuleCompilerHandlers {
    oncompilestart?:(e:CompileStartEvent)=>Promise<void>;
    oncompiled?:(e:CompiledEvent)=>Promise<void>;
    oncachehit?:(e:CompileStartEvent)=>Promise<void>;
}
export type CompiledEvent={
    module: Module,
};
export type CompileStartEvent={
    entry: IFileBasedModuleEntry,
    byOtherCompiler?: boolean,
    isCJS?: boolean,
};

export interface ICompiledESModule extends FileBasedModule {
    type: "ES";
    entry: IFileBasedModuleEntry;
    dependencies: Module[];
    url: string;
    generatedCode: string;
    shouldReload(): boolean;
    //shouldReloadLoop(path: Set<Module>): boolean;
    dispose(): void;
}
export interface ICompiledCJS extends FileBasedModule  {
    type: "CJS";
    entry: IFileBasedModuleEntry;
    dependencyMap: Map<string, Module>;
    value: ModuleValue;
    generatedCode: string;
    url?: string;
    shouldReload(): boolean;
    //shouldReloadLoop(path: Set<Module>): boolean;
    dispose(): void;
}
/*export type RawModuleEntry={
    file: SFile, type: FileBasedModuleType,
};*/
export type ModuleValue=unknown;
export type GlobalValue={
    aliases: IModuleCache,
};
export type GlobalInfo={
    value: GlobalValue,
    url: string,
};
declare const sym_cacheKey: unique symbol;
export type CacheKey=(`file://${string}`|`cdn://${string}`)&{[sym_cacheKey]:true};
// "file:///path"  or "cdn://@hoge/fuga"

//export type Aliases=IModuleCache;//Map<string, Module>;//{[key:string]: Alias};
export interface IModuleCache extends Iterable<Module> {
    add(m:Module):void;
    delete(m:Module):void;
    reload(m:Module):void;
    getByPath(path:CacheKey, skipCheckReload?:boolean):Module|undefined;
    getByURL(url:string, skipCheckReload?:boolean):Module|undefined;
}
export type AliasHash={[key:string]:ModuleValue};
/*export interface DeviceManager {
    //mountSync(mountPoint: string, resolver: IFileSystem|FSTypeName, options:any={}): IFileSystem;
    mount(mountPoint: string, resolver: FSTypeName, options:any): Promise<IFileSystem>;
    unmount(mountPoint:string):void;
    fstab():IFileSystem[];
    commitPromise():Promise<void>;
}*/
export type Core={
    FS:TFS,
    os:any,
    fs:any,
    dev:any,
    path:any,
    process:any,
    Buffer:BufferConstructor,
};
export type BootOptions={
    aliases: AliasHash|undefined,
    init: Initializer|undefined,
    core: Core|undefined,
    main: string|SFile|undefined,
    fstab: Fstab[]|undefined,
};
export type Initializer=(p:{FS:TFS, pNode: PNode })=>Promise<any>;
export interface IModuleEntry{
    moduleType():ModuleType,
}
export interface IFileBasedModuleEntry extends IModuleEntry{
    file: SFile,
    sourceCode: string,
    timestamp: number,
    _shouldReload():boolean;
    moduleType():FileBasedModuleType,
}
export interface ICDNModuleEntry extends IModuleEntry {
    name: string,
    url(): string,
    global? :string,
    moduleType():"CDN",
}
export interface IESModuleCompiler{
    compile(entry:IFileBasedModuleEntry):Promise<ICompiledESModule>;
}
export interface PNode {
  aliases:IAliases,
  version: string,
  core: Core | null;
  file(path: string): SFile;
  getFS(): TFS;
  getNodeLikeFs(): typeof import("node:fs");
  getDeviceManager(): DeviceManager;
  getCore(): Core | null;
  builtInAliases: { [key: string]: ModuleValue };
  dupNodePrefix(keys: string[]): void;
  FS: TFS | undefined;
  boot(options?: BootOptions): Promise<any>;
  init(options?: BootOptions): Promise<any>;
  resolveEntry(wantModuleType: ImportOrRequire, path: string|SFile):IModuleEntry;
  resolveEntry(wantModuleType: ImportOrRequire, path: string, base: string|SFile):IModuleEntry;
  resolveEntry(
    wantModuleType: ImportOrRequire,
    path: string | SFile,
    base?: string | SFile
  ): IModuleEntry;
  importModule(path: string|SFile):Promise<ModuleValue>;
  importModule(path: string, base: string|SFile):Promise<ModuleValue>;
  importModule(
    path: string | SFile,
    base?: string | SFile
  ): Promise<ModuleValue>;
  import: PNode["importModule"],
  createModuleURL(f:SFile):Promise<string>;
  errorHandler(ee:ErrorEvent):void;
  convertStack<T extends string|Error>(stack:T):T;
  loadedModules():IModuleCache;
  urlToPath(url:string):string;
  urlToFile(url:string):SFile;
  createESModuleCompiler(handlers?:ESModuleCompilerHandlers):IESModuleCompiler;
  addPrecompiledESModule(path:string, timestamp:number, compiledCode: string, dependencies:Module[]):ICompiledESModule;
  addPrecompiledCJSModule(path:string, timestamp:number, compiledCode:Function, dependencyMap:Map<string,Module>):ICompiledCJS;
  events: EventHandler;
  on: EventHandler["on"];
  getAliases():IModuleCache;
  loadedModules():IModuleCache;
  addAliases(p:AliasHash):void;
  addAlias(path:string, value:ModuleValue, properties?:string[]):void;
  require(path:string):ModuleValue;
  require(file:SFile):ModuleValue;
  require(path:string, base:SFile):ModuleValue;
  require(path:string, base:string):ModuleValue;
  require(porf:string|SFile, base?:SFile|string):ModuleValue;
  clone(_globalThis:any):PNode;
  default: PNode | undefined;
}
export type ScriptingContext={
    process?: typeof import("node:process"),
    Blob: typeof Blob,
    URL: typeof URL,
    importModule: (url:string)=>Promise<any>,
    Function: typeof Function,
    eval: (script:string)=>any,
}
/*
  const scrt=ig.document.createElement("script");
  const id=Math.random()+"";
  scrt.innerHTML=`globalThis[${id}]={
  importModule:(url)=>import(url),Blob,URL,
};`;
  ig.document.body.appendChild(scrt);
  const ictx=ig[id];
  delete ig[id];
*/