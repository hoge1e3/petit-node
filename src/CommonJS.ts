import { SFile } from "@hoge1e3/sfile";
import { Aliases, ModuleValue } from "./types";
import { NodeModule } from "./NodeModule";
import { FS } from ".";
import { Index, MultiIndexMap } from "./MultiIndexMap";
import { getAliases } from "./alias";

type RequireFunc=(path:string)=>ModuleValue;
type Module={exports:ModuleValue};

class CompiledCJSCache extends MultiIndexMap<CompiledCJS> {
    //byURL: Index<string, CompiledCJS>;
    byPath: Index<string, CompiledCJS>;
    constructor() {
        super();
        //this.byURL=this.newIndex((item)=>item.url);
        this.byPath=this.newIndex((item)=>item.file.path());        
    }
    getByFile(f:SFile) {
        return this.byPath.get(f.path());
    }
}
export const compiledCache=new CompiledCJSCache();

export class CompiledCJS {
    constructor(
        public entry: CJSEntry,
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
    get file(){return this.entry.file;}
    get sourceCode(){return this.entry.sourceCode;}
    get timestamp(){return this.entry.timestamp;}
}
export class CJSEntry {
    constructor(
        public file: SFile,
        public sourceCode: string,
        public timestamp: number,
        ) {
    }
    _shouldReload():boolean {
        return /*this.isError()||*/this.file.lastUpdate()!==this.timestamp;
    }
    compile():CompiledCJS {
        let c=compiledCache.getByFile(this.file);
        if (c) {
            if(!c.shouldReload()) return c;
            c.dispose();
            compiledCache.delete(c);
        }
        c=new CJSCompiler(this).compile();
        compiledCache.add(c);
        return c;
    }
    static fromFile(file:SFile):CJSEntry {
        const newEntry=new CJSEntry(file, file.text(), file.lastUpdate());
        return newEntry;
    }
    static resolve(path:string,base:SFile):CJSEntry{
        if(path.match(/^\./)){
            return this.fromFile(base.rel(path));
        }else if(path.match(/^\//)){
            return this.fromFile(FS.get(path));
        }else {
            return this.fromNodeModule(NodeModule.resolve(path,base));
        }
    }
    static fromNodeModule(m:NodeModule):CJSEntry {
        return CJSEntry.fromFile(m.getMain());
    }
}
export class CJSCompiler {
    deps=new Set<CompiledCJS>();
    file:SFile;
    base:SFile;
    alias: Aliases;
    constructor(
        public entry: CJSEntry,
    ) {
        this.file=entry.file;
        this.base=entry.file.up()!;
        this.alias=getAliases();
        if (!this.base) throw new Error(this.file+" cannot create base.");
    }
    requireFunc():RequireFunc {
        return (path:string)=>{
            if (this.alias[path]) {
                return this.alias[path].value;
            }
            const e=CJSEntry.resolve(path,this.base);
            const c=e.compile();
            this.deps.add(c);
            return c.exports;
        }
    }
    requireArguments() {
        const file=this.file;
        const base=this.base;
        const require=this.requireFunc();
        const exports={} as ModuleValue;
        const module={exports};
        const filename=file.path();
        const dirname=base.path();
        return [require, exports, module, filename, dirname ] as [RequireFunc, ModuleValue, Module, string, string ];
    }
    compile():CompiledCJS {
        const file=this.file;
        const sourceURL=`//# sourceURL=file://${file.path()}`;
        const funcSrc=this.entry.sourceCode+"\n"+sourceURL;
        const func=new Function("require", "exports","module","__filename", "__dirname", funcSrc);
        const args=this.requireArguments();
        func(...args);
        const module=args[2];
        return new CompiledCJS( this.entry, [...this.deps], module.exports, funcSrc);
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
    return CJSEntry.resolve(path,fbase).compile().exports;
}
