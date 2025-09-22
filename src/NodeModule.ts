import { SFile } from "@hoge1e3/sfile";
import * as FS from "@hoge1e3/fs2";
import { FileBasedModuleType } from "./types";
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
    getMain():SFile {
        return this.getEntry();
        /*const p=this.packageJsonFile();
        const o=this.packageJson();
        return p.sibling(o.main||"index.js");*/
    }
    getEntry(path="."): SFile {
        const p=this.packageJsonFile();
        const o=this.packageJson();
        let exp={} as {[key:string]:string};
        if (typeof o.exports==="string") {
            exp={".": o.exports};
        } else if (typeof o.exports==="object") {
            exp=o.exports;
        } else if (o.main) {
            exp={".": o.main};
        } else {
            exp={".": "./index.js"};
        }
        if (exp[path]) return p.sibling(exp[path]);
        return p.sibling(path);
        /*if (!exp[path]) {
            throw new Error(`${p} has no entry '${path}'.`);
        }
        return p.sibling(exp[path]);*/
    }
    moduleType():FileBasedModuleType {
        const o=this.packageJson();
        return o.type==="module"? "ES":"CJS";
    }
    static moduleTypeOfFile(jsfile:SFile):FileBasedModuleType {
        if (jsfile.ext()===".mjs") return "ES";
        if (jsfile.ext()===".cjs") return "CJS";
        const m=this.resolveFromParent(jsfile);
        if (!m) {return jsfile.ext()===".mjs"?"ES":"CJS";}
        return m.moduleType();
    }
    static resolveFromParent(base:SFile) {
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

