# petit-node

**A tiny Node.js–compatible runtime that runs directly in the browser.**

petit-node executes a subset of Node.js without starting a server or spawning processes.
Instead of emulating a full server environment, it **evaluates Node-style JavaScript code** directly in the browser, providing a REPL-like experience with a **persistent virtual file system**.

Modules can be written, saved, and imported as ES modules or CommonJS modules. 
These modules are **rewritable and reloadable** without refreshing browser entire pages. 
npm packages can also be used when stored in the virtual file system.

This project is designed for **mobile-first programming**, where traditional Node.js workflows (terminals, ports, server restarts) are not needed at all. 
Only a static web page is required to run petit-node. 

The virtual file system is provided by
[@hoge1e3/fs](https://www.npmjs.com/package/@hoge1e3/fs),
and petit-node can also run inside Web Workers.

petit-node was originally developed as the core runtime of
[acepad](https://hoge1e3.github.io/acepad/),
a programming environment optimized for smartphones and tablets.

## Example

```js
import pNode from "https://esm.sh/petit-node@latest/dist/index.js";
await pNode.boot();
// mount file system, RAM-disk on /tmp/
dev.mount("/tmp/","ram");
console.log(dev.df());
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
// import /tmp/(index.js)
await pNode.importModule("/tmp/");
// rewrite sub.js
fs.writeFileSync("/tmp/sub.js",`
 export function greet(name) {
    return "Nice to meet you, "+name+"!";
 }`);
// re-import /tmp/(index.js), message changes.
await pNode.importModule("/tmp/");
```
[Run in codepen](https://codepen.io/hoge1e3/pen/dPbyxbp)

## API

- pNode.boot(options)
   - Initialize petit-node
   - `options` can include following attributes:
      - `init` A function called on boot, the argument object has `FS` object in [@hoge1e3/fs](https://www.npmjs.com/package/@hoge1e3/fs). If the return value is file object, petit-node imports the file.
      - `aliases`
         - Specifies object that configures aliases.
         - The key is module path (that specifies after import)
         - The value is the module object which is imported
         - This allows use `import * as value from "key"` from programs in vitual file system.
- pNode.importModule(path, base)
   - import ES module from vitrual file system
   - `path` is either npm package path or file path of the module
   - `base` is required if `path` is not a absolute file path.
   - Return value is a promise of imported module object.
   - if the file content of module (or of depending modules) are changed, it is reloaded when import again
   - if there is ES modules that dependes on commonJS modules, they automatically "require"s.
- pNode.importModule(f)
   - like pNode.importModule(path, base) but `f` is a file object of [@hoge1e3/fs](https://www.npmjs.com/package/@hoge1e3/fs)
- pNode.require(path, base) / pNode.require(f) 
   - import CommonJS module in same manners in importModule.

## How does it works?

- Each javascript source files in virtual file system is converted to BlobURL. If the file contains `import ... from 'filepath'`, the depending files are also converted to BlobURL recursively. 
- CJS modules are converted to Function with source codes.

## Virtual file system

- In browser(DOM) context, The virtual file system uses localStorage / IndexedDB to store files. `/tmp` is mounted as a RAM disk, the content is cleared on reload.
- In Worker context, The entire file system is mouted as RAM disk in default. IndexedDB can be mounted.
- See [@hoge1e3/fs](https://www.npmjs.com/package/@hoge1e3/fs) for details of file system API