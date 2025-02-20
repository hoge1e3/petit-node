//import { RawSourceMap, SourceMapConsumer } from "source-map";
import {addURL, getAliases } from "./alias";
import { convert } from "./convImport";
//type SFile=FS.SFile;
import { Aliases, Module } from "./types";
import { CompiledESModule, ModuleEntry } from "./Module";
import { CJSCompiler } from "./CommonJS";

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
    cjsCompiler?: CJSCompiler;
    constructor(
        public aliases: Aliases,
        public oncompilestart?:(e:CompileStartEvent)=>Promise<void>,
        public oncompiled?:(e:CompiledEvent)=>Promise<void>,
        public oncachehit?:(e:CompileStartEvent)=>Promise<void>){
    }
    static create(context:Partial<ESModuleCompiler>={}):ESModuleCompiler {
        return new ESModuleCompiler(context.aliases||getAliases(), context.oncompilestart, context.oncompiled, context.oncachehit);
    }
    getCJSCompiler():CJSCompiler {
        this.cjsCompiler=this.cjsCompiler||new CJSCompiler();
        return this.cjsCompiler;
    }
    async compile(entry:ModuleEntry):Promise<CompiledESModule> {
        const path=entry.file.path();
        const incache=getAliases().getByPath(path);
        if(incache instanceof CompiledESModule) {
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
        const deps=[] as Module[];
        const base=entry.file.up();
        if (!base) throw new Error(entry.file+" cannot create base.");
        const urlConverter={
            conv: async(path:string):Promise<string>=>{
                const m=aliases.getByPath(path);
                if (m?.url) {
                    //const a=aliases.get(path)!;
                    deps.push(m);
                    return m.url;
                }
                if (path.match(/^https?:/)) {
                    return path;
                }
                const e=ModuleEntry.resolve(path,base);
                this.depChecker.add(entry.file.path(), e.file.path());
                let c,url;
                if(e.moduleType()==="CJS") {
                    c=this.getCJSCompiler().compile(e);
                    url=addURL(c);
                }else{
                    c=await this.compile(e);
                    url=c.url;
                }
                deps.push(c);
                return url;
            },
            deps,
        };
        const compiled=(await convert(entry, urlConverter));
        if (this?.oncompiled) await this.oncompiled({module:compiled});
        aliases.add(compiled);
        return compiled;
    }

};

export function traceInvalidImport(original:Error, start:CompiledESModule) {
    let targetURL:string|null=null;
    for (let e of getAliases()) {
        const url=e.url;
        if (!url) continue;
        const idx=original.message.indexOf(url);
        if (idx>=0) {
            targetURL=url;
            original.message=original.message.substring(0,idx)+
                e.path+
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