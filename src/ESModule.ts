//import { RawSourceMap, SourceMapConsumer } from "source-map";
import {getAliases } from "./alias";
import { convert } from "./convImport";
import * as FS from "@hoge1e3/fs2";
type SFile=FS.SFile;
import { MultiIndexMap, Index } from "./MultiIndexMap";
import { Alias, Aliases } from "./types";
import { CompiledESModule, Module, ModuleEntry } from "./Module";
export type ESModule=Alias|CompiledESModule;
export function isAlias(e:ESModule): e is Alias {
    return !(e instanceof CompiledESModule);
}
export function getPath(e:ESModule) {
    if (isAlias(e)){return e.path;}
    else {return e.entry.file.path();}
}
class ESModuleCache extends MultiIndexMap<ESModule> {
    private byURL: Index<string, ESModule>;
    private byPath: Index<string, ESModule>;
    constructor() {
        super();
        this.byURL=this.newIndex((item)=>item.url);
        this.byPath=this.newIndex((item)=>getPath(item));        
    }
    getByFile(f:SFile) {
        return this.getByPath(f.path());
    }
    getByPath(path:string) {
        const e=this.byPath.get(path);
        return this.checkReload(e);
    }
    getByURL(url:string) {
        const e=this.byURL.get(url);
        return this.checkReload(e);
    }
    private checkReload(e:ESModule|undefined) {
        if (e && !isAlias(e) && e.shouldReload()) {
            e.dispose();
            this.delete(e);
            return undefined;
        }
        return e;
    }
}
export const cache=new ESModuleCache();

class DependencyChecker {
    private dependencies: Map<string, Set<string>> = new Map();
    add(dependent: string, dependency: string): void {
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
/*export class CompiledESModule {
    constructor(
        public entry: ModuleEntry,
        public dependencies: ESModule[],
        public url: string,
        public generatedCode: string,
    ){
    }
    shouldReload():boolean {
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>!isAlias(dep) && dep.shouldReload());
    }
    dispose(){
        URL.revokeObjectURL(this.url);
    }
}*/
type CompiledEvent={
    module: Module,
};
type CompileStartEvent={
    entry: ModuleEntry,
    byOtherCompiler?: boolean,
};
export class ESModuleCompiler {
    depChecker= new DependencyChecker();
    promiseCache=new Map<string, Promise<CompiledESModule>>();
    constructor(
        public aliases: Aliases,
        public oncompilestart?:(e:CompileStartEvent)=>Promise<void>,
        public oncompiled?:(e:CompiledEvent)=>Promise<void>,
        public oncachehit?:(e:CompileStartEvent)=>Promise<void>){
    }
    static create(context:Partial<ESModuleCompiler>={}):ESModuleCompiler {
        return new ESModuleCompiler(context.aliases||getAliases(), context.oncompilestart, context.oncompiled, context.oncachehit);
    }
    async compile(entry:ModuleEntry):Promise<CompiledESModule> {
        const path=entry.file.path();
        const incache=cache.getByPath(path);
        if(incache && !isAlias(incache)) {
            if (this.oncachehit) await this.oncachehit({entry, byOtherCompiler:true});
            return incache;    
        }
        const pIncache=this.promiseCache.get(path);
        if (pIncache) {
            if (this.oncachehit) await this.oncachehit({entry, byOtherCompiler:false});
            return await pIncache;
        }
        const pr=/* DO NOT await!*/this.compilePromise(entry);
        this.promiseCache.set(path, pr);
        return await pr;
    }
    async compilePromise(entry:ModuleEntry):Promise<CompiledESModule> {
        const aliases=this.aliases;
        if (this.oncompilestart) await this.oncompilestart({entry});
        const deps=[] as ESModule[];
        const base=entry.file.up();
        if (!base) throw new Error(entry.file+" cannot create base.");
        const urlConverter={
            conv: async(path:string):Promise<string>=>{
                if (aliases.has(path)) {
                    const a=aliases.get(path)!;
                    deps.push(a);
                    return a.url;
                }
                if (path.match(/^https?:/)) {
                    return path;
                }
                const e=ModuleEntry.resolve(path,base);
                this.depChecker.add(entry.file.path(), e.file.path());
                const c=await this.compile(e);
                deps.push(c);
                return c.url;
            },
            deps,
        };
        const compiled=(await convert(entry, urlConverter));
        if (this?.oncompiled) await this.oncompiled({module:compiled});
        cache.add(compiled);
        return compiled;
    }

};

export function traceInvalidImport(original:Error, start:CompiledESModule) {
    let targetURL:string|null=null;
    const aliasList=getAliases().values();
    for (let e of [...cache, ...aliasList]) {
        const url=e.url;
        const idx=original.message.indexOf(url);
        if (idx>=0) {
            targetURL=url;
            original.message=original.message.substring(0,idx)+
                getPath(e)+
                original.message.substring(idx+url.length);
            break;
        }
    }
    if (!targetURL) return original;
    const candidates=[] as Module[];
    function findFrom(start:Module) {
        for (let d of start.dependencies) {
            if (d.url==targetURL) {
                candidates.push(start);
                return;
            }
            findFrom(d);
        }
    }
    findFrom(start);
    if (candidates.length==0) return original;
    return new Error(original.message+"\n"+"Check these dependents:\n"+candidates.map((c)=>c.path).join("\n"));
}