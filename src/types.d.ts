declare type SFile ={
    lastUpdate(): number;
    text(): string,
    up(): SFile,
    rel(path:string): SFile,
    sibling(path:string): SFile,
    exists(): boolean,
    isDir(): boolean,
    path(): string,
    name(): string,
    obj(): Object,
    getBlob(): Blob,
};
type Remover={
    remove:Function,
};
declare module "@hoge1e3/events" {
    class EventHandler{
        on(type:string, handler:Function):Remover;
        fire(type:string, arg:any):void;
    }
}
declare type SFileGetter = (path:string)=> SFile;
declare class ContentFactory {
    plainText(text:string, contentType?:string):Content;
}
declare type Content={
    toURL():string;
}
declare module "@hoge1e3/fs" {
    const def:{
        get:SFileGetter,
        Content: ContentFactory,
    };
    export default def;
    export const get:SFileGetter;
    export const Content:ContentFactory;
}