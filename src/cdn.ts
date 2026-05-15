import { IAliases, IBuiltinModuleEntry } from "../types";
import { BuiltinModule } from "./alias.js";



const g:any=globalThis;
/*
export function createCDNModule(e:INPMEntry, modval:ModuleValue) {
    const name=e.name;
    const url=e.url();
    const module:CDNModule={
        entry:e,
        type:"CDN",
        path: asCDNKey(name),
        value:modval,
        url,
        dependencies:[],
        shouldReload() {
            return false;
        },
        shouldReloadLoop(path: Set<Module>) {
            return false;
        },
        dispose(){}
    }
    return module;
}*/
export async function loadCDN(aliases:IAliases, e:IBuiltinModuleEntry):Promise<BuiltinModule> {
    const name=e.name;
    if (e.global) {
        const globalName = e.global;
        if (g[globalName]) {
            return g[globalName];
        }
        const url = e.url();
        await import(url);
        const modval = g[globalName];
        if (!modval) {
            throw new Error(
                `Global variable "${globalName}" not found after loading '${name}'`
            );
        }
        const module=new BuiltinModule(e.cacheKey(),modval,url);
        aliases.cache.add(module);
        return modval;
    }
    const url = e.url();
    const modval=await import(url);
    const module=new BuiltinModule(e.cacheKey(),modval,url);
    aliases.cache.add(module);
    return modval;
}