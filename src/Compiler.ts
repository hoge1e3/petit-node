import { CJSCompiler } from "./CommonJS";
import { ESModuleCompiler } from "./ESModule";
import { ModuleEntry } from "./Module";
import { NodeModule } from "./NodeModule";

export type Complier=ESModuleCompiler|CJSCompiler;
export function compilerFor(e:ModuleEntry):Complier {
    const file=e.file;
    if (NodeModule.isESModule(file)) {
        return ESModuleCompiler.create();
    } else {
        return CJSCompiler.create();
    }
}