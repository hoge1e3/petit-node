
//declare type SFileGetter = (path:string)=> SFile;
/*declare class ContentFactory {
    plainText(text:string, contentType?:string):Content;
}
declare type Content={
    toURL():string;
}*/
import {SFile} from "@hoge1e3/fs2";
export type TFS={
    get(path:string):SFile;
    getEnv():typeof process.env;
    getEnv(name:string):string|undefined;
    setEnv(name:string, value:string):void;
    PathUtil: typeof import("@hoge1e3/fs2").PathUtil;
    zip: typeof import("@hoge1e3/fs2").zip;
    SFile: typeof import("@hoge1e3/fs2").SFile;
    expand: typeof import("@hoge1e3/fs2").expand;
    expandPath: typeof import("@hoge1e3/fs2").expandPath;
    resolve: typeof import("@hoge1e3/fs2").resolve;
};
export type FSDEPS={
    path:typeof import("node:path"),
    fs:typeof import("node:fs"),
    //os:typeof import("node:os"),
    //process:typeof import("node:process"),
    Buffer:typeof import("node:buffer").Buffer,
    //JSZip:typeof import("jszip"),
}
export type FileBasedModuleType="ES"|"CJS";
export type ModuleType=FileBasedModuleType|"Builtin"|"External";
export interface Module{
    type: ModuleType,
    path: string,
    value?: ModuleValue,
    url?: string,
    dependencies: Module[],
    shouldReload(): boolean;
    dispose(): void;
}
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
    getByPath(path:string):Module|undefined;
    getByURL(url:string):Module|undefined;
}
export type AliasHash={[key:string]:ModuleValue};
