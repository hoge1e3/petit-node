import { uniqueName, valueToESCode } from "./ESModuleGenerator";
import { BuiltinModule, ModuleCache } from "./Module";
import { jsToBlobURL } from "./scriptTag";
import { Aliases, AliasHash, Module, ModuleValue } from "./types";
import { GlobalValue, GlobalInfo } from "./types";

let gbl_info:GlobalInfo;
export function getAliases(){
    return gbl_info.value.aliases;
}
export function loadedModules() {
    return getAliases();
}
export function addAliases(p:AliasHash){
    for (let k in p) {
        addAlias(k, p[k]);
    }
}
export function addURL(module:Module, properties?:string[]) {
    const ginf=getGlobalInfo();
    const value=module.value;
    if (value==null) throw new Error("Value is not set: "+module.path);
    if (module.url!=null) throw new Error("URL is already set: "+module.path);
    const keys=properties||Object.keys(value as any);
    const ginfName=uniqueName(keys);
    const valueName=uniqueName([...keys,ginfName]);
    const jsCodeString=`
import ${ginfName} from "${ginf.url}";
let ${valueName}=${ginfName}.aliases.getByPath("${module.path}").value;
${valueToESCode(valueName, value, keys)}
`;
    let blobUrl = jsToBlobURL(jsCodeString);
    module.url=blobUrl;
    getAliases().reload(module);
    return blobUrl;
}
export function addAlias(path:string, value:ModuleValue, properties?:string[]) {
    const ginf=getGlobalInfo();
    const keys=properties||Object.keys(value as any);
    const ginfName=uniqueName(keys);
    const valueName=uniqueName([...keys,ginfName]);
    const jsCodeString=`
import ${ginfName} from "${ginf.url}";
let ${valueName}=${ginfName}.aliases.getByPath("${path}").value;
${valueToESCode(valueName, value, keys)}
`;
    let blobUrl = jsToBlobURL(jsCodeString);
    ginf.value.aliases.add(new BuiltinModule(path, value, blobUrl));
}
export function getGlobalInfo(){
    return gbl_info;
}
export async function initModuleGlobal():Promise<GlobalInfo>{ 
    const jsCodeString=`export default {};`;
    const blobUrl = jsToBlobURL(jsCodeString);
    const gbl=(
        await import(/* webpackIgnore: true */blobUrl)
    ).default as GlobalValue;
    gbl.aliases=new ModuleCache();
    gbl_info={value: gbl, url: blobUrl};
    return gbl_info;
}
