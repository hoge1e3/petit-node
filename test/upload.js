/*global globalThis*/
import * as boot from "./bootLoader.js";
boot.onReady(onload);
async function onload() {
    await import("./console.js");
    if(!localStorage["/"]){
        localStorage["/"]="{}";
    }
    const pNode=await boot.init({
        BOOT_DISK_URL:"https://github.com/hoge1e3/acepad-dev/archive/refs/heads/main.zip",
        PNODE_URL: location.origin+"/dist/index.js",
        SETUP_URL:"acepad/setup.zip",
    });
    const FS=pNode.FS;
    const rp=FS.get("/package.json");
    await boot.showMenus(rp);

    globalThis.pNode=pNode;

    console.log("Mounting RAM/IDB");
    FS.mount("/tmp/","ram");
    await FS.mountAsync("/idb/","idb");
    console.log("Done");
    boot.initAutoexec(rp);

}

