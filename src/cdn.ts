import { IAliases, ICDNModuleEntry } from "../types";



const g:any=globalThis;

export async function loadCDN(aliases:IAliases, e:ICDNModuleEntry):Promise<ICDNModule> {
    const name=e.name;
    if (e.global) {
        const globalName = e.global;
        if (g[globalName]) {
            return g[globalName];
        }
        const url = e.url();
        await import(url);
        const mod = g[globalName];
        if (!mod) {
            throw new Error(
                `Global variable "${globalName}" not found after loading ${name}`
            );
        }
        aliases.cache.add()
        return mod;
    }
    const url = e.url();
    aliases.cache.add()
    return import(url);
}