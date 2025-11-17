import { SFile } from "@hoge1e3/sfile";
import { NodeModule } from "./NodeModule.js";
import * as FS from "@hoge1e3/fs2";
import { FileBasedModuleType, IModuleCache, Module, ModuleValue, RawModuleEntry } from "./types";
function cjsFallback(file:SFile) {
    if (file.name().includes(".")) return file;
    const tries=[
        ()=>file.sibling(file.name()+".js"),
        //<path>.json
        ()=>file.rel("index.js"),
        //<path>/index.json
    ];
    for (let t of tries) {
        try {
            const f=t();if (f.exists()) return f; 
        }catch(e){}
    }
    throw new Error(`no cjs module for ${file.path()} found.`);
}
export class ModuleEntry {
    public file: SFile;
    public type: FileBasedModuleType;
    constructor(
        public entry: RawModuleEntry,
        public sourceCode: string,
        public timestamp: number,
        ) {
            this.file=entry.file;
            this.type=entry.type;
    }
    _shouldReload():boolean {
        if (!this.file.exists()) return false;// for preload module
        return /*this.isError()||*/this.file.lastUpdate()!==this.timestamp;
    }
    moduleType():FileBasedModuleType {
        return this.type;// NodeModule.moduleTypeOfFile(this.file);
    }
    static fromFile(wantModuleType:FileBasedModuleType, file:SFile, timestamp:number=file.lastUpdate()):ModuleEntry {
        if (wantModuleType==="CJS") file=cjsFallback(file);
        const newEntry=new ModuleEntry({type: wantModuleType,file}, file.text(), timestamp);
        return newEntry;
    }
    static resolve(wantModuleType:FileBasedModuleType,path:string,base:SFile):ModuleEntry{
        if (path.match(/^[\.\/]/)) {
            let file=path.match(/^\./)?
                base.rel(path):FS.get(path);
            if (wantModuleType==="CJS") file=cjsFallback(file);
            const mtype=NodeModule.moduleTypeOfFile(file);
            if (wantModuleType==="CJS" && mtype==="ES") {
                throw new Error(`Cannot import es module '${file}' from cjs`);
            }
            return ModuleEntry.fromFile(mtype, file);
        }else {
            const [main,sub]=NodeModule.parsePath(path);
            return this.fromNodeModule(wantModuleType, NodeModule.resolve(main,base),sub);
        }
    }
    static fromNodeModule(wantModuleType:FileBasedModuleType, m:NodeModule, subPath="."):ModuleEntry {
        const {file, type}=m.getEntry(wantModuleType, subPath);
        return ModuleEntry.fromFile(type, file);
    }
}
export interface FileBasedModule extends Module {
    readonly type:FileBasedModuleType;
    entry:ModuleEntry;
}
export class CompiledESModule implements FileBasedModule {
    readonly type="ES";
    public readonly path:string;
    constructor(
        public readonly entry: ModuleEntry,
        public readonly dependencies: Module[],
        public readonly url: string,
        public readonly generatedCode: string,
    ){
        this.path=entry.file.path();
    }
    shouldReload():boolean {
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>dep.shouldReload());
    }
    dispose(){
        URL.revokeObjectURL(this.url);
    }
}
export class CompiledCJS implements FileBasedModule{
    readonly type="CJS";
    public readonly path:string;
    public url:string|undefined;
    constructor(
        public readonly entry: ModuleEntry,
        public readonly dependencies: Module[],
        public readonly value: ModuleValue,
        public readonly generatedCode: string,
    ){
        this.path=entry.file.path();
    }
    shouldReload():boolean {
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>dep.shouldReload());
    }
    dispose(){
        if (this.url) URL.revokeObjectURL(this.url);
    }
}
export class BuiltinModule implements Module {
    readonly type="Builtin";
    dependencies: Module[];
    constructor(public path:string, public value:ModuleValue, public url:string) {
        this.dependencies=[];
    }
    shouldReload(): boolean {return false;}
    dispose(): void {}
}
export class ModuleCache implements IModuleCache {
    private byURL=new Map<string, Module>;
    private byPath=new Map<string, Module>;
    constructor() {
    }
    [Symbol.iterator](): Iterator<Module> {
        return this.byPath.values();
    }
    add(m:Module) {
        if (m.url) this.byURL.set(m.url, m);
        this.byPath.set(m.path, m);
    }
    delete(m:Module) {
        if (m.url) this.byURL.delete(m.url);
        this.byPath.delete(m.path);
    }
    reload(m:Module){
        if (this.getByPath(m.path)!==m) throw new Error(`${m.path} is not exists in cache or deprecated.`);
        if (m.url) {
            this.byURL.set(m.url, m);
        }
    }
    /*getByFile(f:SFile) {
        return this.getByPath(f.path());
    }*/
    getByPath(path:string, skipCheckReload=false) {
        const e=this.byPath.get(path);
        return skipCheckReload ? e : this.checkReload(e);
    }
    getByURL(url:string, skipCheckReload=false) {
        const e=this.byURL.get(url);
        return skipCheckReload ? e :this.checkReload(e);
    }
    private checkReload(e:Module|undefined) {
        if (e && e.shouldReload()) {
            e.dispose();
            this.delete(e);
            return undefined;
        }
        return e;
    }
}