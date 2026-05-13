import { SFile } from "@hoge1e3/sfile";
import { NodeModule, pathFallback } from "./NodeModule.js";
import * as FS from "@hoge1e3/fs2";
import { FileBasedModuleType, ICompiledCJS, ICompiledESModule, IModuleCache, IFileBasedModuleEntry, ImportOrRequire, Module, ModuleValue, ScriptingContext } from "../types/";

export class FileBasedModuleEntry implements IFileBasedModuleEntry{
    constructor(
        public file: SFile,
        public sourceCode: string,
        public timestamp: number,
        ) {
    }
    _shouldReload():boolean {
        if (!this.file.exists()) return false;// for preload module
        return /*this.isError()||*/this.file.lastUpdate()!==this.timestamp;
    }
    moduleType():FileBasedModuleType {
        return NodeModule.moduleTypeOfFile(this.file);
    }
    static fromFile(file:SFile, timestamp:number=file.lastUpdate()):FileBasedModuleEntry {
        const newEntry=new FileBasedModuleEntry(file, file.text(), timestamp);
        return newEntry;
    }
    static resolve(wantModuleType:ImportOrRequire,path:string,base:SFile):FileBasedModuleEntry{
        if (path.match(/^[\.\/]/)) {
            let file=path.match(/^\./)?
                base.rel(path):FS.get(path);
            if (wantModuleType==="require") file=pathFallback(file);
            return FileBasedModuleEntry.fromFile(file);
        }else {
            const [main,sub]=NodeModule.parsePath(path);
            return this.fromNodeModule(wantModuleType, NodeModule.resolve(main,base),sub);
        }
    }
    static fromNodeModule(wantModuleType:ImportOrRequire, m:NodeModule, subPath="."):FileBasedModuleEntry {
        const file=m.getEntry(wantModuleType, subPath);
        return FileBasedModuleEntry.fromFile(file);
    }
}

export class CompiledESModule implements ICompiledESModule {
    readonly type="ES";
    public readonly path:string;
    constructor(
        public readonly scriptingContext: ScriptingContext,
        public readonly entry: FileBasedModuleEntry,
        public readonly dependencies: Module[],
        public readonly url: string,
        public readonly generatedCode: string,
    ){
        this.path=entry.file.path();
    }
    shouldReload(): boolean {return this.shouldReloadLoop(new Set<Module>());}
    shouldReloadLoop(path: Set<Module>):boolean {
        if (path.has(this)) return false;
        path.add(this);
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>dep.shouldReloadLoop(path));
    }
    dispose(){
        this.scriptingContext.URL.revokeObjectURL(this.url);
    }
}
export class CompiledCJS implements ICompiledCJS{
    readonly type="CJS";
    public readonly path:string;
    public url:string|undefined;
    constructor(
        public readonly scriptingContext: ScriptingContext,
        public readonly entry: FileBasedModuleEntry,
        public readonly dependencyMap: Map<string, Module>,
        public value: ModuleValue,
        public readonly generatedCode: string,
    ){
        this.path=entry.file.path();
    }
    get dependencies():Module[]{
        return [...this.dependencyMap.values()];
    }
    shouldReload(): boolean {return this.shouldReloadLoop(new Set<Module>());}
    shouldReloadLoop(path:Set<Module>):boolean {
        if (path.has(this)) return false;
        path.add(this);
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>dep.shouldReloadLoop(path));
    }
    dispose(){
        if (this.url) this.scriptingContext.URL.revokeObjectURL(this.url);
    }
}
export class BuiltinModule implements Module {
    readonly type="Builtin";
    dependencies: Module[];
    constructor(public path:string, public value:ModuleValue, public url:string) {
        this.dependencies=[];
    }
    shouldReload(): boolean {return this.shouldReloadLoop(new Set<Module>());}
    shouldReloadLoop(path: Set<Module>): boolean {return false;}
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