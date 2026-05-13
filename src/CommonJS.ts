import { SFile } from "@hoge1e3/sfile";
import { IAliases, IModuleCache, Module, ModuleValue, ScriptingContext } from "../types";
import * as FS from "@hoge1e3/fs2";
import { Aliases } from "./alias.js";
import { CompiledCJS, FileBasedModuleEntry } from "./Module.js";
import {ex} from "./errors.js";
import * as espree from 'espree';
import { simple, SimpleVisitors } from "acorn-walk";
type RequireFunc=((path:string)=>ModuleValue)&{
    deps:Map<string,Module>,
    freezeDeps():void,
    resolve(path:string):string,
};
function wrapException(e:Error, pos:string) {
    const res=new Error("At "+pos+"\n"+e.message);
    res.stack=e.stack;
    (res as any).original=e;
    return res;
}
export class CJSCompiler {
    static create(aliases: IAliases): CJSCompiler {
        return new CJSCompiler(aliases);
    }
    aliases: IAliases;
    get cache():IModuleCache{
        return this.aliases.cache;
    }
    get ctx():ScriptingContext {
        return this.aliases.scriptingContext;
    }
    constructor(
        aliases: IAliases
    ) {
        this.aliases=aliases;
    }
    requireFunc(base:SFile):RequireFunc {
        const deps=new Map<string, Module>();
        let depsFrozen=false;
        return Object.assign((path:string)=>{
            const module=this.cache.getByPath(path);// [A]
            if (module) {
                if (!module.value) throw new Error(`Cannot import ${path}(seems to be ESM) from ${base}(CJS)`);
                if (!depsFrozen) deps.set(path, module);
                return module.value;
            }
            const e=FileBasedModuleEntry.resolve("require", path,base);
            const c=this.compile(e);
            //console.log("deps set",path,depsFrozen);
            if (!depsFrozen) deps.set(path, c);
            return c.value;
        }, {
            deps,
            freezeDeps(){
                //console.log("Deps frozen ",base.path());
                depsFrozen=true;
            },
            resolve(path:string):string{
                const e=FileBasedModuleEntry.resolve("require", path,base);
                return e.file.path();
            }
        });
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
    compile(entry: FileBasedModuleEntry):CompiledCJS {
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
        const funcSrc=(
            entry.file.endsWith(".json") ? 
            `module.exports=${entry.sourceCode};`:
            entry.sourceCode)+"\n"+sourceURL;
        const func=new this.ctx.Function("require", "exports","module","__filename", "__dirname", funcSrc);
        const args=this.requireArguments(file);
        const module=args[2];
        const deps=args[0].deps;
        const compiled=new CompiledCJS(
            this.ctx, entry, deps, module.exports, funcSrc);
        this.cache.add(compiled);
        try {
            func(...args);
        }catch(e) {
            throw ex("syntax", e as Error); 
        }
        args[0].freezeDeps();
        compiled.value=(module.exports);
        return compiled;

      } catch(e){
        throw wrapException(e as any, entry.file.path());
      }
    }
    
}

export function require(aliases:IAliases,path:string):ModuleValue;
export function require(aliases:IAliases,file:SFile):ModuleValue;
export function require(aliases:IAliases,path:string, base:SFile):ModuleValue;
export function require(aliases:IAliases,path:string, base:string):ModuleValue;
export function require(aliases:IAliases,porf:string|SFile, base?:SFile|string):ModuleValue {
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
    const entry = FileBasedModuleEntry.resolve("require", path, fbase);
    return new CJSCompiler(aliases).compile(entry).value;
}

export async function guessDependencies(entry: FileBasedModuleEntry):Promise<Set<FileBasedModuleEntry>> {
    const file=entry.file;
    const base=file.up()!;
    // parse using esprima and extract require("string-literal")
    // and get ModuleEntry using ModuleEntry.resolve("require", path,base);
    const source=await file.async().text();
    const ast=espree.parse(source);
    const deps:Set<FileBasedModuleEntry>=new Set();
    const visitors: SimpleVisitors<unknown> = {
        CallExpression(node) {
            if (node.callee.type==="Identifier" && node.callee.name==="require") {
                const arg=node.arguments[0];
                if (arg && arg.type==="Literal" && typeof arg.value==="string") {
                    deps.add(FileBasedModuleEntry.resolve("require", arg.value, base));
                }
            }
        }
    };
    simple(ast, visitors);
    return deps;
}