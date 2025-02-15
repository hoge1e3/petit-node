import { jsToBlobURL } from "./scriptTag";
import { Aliases, ModuleValue } from "./types";
import { GlobalValue, GlobalInfo } from "./types";

let gbl_info:GlobalInfo;
export function getAliases(){
    return gbl_info.value.aliases;
}
export function addAliases(p:Aliases){
    for (let k in p) {
        addAlias(k, p[k]);
    }
}
const reservedWords={
    "break": 1, "case": 1, "catch": 1, "class": 1, "const": 1, "continue": 1, 
    "debugger": 1, "default": 1, "delete": 1, "do": 1, "else": 1, "export": 1, 
    "extends": 1, "false": 1, "finally": 1, "for": 1, "function": 1, "if": 1, 
    "import": 1, "in": 1, "instanceof": 1, "new": 1, "null": 1, "return": 1, 
    "super": 1, "switch": 1, "this": 1, "throw": 1, "true": 1, "try": 1, 
    "typeof": 1, "var": 1, "void": 1, "while": 1, "with": 1, "yield": 1, 
    "enum": 1, "await": 1, "implements": 1, "interface": 1, "package": 1, 
    "private": 1, "protected": 1, "public": 1, "static": 1, "let": 1
  } as {[key:string]:1};  
function isReservedWord(s:string){
    return reservedWords[s];
}
function uniqueName(avoidThem:string[]){
    let theName;
    do {
        theName = "_"+Math.random().toString(36).slice(2);
    } while(avoidThem.includes(theName));
    return theName;
}
export function addAlias(path:string, value:ModuleValue) {
    const ginf=getGlobalInfo();
    const keys=Object.keys(value as any);
    const ginfName=uniqueName(keys);
    const valueName=uniqueName([...keys,ginfName]);
    const jsCodeString=`
import ${ginfName} from "${ginf.url}";
let ${valueName}=${ginfName}.aliases["${path}"].value;
${keys.map((key)=>
    key=="default"?
`export default ${valueName}.default;`:
`export let ${isReservedWord(key)?`_${key}`:key}=${valueName}.${key};`
    ).join("\n")}
`;
    let blobUrl = jsToBlobURL(jsCodeString);
    ginf.value.aliases[path]={
        path,
        url:blobUrl,
        value,
    };
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
    aliases:{},
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
