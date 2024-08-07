import { loadScriptTag, jsToBlobURL } from "./scriptTag";
declare let window:any;
export async function initModuleGlobal(){ 
    const sym_gbl=("_"+Math.random()).replace(/\./,"");
    const jsCodeString=`
const gbl={
    rawImport(url){
        return import(url);
    }
};
globalThis["${sym_gbl}"]=gbl;
export default gbl;
`;
    let blobUrl = jsToBlobURL(jsCodeString);
    await loadScriptTag(blobUrl,{type:"module"});
    let gbl=window[sym_gbl];
    delete window[sym_gbl];
    /*gbl.hooks={};
    for (let k in aliases) {
        addAlias(k, aliases[k]);
    }*/
    return {value: gbl, url: blobUrl};
}
