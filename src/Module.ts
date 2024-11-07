//import { RawSourceMap, SourceMapConsumer } from "source-map";
import {aliases } from "./alias";
import { convert } from "./convImport";
import FS from "@hoge1e3/fs";
import { MultiIndexMap, Index } from "./MultiIndexMap";

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
export class CompiledESModule {
    constructor(
        public entry: ESModuleEntry,
        public dependencies: CompiledESModule[],
        public url: string,
        public generatedCode: string,
    ){
    }
    shouldReload():boolean {
        if (this.entry.shouldReload(true)) return true;
        return this.dependencies.some((dep)=>dep.shouldReload());
    }
    dispose(){
        URL.revokeObjectURL(this.url);
    }
    get file(){return this.entry.file;}
    get sourceCode(){return this.entry.sourceCode;}
    get timestamp(){return this.entry.timestamp;}
}
type CompilationListener=(r:CompiledESModule)=>void;
type CompiledEvent={
    module: CompiledESModule,
};
type CompileStartEvent={
    entry: ESModuleEntry,
};
type CompilationContext={
    oncompilestart?:(e:CompileStartEvent)=>Promise<void>,
    oncompiled?:(e:CompiledEvent)=>Promise<void>,
    oncachehit?:(e:CompiledEvent)=>Promise<void>,
    onwaitcompiled:(e:CompileStartEvent)=>Promise<void>,
};
type CompileState={
    type:"init"
}| {
    type:"loading", 
    listeners: CompilationListener[],
}| {
    type:"complete",
    module: CompiledESModule,
}| {
    type:"error",
    error: Error,
};
export class ESModuleEntry {
    //compiled: CompiledESModule|undefined;
    //compilationListeners: CompilationListener[]|undefined;  
    state: CompileState={type:"init"};
    constructor(
        public file: SFile,
        public sourceCode: string,
        public timestamp: number,
        ) {
    }
    shouldReload(ignoreCompiled=false):boolean {
        if (this.file.lastUpdate()!==this.timestamp) return true;
        if (!this.compiled || ignoreCompiled) return false;
        return this.compiled.shouldReload();
    }
    dispose(){
        if (!this.compiled) return; 
        this.compiled.dispose();
    }
    get compiled(){
        const state=this.state;
        return state.type==="complete"&&state.module;
    }
    enter():CompileState {
        const prev=this.state;
        switch (this.state.type) {
            case "init":
                this.state={
                    type:"loading", listeners:[],
                };
                return prev;
            default:
                return this.state;
        }
    }
    complete(module: CompiledESModule) {
        if (this.state.type!=="loading")throw new Error("Illegal state: "+this.state.type);
        for (let f of this.state.listeners) f(module);
        this.state={type:"complete",module};
        return module;
    }
    error(e:Error) {
        this.state={type:"error",error:e};
        return e;
    }
    async compile(context?:CompilationContext):Promise<CompiledESModule> {
        const prevState=this.enter();
        switch(prevState.type) {
            case "complete":
                if (context?.oncachehit) await context.oncachehit({module:prevState.module});
                return prevState.module;
            case "loading":
                const listeners=prevState.listeners;
                let succ: ((module:CompiledESModule)=>void)|null;
                let module:CompiledESModule|null;
                listeners.push( (m)=>succ?succ(m):(module=m) );
                const pr:Promise<CompiledESModule>=
                    new Promise((s)=>module?s(module):(succ=s));
                if (context?.onwaitcompiled) await context.onwaitcompiled({entry:this});
                return pr;
            case "error":
                throw prevState.error; 
            case "init":
                if (this.state.type!=="loading") throw new Error("Illegal state: "+this.state.type);
        }
        if (context?.oncompilestart) await context.oncompilestart({entry:this});
        const deps=[] as CompiledESModule[];
        const base=this.file.up();
        const urlConverter={
            conv: async(path:string):Promise<string>=>{
                if (aliases[path]) {
                    return aliases[path].url;
                }
                const e=ESModuleEntry.resolve(path,base);
                const c=await e.compile(context);
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
        compiledCache.add(compiled);
        if (context?.oncompiled) await context.oncompiled({module:compiled});
        return compiled;
    }
    static fromFile(file:SFile):ESModuleEntry {
        const incache=entryCache.getByFile(file);
        if (incache && !incache.shouldReload()) return incache;
        if (incache) {
            entryCache.delete(incache);
            incache.dispose();
        }
        const newMod=new ESModuleEntry(file, file.text(), file.lastUpdate());
        entryCache.add(newMod);
        return newMod;
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
        for(let p=base;p;p=p.up()){
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

