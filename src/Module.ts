import { SFile } from "@hoge1e3/sfile";
import { NodeModule, pathFallback } from "./NodeModule.js";
import * as FS from "@hoge1e3/fs2";
import { FileBasedModuleType, ICompiledCJS, ICompiledESModule, IModuleCache, IFileBasedModuleEntry, ImportOrRequire, Module, ModuleValue, ScriptingContext, IModuleEntry, CacheKey, IBuiltinModuleEntry } from "../types/";
import { asBuiltinKey, asFileKey } from "./alias.js";

export function isFileBasedModuleEntry(e:IModuleEntry): e is IFileBasedModuleEntry {
    return (e.moduleType()==="ES"||e.moduleType()==="CJS");
}
export function isBuiltinModuleEntry(e:IModuleEntry): e is IBuiltinModuleEntry {
    return (e.moduleType()==="Builtin");
}
export function resolveModuleEntry(wantModuleType:ImportOrRequire,path:string,base:SFile):IModuleEntry{
    try {
        return FileBasedModuleEntry.resolve(wantModuleType, path, base);
    } catch(e) {
        if (path.match(/^[\.\/]/)) {
            throw new Error(`Module ${path} not found`);
        }
        return new BuiltinModuleEntry(path);
    }
}
export class BuiltinModuleEntry implements IBuiltinModuleEntry {
    constructor(public name: string, 
        public global? :string){}
    cacheKey(): CacheKey {
        return asBuiltinKey(this.name);
    }
    url(): string {
        if (this.global) {
            return `https://cdn.jsdelivr.net/npm/${this.name}`;
        }
        return `https://cdn.jsdelivr.net/npm/${this.name}+esm`;
    }
    moduleType() {
        return "Builtin" as "Builtin";
    }
}
export class FileBasedModuleEntry implements IFileBasedModuleEntry{
    constructor(
        public file: SFile,
        public sourceCode: string,
        public timestamp: number,
        ) {
    }
    cacheKey(): CacheKey {
        return asFileKey(this.file.path());
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
    public readonly path:CacheKey;
    constructor(
        public readonly scriptingContext: ScriptingContext,
        public readonly entry: FileBasedModuleEntry,
        public readonly dependencies: Module[],
        public readonly url: string,
        public readonly generatedCode: string,
    ){
        this.path=asFileKey(entry.file.path());
    }
    shouldReload(): boolean {return this.shouldReloadLoop(new Set<Module>());}
    shouldReloadLoop(visited: Set<Module>):boolean {
        if (visited.has(this)) return false;
        visited.add(this);
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>dep.shouldReloadLoop(visited));
    }
    dispose(){
        this.scriptingContext.URL.revokeObjectURL(this.url);
    }
}
export class CompiledCJS implements ICompiledCJS{
    readonly type="CJS";
    public readonly path:CacheKey;
    public url:string|undefined;
    constructor(
        public readonly scriptingContext: ScriptingContext,
        public readonly entry: FileBasedModuleEntry,
        public readonly dependencyMap: Map<string, Module>,
        public value: ModuleValue,
        public readonly generatedCode: string,
    ){
        this.path=asFileKey(entry.file.path());
    }
    get dependencies():Module[]{
        return [...this.dependencyMap.values()];
    }
    shouldReload(): boolean {return this.shouldReloadLoop(new Set<Module>());}
    shouldReloadLoop(visited:Set<Module>):boolean {
        if (visited.has(this)) return false;
        visited.add(this);
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>dep.shouldReloadLoop(visited));
    }
    dispose(){
        if (this.url) this.scriptingContext.URL.revokeObjectURL(this.url);
    }
}