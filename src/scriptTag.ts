
export function jsToBlobURL(jsCodeString:string):string{
    const blob=new Blob(
        [jsCodeString],
        { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}
declare let define:any, requirejs:any, document:any;
type AttrList={[key:string]:string};
