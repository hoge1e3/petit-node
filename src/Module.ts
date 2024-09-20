//import { RawSourceMap, SourceMapConsumer } from "source-map";
import {aliases } from "./alias";
import { convert } from "./convImport";
import FS from "@hoge1e3/fs";
import { MultiIndexMap, Index } from "./MultiIndexMap";

const node_modules="node_modules/";
const package_json="package.json";
class ESModuleCache extends MultiIndexMap<ESModule> {
    byURL: Index<string, ESModule>;
    byPath: Index<string, ESModule>;
    constructor() {
        super();
        this.byURL=this.newIndex((item)=>item.url);
        this.byPath=this.newIndex((item)=>item.file.path());        
    }
    getByFile(f:SFile) {
        return this.byPath.get(f.path());
    }
}
export const cache=new ESModuleCache();
type PackageJson={
    main:string,
}
export class ESModule {
    constructor(
        public file: SFile,
        public sourceCode: string,
        public timestamp: number,
        public dependencies: ESModule[],
        public url: string,
        public generatedCode: string,
        //public sourceMap: RawSourceMap
        ) {

    }
    shouldReload():boolean {
        if (this.file.lastUpdate()!==this.timestamp) return true;
        return this.dependencies.some((dep)=>dep.shouldReload());
    }
    static fromFile(file:SFile):ESModule {
        const incache=cache.getByFile(file);
        if (incache && !incache.shouldReload()) return incache;
        if (incache) cache.delete(incache);
        const deps=[] as ESModule[];
        const base=file.up();
        const urlConverter={
            conv: (path:string):string=>{
                if (aliases[path]) {
                    return aliases[path].url;
                }
                let d=ESModule.resolve(path,base);
                deps.push(d);
                return d.url;
            },
            deps
        };
        const newMod=convert(file, urlConverter);
        cache.add(newMod);
        return newMod;
    }
    static resolve(path:string,base:SFile):ESModule{
        if(path.match(/^\./)){
            return this.fromFile(base.rel(path));
        }else if(path.match(/^\//)){
            return this.fromFile(FS.get(path));
        }else {
            return NodeModule.resolve(path,base).getMain();
        }
    }
}
export class NodeModule {
    constructor(
        public dir:SFile,
    ){}
    getMain():ESModule{
        const p=this.packageJsonFile();
        let o=this.packageJson();
        return ESModule.fromFile(p.sibling(o.main));
    }
    packageJsonFile():SFile {
        return this.dir.rel(package_json);
    }
    packageJson():PackageJson {
        return this.packageJsonFile().obj() as PackageJson;
    }
    static resolve(name:string,base:SFile):NodeModule {
        for(let p=base;p;p=p.up()){
            let n=p.rel(node_modules);
            if(n.exists()){
                let p=n.rel(name+"/");
                if(p.exists()){
                    return new NodeModule(p);
                }
            }
        }
        throw new Error(`${name} not found from ${base}`);
    }
}

