
export function jsToBlobURL(jsCodeString:string):string{
    const blob=new Blob(
        [jsCodeString],
        { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}
declare let define:any, requirejs:any, document:any;
type AttrList={[key:string]:string};
export function loadScriptTag(url:string,attr:AttrList={}):Promise<any>{
    if ((attr.type!=="module") && typeof define==="function" && define.amd && typeof requirejs==="function") {
        return new Promise((s)=>requirejs([url],(r:any)=>s(r)));
    }
    const script = document.createElement('script');
    script.src = url;
    for(let k in attr){
        script.setAttribute(k,attr[k]);
    }
    return new Promise(
        function (resolve,reject){
            script.addEventListener("load",resolve);
            script.addEventListener("error",reject);
            document.head.appendChild(script);
    });
}