# petit-node
Node.js subset runs on browser. Supports ES module import including npm packages stored in virtual file system. Virtual file system is provided by [@hoge1e3/fs](https://www.npmjs.com/package/@hoge1e3/fs). It also runs in Worker.

The system is developed to implement [acepad](https://hoge1e3.github.io/acepad/), the programming environment for mobile device.

## Example

```js
import pNode from "https://esm.sh/petit-node@latest/dist/index.js";
pNode.boot({
   init({FS}) {
       // get file object via FS object
       // create main.js
       const main=FS.get("/tmp/main.js");
       main.text(`
 import {greet} from "./sub.js";
 document.body.innerHTML+=greet("petit-node");
 `);
       // create sub.js
       const sub=FS.get("/tmp/sub.js");
       sub.text(`
 export function greet(name) {
    return "Hello, "+name+"!";
 }   
 `);
       return main;
   } 
});
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
- pNode.importModule(f)
   - import module from vitrual file system
   - `f` is a file object of [@hoge1e3/fs](https://www.npmjs.com/package/@hoge1e3/fs)
   - Return value is a promise of imported module object.

## How does it works?

Each javascript source files in virtual file system is converted to BlobURL. If the file contains `import ... from 'filepath'`, the depending files are also converted to BlobURL recursively. 

## Virtual file system

- In browser(DOM) context, The virtual file system uses localStorage to store files. `/tmp` is mounted as a RAM disk, the content is cleared on reload.
- In Worker context, The entire file system is mouted as RAM disk.
- See [@hoge1e3/fs](https://www.npmjs.com/package/@hoge1e3/fs) for details of file system API