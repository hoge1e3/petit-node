//import { RawSourceMap, SourceMapConsumer } from "source-map";
import {getAliases } from "./alias";
import { convert } from "./convImport";
import * as FS from "@hoge1e3/fs2";
type SFile=FS.SFile;
import { MultiIndexMap, Index } from "./MultiIndexMap";
import MutablePromise from "mutable-promise";
import { Aliases } from "./types";
const node_modules="node_modules/";
const package_json="package.json";
class ESModuleEntryCache extends MultiIndexMap<ESModuleEntry> {
    byPath: Index<string, ESModuleEntry>;
    constructor() {
        super();
        this.byPath=this.newIndex((item)=>item.file.path());        
    }
    getByFile(f:SFile) {
        return this.byPath.get(f.path());
    }
}
class CompiledESModuleCache extends MultiIndexMap<CompiledESModule> {
    byURL: Index<string, CompiledESModule>;
    byPath: Index<string, CompiledESModule>;
    constructor() {
        super();
        this.byURL=this.newIndex((item)=>item.url);
        this.byPath=this.newIndex((item)=>item.file.path());        
    }
    getByFile(f:SFile) {
        return this.byPath.get(f.path());
    }
}
export const entryCache=new ESModuleEntryCache();
export const compiledCache=new CompiledESModuleCache();
type PackageJson={
    main:string,
}
class DependencyChecker {
    private dependencies: Map<string, Set<string>> = new Map();
    add(dependent: string, dependency: string): void {
        //console.log(dependent, dependency, this.dependencies)
        if (dependent === dependency) {
            throw new Error(`Self-dependency detected: ${dependent} depends on itself.`);
        }
        if (!this.dependencies.has(dependent)) {
            this.dependencies.set(dependent, new Set());
        }
        if (!this.dependencies.has(dependency)) {
            this.dependencies.set(dependency, new Set());
        }
        const circularPath = this.hasCircularDependency([dependent ,dependency]);
        if (circularPath) {
            throw new Error(`Circular dependency detected: ${circularPath.join(" -> ")}`);
        }
        this.dependencies.get(dependent)!.add(dependency);
    }
    private hasCircularDependency(path: string[]): string[] | undefined {
        const start: string=path[0], current: string=path[path.length - 1];
        if (current === start) {
            return path; // Circular path found
        }
        if (!this.dependencies.has(current)) {
            return undefined;
        }
        for (const next of this.dependencies.get(current)!) {
            if (path.includes(next)) return [...path, next]; // Avoid revisiting nodes in the current path
            const newPath = this.hasCircularDependency([...path, next]);
            if (newPath) return newPath;
        }
        return undefined;
    }
}
export class CompiledESModule {
    constructor(
        public entry: ESModuleEntry,
        public dependencies: CompiledESModule[],
        public url: string,
        public generatedCode: string,
    ){
    }
    shouldReload():boolean {
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>dep.shouldReload());
    }
    dispose(){
        URL.revokeObjectURL(this.url);
    }
    get file(){return this.entry.file;}
    get sourceCode(){return this.entry.sourceCode;}
    get timestamp(){return this.entry.timestamp;}
}
type CompiledEvent={
    module: CompiledESModule,
};
type CompileStartEvent={
    entry: ESModuleEntry,
};
type CompilationContext={
    aliases: Aliases,
    depChecker: DependencyChecker,
    oncompilestart?:(e:CompileStartEvent)=>Promise<void>,
    oncompiled?:(e:CompiledEvent)=>Promise<void>,
    oncachehit?:(e:CompileStartEvent)=>Promise<void>,
};
type CompileState={
    type:"init"
}| {
    type:"loading", 
    promise: MutablePromise<CompiledESModule>,
};
export class ESModuleEntry {
    state: CompileState={type:"init"};
    constructor(
        public file: SFile,
        public sourceCode: string,
        public timestamp: number,
        ) {
    }
    _shouldReload():boolean {
        return this.isError()||this.file.lastUpdate()!==this.timestamp;
    }
    enter():CompileState {
        const prev=this.state;
        switch (this.state.type) {
            case "init":
                this.state={
                    type:"loading", promise: new MutablePromise<CompiledESModule>(),
                };
                return prev;
            default:
                return this.state;
        }
    }
    complete(compiled: CompiledESModule) {
        if (this.state.type!=="loading")throw new Error("Illegal state: "+this.state.type);
        this.state.promise.resolve(compiled);
        compiledCache.add(compiled);
        return compiled;
    }
    error(e:Error) {
        if (this.state.type!=="loading")throw new Error("Illegal state: "+this.state.type);
        this.state.promise.reject(e);
        return e;
    }
    isError():boolean{
        return this.state.type==="loading" && this.state.promise.isRejected;
    }
    async compile(_context:Partial<CompilationContext>={}):Promise<CompiledESModule> {
        const context:CompilationContext={
            aliases:getAliases(),
            depChecker:new DependencyChecker(),
        };
        Object.assign(context, _context);
        return await this.compileWith(context);
    }
    async compileWith(context:CompilationContext):Promise<CompiledESModule> {
        const prevState=this.enter();
        const aliases=context.aliases;//getAliases();
        switch(prevState.type) {
            case "loading":
                if (context.oncachehit) await context.oncachehit({entry:this});
                return prevState.promise;
            case "init":
                if (this.state.type!=="loading") throw new Error("Illegal state: "+this.state.type);
        }
        if (context.oncompilestart) await context.oncompilestart({entry:this});
        const deps=[] as CompiledESModule[];
        const base=this.file.up();
        if (!base) throw new Error(this.file+" cannot create base.");
        const urlConverter={
            conv: async(path:string):Promise<string>=>{
                if (aliases[path]) {
                    return aliases[path].url;
                }
                if (path.match(/^https?:/)) {
                    return path;
                }
                const e=ESModuleEntry.resolve(path,base);
                context.depChecker.add(this.file.path(), e.file.path());
                const c=await e.compileWith(context);
                deps.push(c);
                return c.url;
            },
            deps,
        };
        let compiled;
        try {
            compiled=this.complete(await convert(this, urlConverter));
        } catch (e) {
            throw this.error(e as Error);
        }
        if (context?.oncompiled) await context.oncompiled({module:compiled});
        return compiled;
    }
    static fromFile(file:SFile):ESModuleEntry {
        const incache=entryCache.getByFile(file);
        if (incache) {
            const compiled=compiledCache.getByFile(file);
            if (compiled) {
                if (!compiled.shouldReload()) return incache;
                compiledCache.delete(compiled);
                compiled.dispose();
            } else {
                if (!incache._shouldReload()) return incache;
            }
            entryCache.delete(incache);
        }
        const newEntry=new ESModuleEntry(file, file.text(), file.lastUpdate());
        entryCache.add(newEntry);
        return newEntry;
    }
    static resolve(path:string,base:SFile):ESModuleEntry{
        if(path.match(/^\./)){
            return this.fromFile(base.rel(path));
        }else if(path.match(/^\//)){
            return this.fromFile(FS.get(path));
        }else {
            return NodeModule.resolve(path,base).getMain();
        }
    }
}
export class NodeModule {
    constructor(
        public dir:SFile,
    ){}
    getMain():ESModuleEntry{
        const p=this.packageJsonFile();
        let o=this.packageJson();
        return ESModuleEntry.fromFile(p.sibling(o.main));
    }
    packageJsonFile():SFile {
        return this.dir.rel(package_json);
    }
    packageJson():PackageJson {
        return this.packageJsonFile().obj() as PackageJson;
    }
    static resolve(name:string,base:SFile):NodeModule {
        for(let p:SFile|null=base;p;p=p.up()){
            let n=p.rel(node_modules);
            if(n.exists()){
                let p=n.rel(name+"/");
                if(p.exists()){
                    return new NodeModule(p);
                }
            }
        }
        let np=FS.getEnv("NODE_PATH");
        if (np) {
            const nps=np.split(":");
            for(let nnp of nps) {
            let n=FS.get(nnp);
            if (n.exists()) {
                let p=n.rel(name+"/");
                if(p.exists()){
                    return new NodeModule(p);
                }
            }
            }
        }
        throw new Error(`${name} not found from ${base}`);
    }
}

