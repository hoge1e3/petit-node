import { SFile } from "@hoge1e3/sfile";
import * as FS from "@hoge1e3/fs2";
import { FileBasedModuleType, RawModuleEntry } from "./types";
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
    getMain(wantModuleType:FileBasedModuleType):RawModuleEntry {
        return this.getEntry(wantModuleType);
        /*const p=this.packageJsonFile();
        const o=this.packageJson();
        return p.sibling(o.main||"index.js");*/
    }
    /**
     * package.json の内容から、指定されたサブパスとモジュールタイプに対応する出力ファイルを解決する
     *
     * @param {FileBasedModuleType} wantModuleType - 要求されるモジュールタイプ ("ES" or "CJS")
     * @param {string} subpath - サブパス (例: ".", "./utils")
     * @returns {{ path: string, resolvedType: FileBasedModuleType }} 解決結果
     * @throws {Error} - 定義が見つからない／不正な組み合わせの場合
     */
    resolveExport(wantModuleType:FileBasedModuleType, subpath: string="."):{ path: string, resolvedType: FileBasedModuleType } {
        const packageJson=this.packageJson();
        const exportsField = packageJson.exports as any;
        const defaultType=this.moduleType();
        const getExt=(s:string):".js"|".mjs"|".cjs"=>{
            const m=/\.(m|c)js$/.exec(s.toLowerCase());
            if(!m) return ".js";
            return m[0] as ".mjs"|".cjs";
        };
        const typeByExt=(entry:string)=>{
            const ext=getExt(entry);
            return ext===".js"?defaultType:ext===".mjs"?"ES":"CJS";
        };
        // --- ① exports がある場合 ---
        if (exportsField) {
            const isRootConditional =
                exportsField.import || exportsField.require || typeof exportsField === "string";
            let entry = null;
            // 直下に import/require がある (サブパス省略型)
            if (isRootConditional && (subpath === "." || subpath === "")) {
                entry = exportsField;
            } else {
                entry = exportsField[subpath];
            }
            if (!entry) throw new Error(`${this.dir}: exports にサブパス ${subpath} が定義されていません`);
            // 文字列のみの場合（例: "exports": "./dist/index.js"）
            if (typeof entry === "string") {
                const theType=typeByExt(entry);
                if (wantModuleType==="ES"){
                    if (theType==="ES") {
                        return { path: entry, resolvedType: wantModuleType };
                    } else {
                        return { path: entry, resolvedType: "CJS" };                        
                    }
                } else {
                    if (theType==="CJS") {
                        return { path: entry, resolvedType: wantModuleType };
                    } else {
                        throw new Error(`${this.dir}: CommonJS から ESM(${entry}) を参照できません`);
                    }
                }
            }
            // import / require で条件分岐している場合
            const importEntry =
                entry.import?.default || entry.import || entry["import"];
            const requireEntry =
                entry.require?.default || entry.require || entry["require"];
            if (wantModuleType === "ES") {
                if (importEntry) {
                    return { path: importEntry, resolvedType: "ES" };
                } else if (requireEntry) {
                    // ESM要求 → CJSフォールバック可
                    return { path: requireEntry, resolvedType: "CJS" };
                } else {
                    throw new Error(`${this.dir}: サブパス ${subpath} に対応する esm/cjs 出力がありません`);
                }
            } else if (wantModuleType === "CJS") {
                if (requireEntry) {
                    return { path: requireEntry, resolvedType: "CJS" };
                } else if (importEntry) {
                    throw new Error(`${this.dir}: CommonJS から ESM(${importEntry}) を参照できません`);
                } else {
                    throw new Error(`${this.dir}: サブパス ${subpath} に require/import の定義がありません`);
                }
            } else {
                throw new Error(`${this.dir}: moduleType は "ES" または "CJS" で指定してください`);
            }
        }
        else {// --- ② exports が無く main のみの場合 ---
            if (subpath === "." || subpath === "") {
                subpath=packageJson.main||"./index.js";
            }
            const theType=typeByExt(subpath);
            if (wantModuleType === "ES") {
                if (theType==="ES") {
                    return { path: subpath, resolvedType: "ES" }; 
                } else {
                    return { path: subpath, resolvedType: "CJS" }; // フォールバック
                }
            } else if (wantModuleType === "CJS") {
                if (theType==="CJS") {
                    return { path: subpath, resolvedType: "CJS" };
                }
                throw new Error(`${this.dir}: CommonJS から ESM(${module}) を参照できません`);
            }
            throw new Error(`${this.dir}: Invalid moduleType ${wantModuleType}.`);
        }
    }
    getEntry(wantModuleType:FileBasedModuleType, subpath: string="."):RawModuleEntry {
        const {path, resolvedType}=this.resolveExport(wantModuleType, subpath);
        return {
            file: this.dir.rel(path),
            type: resolvedType,
        }
    }
    /*getEntry(path="."): SFile {
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
    }*/
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

