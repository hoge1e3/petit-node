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
export class ESModuleEntry {
    compiled: CompiledESModule|undefined;
    compilationListeners: CompilationListener[]|undefined;  
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
    async compile():Promise<CompiledESModule> {
        if (this.compiled) return this.compiled;
        if (this.compilationListeners) {
            const listeners=this.compilationListeners;
            return new Promise((s)=>listeners.push(s));
        }
        this.compilationListeners=[];
        const deps=[] as CompiledESModule[];
        const base=this.file.up();
        const urlConverter={
            conv: async(path:string):Promise<string>=>{
                if (aliases[path]) {
                    return aliases[path].url;
                }
                const e=ESModuleEntry.resolve(path,base);
                const c=await e.compile();
                deps.push(c);
                return c.url;
            },
            deps
        };
        this.compiled=await convert(this, urlConverter);
        compiledCache.add(this.compiled);
        for (let f of this.compilationListeners) f(this.compiled);
        delete this.compilationListeners;
        return this.compiled;
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

