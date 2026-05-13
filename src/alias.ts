import { uniqueName, valueToESCode } from "./ESModuleGenerator.js";
import { BuiltinModule, CompiledCJS, ModuleCache } from "./Module.js";
import { jsToBlobURL } from "./scriptTag.js";
import { AliasHash, CacheKey, IAliases, IModuleCache, ModuleValue, ScriptingContext } from "../types/index.js";
import { GlobalValue, GlobalInfo } from "../types/index.js";
//declare const sym_cacheKey: unique symbol;
export function asFileKey(path: string): CacheKey {
    return `file://${path}` as CacheKey;
}
export function asCDNKey(name: string): CacheKey {
    return `cdn://${name}` as CacheKey;
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
addURL(module:CompiledCJS/*, properties?:string[]*/) {
    const ginf=this.getGlobalInfo();
    const value=module.value;
    if (value==null) throw new Error("Value is not set: "+module.path);
    if (module.url!=null) throw new Error("URL is already set: "+module.path);
    
    //const keys=properties||Object.keys(value as any);
    const ginfName=uniqueName([]/*keys*/);
    const valueName=uniqueName([/*...keys,*/ginfName]);
    const jsCodeString=`
import ${ginfName} from "${ginf.url}";
let ${valueName}=${ginfName}.aliases.getByPath("${module.path}").value;
export default ${valueName};
//# sourceURL=pnode-alias/${module.path}
`;
    let blobUrl = jsToBlobURL(this.scriptingContext,jsCodeString);
    module.url=blobUrl;
    this.getAliases().reload(module);
    return blobUrl;
}
addAlias(path:string, value:ModuleValue, properties?:string[]) {
    const ginf=this.getGlobalInfo();
    const keys=properties||Object.keys(value as any);
    const ginfName=uniqueName(keys);
    const valueName=uniqueName([...keys,ginfName]);
    const jsCodeString=`
import ${ginfName} from "${ginf.url}";
let ${valueName}=${ginfName}.aliases.getByPath("${path}").value;
${valueToESCode(valueName, value, keys)}
//# sourceURL=pnode-alias/${path}
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