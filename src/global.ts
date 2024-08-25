import { jsToBlobURL } from "./scriptTag";
declare let globalThis:any;
declare let document:any;
export async function initModuleGlobal(){ 
    //const sym_gbl=("_"+Math.random()).replace(/\./,"");
    const jsCodeString=`
const gbl={
    rawImport(url){
        return import(url);
    }
};
export default gbl;
`;
//globalThis["${sym_gbl}"]=gbl;
    let blobUrl = jsToBlobURL(jsCodeString);
    const gbl=(
        await import(/* webpackIgnore: true */blobUrl)
    ).default;

    /*await loadScriptTag(blobUrl);
    let gbl=globalThis[sym_gbl];
    delete globalThis[sym_gbl];*/
    return {value: gbl, url: blobUrl};
}/*
function loadScriptTag(url:string){
    const script = document.createElement('script');
    script.setAttribute("src",url);
    script.setAttribute("type","module");
    return new Promise((resolve,reject)=>{
        script.addEventListener("load", resolve);
        script.addEventListener("error",reject);
        document.head.appendChild(script);
    });
}*/
