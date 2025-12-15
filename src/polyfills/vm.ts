type RunOptions={
    filename:string
};
type Context={
    bindings:object|undefined;
    options:object|undefined;
}
export function runInThisContext(src:string, opt?:RunOptions){
    if (opt?.filename) src+=`\n//# sourceURL=${opt.filename}`;
    return globalThis.eval(src);
}
					
export function createContext(bindings:object|undefined,options?:RunOptions):Context{
    return {bindings, options};
}
export function runInContext(src:string, ctx:Context) {
    let buf="";
    if (ctx.bindings) {
        const uniq=`_${(Math.random()+"").substring(2)}`;
        const g=globalThis as any;
        g[uniq]=ctx.bindings;
        buf+=`let {${Object.keys(ctx.bindings).join(",")}}=globalThis.${uniq};\n`;
        // current implementaion cannot get modified bindings back.
        buf+=`delete globalThis.${uniq};\n`;
    }
    buf+=src;
    //buf+=``
    return globalThis.eval(buf);
}