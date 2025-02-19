import { uniqueName, valueToESCode } from "./ESModuleGenerator";
import { jsToBlobURL } from "./scriptTag";
import { Aliases, ModuleValue } from "./types";
import { GlobalValue, GlobalInfo } from "./types";

let gbl_info:GlobalInfo;
export function getAliases(){
    return gbl_info.value.aliases;
}
export function addAliases(p:Aliases){
    for (let [path, alias] of p) {
        addAlias(path, alias.value);
    }
}
export function addAlias(path:string, value:ModuleValue, properties?:string[]) {
    const ginf=getGlobalInfo();
    const keys=properties||Object.keys(value as any);
    const ginfName=uniqueName(keys);
    const valueName=uniqueName([...keys,ginfName]);
    const jsCodeString=`
import ${ginfName} from "${ginf.url}";
let ${valueName}=${ginfName}.aliases.get("${path}").value;
${valueToESCode(valueName, value, keys)}
`;
    let blobUrl = jsToBlobURL(jsCodeString);
    ginf.value.aliases.set(path,{
        path,
        url:blobUrl,
        value,
    });
}
export function getGlobalInfo(){
    return gbl_info;
}
export async function initModuleGlobal():Promise<GlobalInfo>{ 
    const jsCodeString=`
const gbl={
    rawImport(url){
        return import(url);
    },
    aliases:new Map(),
};
export default gbl;
`;
    let blobUrl = jsToBlobURL(jsCodeString);
    const gbl=(
        await import(/* webpackIgnore: true */blobUrl)
    ).default as GlobalValue;
    gbl_info={value: gbl, url: blobUrl};
    return gbl_info;
}
