import { ModuleValue } from "./types";

export const reservedWords={
    "break": 1, "case": 1, "catch": 1, "class": 1, "const": 1, "continue": 1, 
    "debugger": 1, "default": 1, "delete": 1, "do": 1, "else": 1, "export": 1, 
    "extends": 1, "false": 1, "finally": 1, "for": 1, "function": 1, "if": 1, 
    "import": 1, "in": 1, "instanceof": 1, "new": 1, "null": 1, "return": 1, 
    "super": 1, "switch": 1, "this": 1, "throw": 1, "true": 1, "try": 1, 
    "typeof": 1, "var": 1, "void": 1, "while": 1, "with": 1, "yield": 1, 
    "enum": 1, "await": 1, "implements": 1, "interface": 1, "package": 1, 
    "private": 1, "protected": 1, "public": 1, "static": 1, "let": 1
  } as {[key:string]:1};  
export function uniqueName(avoidThem:string[]){
    let theName;
    do {
        theName = "_"+Math.random().toString(36).slice(2);
    } while(avoidThem.includes(theName));
    return theName;
}
function isReservedWord(s:string){
    return reservedWords[s];
}
export function valueToESCode(valueName:string, value:ModuleValue, properties?:string[]) {
    const keys=properties||Object.keys(value as any);
    const bindn="__bind1234__"
    const bind=`const ${bindn}=(f)=>typeof f==="function"? f.bind(${valueName}): f;`
    const jsCodeString=keys.map((key)=>
        key=="default"?
            `export default ${valueName}.default;`:
            `export let ${isReservedWord(key)?`_${key}`:key}=${bindn}(${valueName}.${key});`
        ).join("\n");
    return bind+jsCodeString;
}