import type { ScriptingContext } from "../types/index.js";

export function jsToBlobURL(ctx: ScriptingContext,jsCodeString:string):string{
    const blob=new ctx.Blob(
        [jsCodeString],
        { type: 'application/javascript' });
    return ctx.URL.createObjectURL(blob);
}
