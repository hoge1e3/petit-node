import { SFile } from "@hoge1e3/sfile";
import { NodeModule } from "./NodeModule.js";
import * as FS from "@hoge1e3/fs2";
import { FileBasedModuleType, IModuleCache, Module, ModuleValue } from "./types";
export class ModuleEntry {
    constructor(
        public file: SFile,
        public sourceCode: string,
        public timestamp: number,
        ) {
    }
    _shouldReload():boolean {
        return /*this.isError()||*/this.file.lastUpdate()!==this.timestamp;
    }
    moduleType():FileBasedModuleType {
        return NodeModule.moduleTypeOfFile(this.file);
    }
    static fromFile(file:SFile):ModuleEntry {
        const newEntry=new ModuleEntry(file, file.text(), file.lastUpdate());
        return newEntry;
    }
    static resolve(path:string,base:SFile):ModuleEntry{
        if(path.match(/^\./)){
            return this.fromFile(base.rel(path));
        }else if(path.match(/^\//)){
            return this.fromFile(FS.get(path));
        }else {
            return this.fromNodeModule(NodeModule.resolve(path,base));
        }
    }
    static fromNodeModule(m:NodeModule):ModuleEntry {
        return ModuleEntry.fromFile(m.getMain());
    }
}
export interface FileBasedModule extends Module {
    readonly type:FileBasedModuleType;
    entry:ModuleEntry;
}
export class CompiledESModule implements FileBasedModule {
    readonly type="ES";
    public path:string;
    constructor(
        public entry: ModuleEntry,
        public dependencies: Module[],
        public url: string,
        public generatedCode: string,
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
    public path:string;
    public url:string|undefined;
    constructor(
        public entry: ModuleEntry,
        public dependencies: Module[],
        public value: ModuleValue,
        public generatedCode: string,
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
    getByPath(path:string) {
        const e=this.byPath.get(path);
        return this.checkReload(e);
    }
    getByURL(url:string) {
        const e=this.byURL.get(url);
        return this.checkReload(e);
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