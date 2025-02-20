
//declare type SFileGetter = (path:string)=> SFile;
/*declare class ContentFactory {
    plainText(text:string, contentType?:string):Content;
}
declare type Content={
    toURL():string;
}*/
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