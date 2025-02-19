import { SFile } from "@hoge1e3/sfile";
import { Aliases, IModuleCache, ModuleValue } from "./types";
import * as FS from "@hoge1e3/fs2";
import { Index, MultiIndexMap } from "./MultiIndexMap";
import { getAliases } from "./alias";
import { ModuleCache, ModuleEntry } from "./Module";

type RequireFunc=(path:string)=>ModuleValue;
type Module={exports:ModuleValue};

/*class CompiledCJSCache extends MultiIndexMap<CompiledCJS> {
    //byURL: Index<string, CompiledCJS>;
    byPath: Index<string, CompiledCJS>;
    constructor() {
        super();
        //this.byURL=this.newIndex((item)=>item.url);
        this.byPath=this.newIndex((item)=>item.entry.file.path());        
    }
    getByFile(f:SFile) {
        const c=this.byPath.get(f.path());
        if (c) {
            if(!c.shouldReload()) return c;
            c.dispose();
            this.delete(c);    
        }
        return undefined;
    }
}
export const compiledCache=new CompiledCJSCache();
*/
/*export class CompiledCJS {
    constructor(
        public entry: ModuleEntry,
        public dependencies: CompiledCJS[],
        public exports: ModuleValue,
        public generatedCode: string,
    ){
    }
    shouldReload():boolean {
        if (this.entry._shouldReload()) return true;
        return this.dependencies.some((dep)=>dep.shouldReload());
    }
    dispose(){
        //URL.revokeObjectURL(this.url);
    }
}*/
export class CJSCompiler {
    static create(): CJSCompiler {
        return new CJSCompiler();
    }
    deps=new Set<Module>();
    //file:SFile;
    //base:SFile;
    aliases: IModuleCache;
    constructor(
    ) {
        //this.file=entry.file;
        //this.base=entry.file.up()!;
        this.aliases=getAliases();
        //if (!this.base) throw new Error(this.file+" cannot create base.");
    }
    requireFunc(base:SFile):RequireFunc {
        return (path:string)=>{
            if (this.aliases.has(path)) {
                return this.aliases.get(path)!.value;
            }
            const e=ModuleEntry.resolve(path,base);
            const c=this.compile(e);
            this.deps.add(c);
            return c.exports;
        }
    }
    requireArguments(file:SFile) {
        const base=file.up()!;
        const require=this.requireFunc(base);
        const exports={} as ModuleValue;
        const module={exports};
        const filename=file.path();
        const dirname=base.path();
        return [require, exports, module, filename, dirname ] as [RequireFunc, ModuleValue, Module, string, string ];
    }
    compile(entry: ModuleEntry):CompiledCJS {
        const file=entry.file;
        let c=compiledCache.getByFile(file);
        if (c) {
            return c;
        }
        const sourceURL=`//# sourceURL=file://${file.path()}`;
        const funcSrc=entry.sourceCode+"\n"+sourceURL;
        const func=new Function("require", "exports","module","__filename", "__dirname", funcSrc);
        const args=this.requireArguments(file);
        func(...args);
        const module=args[2];
        const compiled=new CompiledCJS( entry, [...this.deps], module.exports, funcSrc);
        compiledCache.add(compiled);
        return compiled;
    }
    
}

export function require(path:string):ModuleValue;
export function require(file:SFile):ModuleValue;
export function require(path:string, base:SFile):ModuleValue;
export function require(path:string, base:string):ModuleValue;
export function require(porf:string|SFile, base?:SFile|string):ModuleValue {
    const path=(typeof porf==="string"? porf: porf.path());
    let fbase:SFile;
    if (!base) {
        if (!path.startsWith("/")) {
            throw new Error("Path must be absolute");
        }
        fbase=FS.get(path).up()!; 
    } else if (typeof base=="string") {
        if (!base.startsWith("/")) {
            throw new Error("Base must be absolute");
        }
        fbase=FS.get(base);        
    } else {
        fbase=base;
    }
    return new CJSCompiler().compile(ModuleEntry.resolve(path,fbase)).exports;
}
