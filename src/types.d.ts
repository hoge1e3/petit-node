
//declare type SFileGetter = (path:string)=> SFile;
/*declare class ContentFactory {
    plainText(text:string, contentType?:string):Content;
}
declare type Content={
    toURL():string;
}*/
export type ModuleValue=unknown;
export type GlobalValue={
    rawImport(url:string):Promise<ModuleValue>,
    aliases: Aliases,
};
export type GlobalInfo={
    value: GlobalValue,
    url: string,
};
export type Alias={
    path: string,
    url: string,
    value: ModuleValue,
};
export type Aliases={[key:string]: Alias};
