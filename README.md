# petit-node

**A tiny npm package loader that runs directly in the browser.**

petit-node executes a subset of Node.js without starting a server or spawning processes.
Instead of emulating a full server environment, it **evaluates Node(or npm)-style JavaScript code** directly in the browser, providing a REPL-like experience with a **persistent virtual file system**.
Only a static web page is required to run petit-node. 

Modules can be written, saved, and imported/required as ES/CommonJS modules. Path can be specified by both file path(absolute or relative) and npm package path (from node_modules/**).

These modules are **rewritable and reloadable** without refreshing browser entire pages. 
npm packages can also be used when stored in the virtual file system.

This project is designed for **mobile-first programming**, where traditional Node.js workflows (terminals, ports, server restarts) are not needed at all. 

petit-node was originally developed as the core runtime of
[[acepad](https://hoge1e3.github.io/acepad/)](https://github.com/hoge1e3/acepad-dev),
a programming environment optimized for smartphones and tablets.

The virtual file system is provided by
[petit-fs](https://www.npmjs.com/package/@hoge1e3/petit-fs). It provides filesystem using
localStorage and indexedDB.


## Example

```js
import pNode from "https://esm.sh/petit-node@1.6.9/dist/index.js";
// startup
await pNode.boot({
    fstab: [
        // mount ram disk on /tmp/
        {mountPoint:"/tmp/",fsType:"ram"},
    ],
});
// import fs module for virtual file system
const fs=await pNode.importModule("node:fs");
// create package.json
fs.writeFileSync("/tmp/package.json",JSON.stringify({
    main:"index.js",
    type:"module"
}));
// create index.js
fs.writeFileSync("/tmp/index.js",`
 import {greet} from "./sub.js";
 document.body.innerHTML+=greet("petit-node")+"<BR>";
 `);
// create sub.js
fs.writeFileSync("/tmp/sub.js",`
 export function greet(name) {
    return "Hello, "+name+"!";
 }`);
// import /tmp/ (/tmp/index.js)
await pNode.importModule("/tmp/");
// rewrite sub.js
fs.writeFileSync("/tmp/sub.js",
  fs.readFileSync("/tmp/sub.js","utf8").
     replace(/Hello/,"Nice to meet you"));
// re-import /tmp/ (/tmp/index.js)
await pNode.importModule("/tmp/");
// debug: list file systems
const dev=pNode.getDeviceManager();
console.log(dev.df());
```
[Run in codepen](https://codepen.io/hoge1e3/pen/dPbyxbp)

[Another silly(but powerful) example](https://www.npmjs.com/package/@acepad/here)

## API

- pNode.boot(options)
   - Initialize petit-node
   - `options` can include following attributes:
      - `aliases`
         - Specifies object that configures aliases.
         - The key is module path (that specifies after import)
         - The value is the module object which is imported
         - This allows use `import * as value from "key"` from programs in vitual file system.
      - `main` 
         - Specifies file(*.js) or directory(contains package.json) path of module which is automatically loaded
      - `fstab`
         - Specifies fils system table, See devicemanager sections
      - `init` A function called on boot. If the return value is file path or file object, petit-node imports the file.
- pNode.importModule(path, base)
   - import ES module from vitrual file system
   - `path` is either npm package path or file path of the module
   - `base` is required if `path` is not a absolute file path.
   - Return value is a promise of imported module object.
   - if the file content of module (or of depending modules) are changed, it is reloaded when import again
   - if there is ES modules that dependes on commonJS modules, they automatically "require"s.
- pNode.require(path, base) / pNode.require(f) 
   - import CommonJS module in same manners in importModule.

## How does it works?

- Each javascript source files in virtual file system is converted to BlobURL. If the file contains `import ... from 'filepath'`, the depending files are also converted to BlobURL recursively. 
- CJS modules are converted to Function with source codes.

## Virtual file system

- In browser(DOM) context, The virtual file system uses localStorage / IndexedDB to store files. `/tmp` is mounted as a RAM disk, the content is cleared on reload.
- In Worker context, The entire file system is mouted as RAM disk in default. IndexedDB can be mounted.
- See [petit-fs](https://www.npmjs.com/package/@hoge1e3/petit-fs) for details of file system API
