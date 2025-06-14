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
        PNODE_URL: "../dist/index.js",
        SETUP_URL:"acepad/setup.zip",
    });
    globalThis.pNode=pNode;
}

