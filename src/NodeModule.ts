import { SFile } from "@hoge1e3/sfile";
import * as FS from "@hoge1e3/fs2";
const node_modules="node_modules/";
const package_json="package.json";
type PackageJson={
    main:string,
    type?:"module"|"commonJS",
}
export class NodeModule {
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
        const p=this.packageJsonFile();
        let o=this.packageJson();
        return p.sibling(o.main);
    }
    static isESModule(jsfile:SFile) {
        if (jsfile.ext()===".mjs") return true;
        if (jsfile.ext()===".cjs") return false;
        const m=this.resolveFromParent(jsfile);
        if (!m) {return jsfile.ext()===".mjs";}
        return m.packageJson().type==="module";
    }
    static resolveFromParent(base:SFile) {
        const pkg=base.closest("package.json");
        if (!pkg) return undefined;
        return new NodeModule(pkg.up()!);
    }
    static resolve(name:string,base:SFile):NodeModule {
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

