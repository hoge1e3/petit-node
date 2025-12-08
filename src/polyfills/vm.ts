type RunOptions={
    filename:string
};
export function runInThisContext(src:string, opt?:RunOptions){
    if (opt?.filename) src+=`\n//# sourceURL=${opt.filename}`;
    return globalThis.eval(src);
}
					