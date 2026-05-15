import { uniqueName, valueToESCode } from "./ESModuleGenerator.js";
//import { , } from "./Module.js";
import { jsToBlobURL } from "./scriptTag.js";
import { AliasHash, CacheKey, IAliases, IModuleCache, Module, ModuleValue, ScriptingContext } from "../types/index.js";
import { GlobalValue, GlobalInfo } from "../types/index.js";
//declare const sym_cacheKey: unique symbol;
export function asFileKey(path: string): CacheKey {
    return `file://${path}` as CacheKey;
}
/*export function asCDNKey(name: string): CacheKey {
    return `cdn://${name}` as CacheKey;
}*/
export function asBuiltinKey(name: string): CacheKey {
    return `builtin://${name}` as CacheKey;
}
export function bodyOfKey(key: CacheKey):string {
    return key.replace(/^\w+:\/\//,"");
}
//let gbl_info:GlobalInfo;
export class Aliases implements IAliases{
gbl_info:GlobalInfo|undefined;
scriptingContext:ScriptingContext;
constructor(ctx:ScriptingContext){
    this.scriptingContext=ctx;
}
get cache():IModuleCache{
    return this.getAliases();
}
getAliases():IModuleCache{
    return this.getGlobalInfo().value.aliases;
}
loadedModules() {
    return this.getAliases();
}
addAliases(p:AliasHash){
    for (let k in p) {
        this.addAlias(k, p[k]);
    }
}
addURL(cjsModule:Module/*, properties?:string[]*/) {
    const ginf=this.getGlobalInfo();
    const value=cjsModule.value;
    if (value==null) throw new Error("Value is not set: "+cjsModule.path);
    if (cjsModule.url!=null) throw new Error("URL is already set: "+cjsModule.path);
    
    //const keys=properties||Object.keys(value as any);
    const ginfName=uniqueName([]/*keys*/);
    const valueName=uniqueName([/*...keys,*/ginfName]);
    const jsCodeString=`
import ${ginfName} from "${ginf.url}";
let ${valueName}=${ginfName}.aliases.getByPath("${cjsModule.path}").value;
export default ${valueName};
//# sourceURL=pnode-alias/${bodyOfKey(cjsModule.path)}
`;
    let blobUrl = jsToBlobURL(this.scriptingContext,jsCodeString);
    cjsModule.url=blobUrl;
    this.getAliases().reload(cjsModule);
    return blobUrl;
}
// name is '@foo/bar', no builtin:// (for compatibilities)
addAlias(name:string, value:ModuleValue, properties?:string[]) {
    const ginf=this.getGlobalInfo();
    const path=asBuiltinKey(name);
    const keys=properties||Object.keys(value as any);
    const ginfName=uniqueName(keys);
    const valueName=uniqueName([...keys,ginfName]);
    const jsCodeString=`
import ${ginfName} from "${ginf.url}";
let ${valueName}=${ginfName}.aliases.getByPath("${path}").value;
${valueToESCode(valueName, value, keys)}
//# sourceURL=pnode-alias/${name}
`;
    let blobUrl = jsToBlobURL(this.scriptingContext, jsCodeString);
    ginf.value.aliases.add(new BuiltinModule(path, value, blobUrl));
}
getGlobalInfo(){
    if (!this.gbl_info) throw new Error("this.gbl_info not set");
    return this.gbl_info;
}
async initModuleGlobal():Promise<GlobalInfo>{ 
    const jsCodeString=`export default {};`;
    const blobUrl = jsToBlobURL(this.scriptingContext, jsCodeString);
    const gbl=(
        await this.scriptingContext.importModule(/* webpackIgnore: true */blobUrl)
    ).default as GlobalValue;
    gbl.aliases=new ModuleCache();
    this.gbl_info={value: gbl, url: blobUrl};
    return this.gbl_info;
}
}

export class ModuleCache implements IModuleCache {
    private byURL=new Map<string, Module>;
    private byPath=new Map<CacheKey, Module>;
    constructor() {
    }
    [Symbol.iterator](): Iterator<Module> {
        return this.byPath.values();
    }
    add(m:Module) {
        if (m.url) this.byURL.set(m.url, m);
        this.byPath.set(m.path, m);
    }
    delete(m:Module) {
        if (m.url) this.byURL.delete(m.url);
        this.byPath.delete(m.path);
    }
    reload(m:Module){
        if (this.getByPath(m.path)!==m) throw new Error(`${m.path} is not exists in cache or deprecated.`);
        if (m.url) {
            this.byURL.set(m.url, m);
        }
    }
    getByPath(path:CacheKey, skipCheckReload=false) {
        const e=this.byPath.get(path);
        return skipCheckReload ? e : this.checkReload(e);
    }
    getByURL(url:string, skipCheckReload=false) {
        const e=this.byURL.get(url);
        return skipCheckReload ? e :this.checkReload(e);
    }
    private checkReload(e:Module|undefined) {
        if (e && e.shouldReload()) {
            e.dispose();
            this.delete(e);
            return undefined;
        }
        return e;
    }
}

export class BuiltinModule implements Module {
    readonly type="Builtin";
    dependencies: Module[];
    //readonly path: CacheKey;
    constructor(public path:CacheKey, public value:ModuleValue, public url:string) {
        //this.path=asBuiltinKey(name);
        this.dependencies=[];
    }
    shouldReload(): boolean {return this.shouldReloadLoop(new Set<Module>());}
    shouldReloadLoop(path: Set<Module>): boolean {return false;}
    dispose(): void {}
}
