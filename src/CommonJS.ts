import { SFile } from "@hoge1e3/sfile";
import { IModuleCache, Module, ModuleValue } from "./types";
import * as FS from "@hoge1e3/fs2";
import { getAliases } from "./alias.js";
import { CompiledCJS, ModuleEntry } from "./Module.js";

type RequireFunc=((path:string)=>ModuleValue)&{deps:Map<string,Module>};
//type Module={exports:ModuleValue};
function wrapException(e:Error, pos:string) {
    const res=new Error("At "+pos+"\n"+e.message);
    res.stack=e.stack;
    (res as any).original=e;
    return res;
}
export class CJSCompiler {
    static create(): CJSCompiler {
        return new CJSCompiler();
    }
    //deps=new Set<CompiledCJS>();
    //file:SFile;
    //base:SFile;
    cache: IModuleCache;
    constructor(
    ) {
        //this.file=entry.file;
        //this.base=entry.file.up()!;
        this.cache=getAliases();
        //if (!this.base) throw new Error(this.file+" cannot create base.");
    }
    requireFunc(base:SFile):RequireFunc {
        const deps=new Map<string, Module>();
        return Object.assign((path:string)=>{
            const module=this.cache.getByPath(path);// [A]
            if (module) {
                if (!module.value) throw new Error(`Cannot import ${path}(seems to be ESM) from ${base}(CJS)`);
                deps.set(path, module);
                return module.value;
            }
            const e=ModuleEntry.resolve("require", path,base);
            const c=this.compile(e);
            deps.set(path, c);
            return c.value;
        }, {deps});
    }
    requireArguments(file:SFile) {
        const base=file.up()!;
        const require=this.requireFunc(base);
        const exports={} as ModuleValue;
        const module={exports};
        const filename=file.path();
        const dirname=base.path();
        return [require, exports, module, filename, dirname ] as 
                [RequireFunc, ModuleValue, {exports:ModuleValue}, string, string ];
    }
    compile(entry: ModuleEntry):CompiledCJS {
      try {
        const file=entry.file;
        let c=this.cache.getByPath(file.path());
        if (c instanceof CompiledCJS) {
            // Why is it needed? Already checked in [A]?
            // Because path in [A] may relative like './baz.js', while file.path() is absolute.
            // So Why not make './baz.js' absolute at [A]?
            // in [A], it may be npm or built-in path like "fs" or "assert". 
            // While here is always file.
            return c;
        }
        const sourceURL=`//# sourceURL=file://${file.path()}`;
        const funcSrc=entry.sourceCode+"\n"+sourceURL;
        const func=new Function("require", "exports","module","__filename", "__dirname", funcSrc);
        const args=this.requireArguments(file);
        func(...args);
        const module=args[2];
        const compiled=new CompiledCJS( entry, args[0].deps, module.exports, funcSrc);
        this.cache.add(compiled);
        return compiled;

      } catch(e){
        throw wrapException(e as any, entry.file.path());
      }
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
    return new CJSCompiler().compile(ModuleEntry.resolve("require", path,fbase)).value;
}
