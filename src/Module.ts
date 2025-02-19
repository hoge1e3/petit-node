import { SFile } from "@hoge1e3/sfile";
import { NodeModule } from "./NodeModule";
import * as FS from "@hoge1e3/fs2";
export class ModuleEntry {
    constructor(
        public file: SFile,
        public sourceCode: string,
        public timestamp: number,
        ) {
    }
    _shouldReload():boolean {
        return /*this.isError()||*/this.file.lastUpdate()!==this.timestamp;
    }
    static fromFile(file:SFile):ModuleEntry {
        const newEntry=new ModuleEntry(file, file.text(), file.lastUpdate());
        return newEntry;
    }
    static resolve(path:string,base:SFile):ModuleEntry{
        if(path.match(/^\./)){
            return this.fromFile(base.rel(path));
        }else if(path.match(/^\//)){
            return this.fromFile(FS.get(path));
        }else {
            return this.fromNodeModule(NodeModule.resolve(path,base));
        }
    }
    static fromNodeModule(m:NodeModule):ModuleEntry {
        return ModuleEntry.fromFile(m.getMain());
    }
}