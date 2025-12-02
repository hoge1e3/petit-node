import { SFile } from "@hoge1e3/sfile";
import * as FS from "@hoge1e3/fs2";
import { FileBasedModuleType, ImportOrRequire } from "./types";
import * as rex from "resolve.exports";
import { ex } from "./errors.js";
const node_modules="node_modules/";
const package_json="package.json";
type PackageJson={
    main?:string,
    exports?: string|{[key: string]:string},
    type?:"module"|"commonJS",
}
export class NodeModule {
    static parsePath(path:string):[string,string] {
        /*
        "a"      -> ["a","."]
         "@a/b"  -> ["@a/b", "."]
        "a/b"    -> ["a","./b"]
        "a/b/c"  -> ["a","./b/c"]
        "@a/b/c" -> ["@a/b", "./c"]
        */
        const parts=path.split("/");
        const {pkg,sub}=((l:number)=>({
            pkg:parts.slice(0, l).join("/"),
            sub:parts.slice(l).join("/"),
        }))(parts[0].startsWith("@")?2:1);
        return [pkg, sub==="" ? "." : `./${sub}`];
    }
    constructor(
        public dir:SFile,
    ){}
    packageJsonFile():SFile {
        return this.dir.rel(package_json);
    }
    packageJson():PackageJson {
        return this.packageJsonFile().obj() as PackageJson;
    }
    getMain(wantModuleType:ImportOrRequire):SFile {
        return this.getEntry(wantModuleType);
        /*const p=this.packageJsonFile();
        const o=this.packageJson();
        return p.sibling(o.main||"index.js");*/
    }
    getEntry(wantModuleType:ImportOrRequire, subpath: string="."):SFile {
        if (wantModuleType==="require") {
            return this.resolveRequire(subpath);
        } else {
            return this.resolveImport(subpath);
        }
    }
    moduleType():FileBasedModuleType {
        const o=this.packageJson();
        return o.type==="module"? "ES":"CJS";
    }
    static moduleTypeOfFile(jsfile:SFile):FileBasedModuleType {
        if (jsfile.ext()===".mjs") return "ES";
        if (jsfile.ext()===".cjs") return "CJS";
        const m=NodeModule.closest(jsfile);
        if (!m) {return jsfile.ext()===".mjs"?"ES":"CJS";}
        return m.moduleType();
    }
    static resolveFromParent(base:SFile) {
        return NodeModule.closest(base);
    }
    static closest(base:SFile) {
        const pkg=base.closest((f:SFile)=>f.rel("package.json").exists());
        if (!pkg) return undefined;
        return new NodeModule(pkg);
    }
    static resolve(name:string,base:SFile):NodeModule {
        base=base.resolveLink();
        for(let p:SFile|null=base;p;p=p.up()){
            let n=p.rel(node_modules);
            if(n.exists()){
                let p=n.rel(name+"/");
                if(p.exists()){
                    return new NodeModule(p);
                }
            }
        }
        let np=process.env.NODE_PATH;
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
        throw ex({type:"notfound", name, base},
            `Module '${name}' not found from '${base}'`);
    }

    resolveImportRaw(path="."):rex.Exports.Output[0]|undefined{
        try {
            const pkg=this.packageJson();
            const r=rex.exports(pkg, path);
            if (r) return r[0];
        } catch(e){
        }
    }
    resolveRequireRaw(path="."):rex.Exports.Output[0]|undefined{
        try {
            const pkg=this.packageJson();
            const r=rex.exports(pkg, path, {require:true});
            if (r) return r[0];
        } catch(e){
        }
    }
    resolveLegacy(){
        try {
            const pkg=this.packageJson();
            return rex.legacy(pkg,{browser:false,fields:["main"]});
        } catch(e){
        }
    }
    resolveImport(subpath="."):SFile {
        const e=this.resolveImportRaw(subpath)||this.resolveLegacy()||subpath;
        const f=pathFallback(this.dir.rel(e));
        return f;
        /*if (NodeModule.moduleTypeOfFile(f)==="ES") return {file: f, type:"ES"};
        return this.resolveRequire(subpath);*/
    }
    resolveRequire(subpath="."):SFile {
        const c=this.resolveRequireRaw(subpath)||this.resolveLegacy()||subpath;
        const f=pathFallback(this.dir.rel(c));
        return f;
    }
}
export function pathFallback(p:SFile):SFile {
  for (let attempt of [
    ()=>p, 
    ()=>!p.isDir() && p.sibling(p.name()+".js"),
    ()=>p.isDir() && p.rel("index.js"),
    ]){
    try {
        const f=attempt();
        if (f&&f.exists()&&!f.isDir()) return f; 
    } catch(_e){}
  }
  throw ex({type:"notfound", path:p.path()},
    `Cannot fallback: '${p}' is not existent.`);
}


