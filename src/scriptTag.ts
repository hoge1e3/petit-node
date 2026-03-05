import { ScriptingContext } from "../types";

export function jsToBlobURL(ctx: ScriptingContext,jsCodeString:string):string{
    const blob=new ctx.Blob(
        [jsCodeString],
        { type: 'application/javascript' });
    return ctx.URL.createObjectURL(blob);
}
