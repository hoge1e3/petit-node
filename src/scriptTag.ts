
export function jsToBlobURL(jsCodeString:string):string{
    const blob=new Blob(
        [jsCodeString],
        { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}
