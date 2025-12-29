
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
import { FSTypeName, IFileSystem } from "petit-fs/src/fs/types";
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
export type FileBasedModuleType="ES"|"CJS";
export type ModuleType=FileBasedModuleType|"Builtin"|"External";
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
export type Aliases=IModuleCache;//Map<string, Module>;//{[key:string]: Alias};
export interface IModuleCache extends Iterable<Module> {
    add(m:Module):void;
    delete(m:Module):void;
    reload(m:Module):void;
    getByPath(path:string, skipCheckReload?:boolean):Module|undefined;
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