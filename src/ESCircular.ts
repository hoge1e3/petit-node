import type {ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration, ImportDeclaration, Literal} from "acorn";
import * as espree from 'espree';
import { simple, SimpleVisitors } from "acorn-walk";
import type { SFile } from "@hoge1e3/sfile";
import type { IAliases } from "../types/index.js";
import { jsToBlobURL } from "./scriptTag.js";
import { asBuiltinKey } from "./alias.js";

export async function genCircularResolver(aliases:IAliases, file: SFile):Promise<string> {
    let src:string;
    try {
        src=file.text();
    }catch(e) {
        await (e as any).retryPromise;
        src=file.text();
    }
    let ids=exportedIdentifiers(src);
    /*if (ids.includes("default")) {
        throw new Error(file+": Cannot resolve circular dependencies with default export.");
    }*/
    const pNodeURL=aliases.cache.getByPath(asBuiltinKey("pnode:main"))!.url;
    const msrc=`
import pNode from "${pNodeURL}";
let ${ids.map((id,i)=>`_${i}`).join(",")};
export {${ids.map((id,i)=>`_${i} as ${JSON.stringify(id)}`).join(",")}};
pNode.importModule(${JSON.stringify(file.path())}).then((m)=>{
    ${ids.map((id,i)=>`_${i}=m[${JSON.stringify(id)}];`).join("\n")}
});
`;
    console.log("circ", file.path(), msrc);
    return jsToBlobURL(aliases.scriptingContext, msrc);
}
export function exportedIdentifiers(jssrc: string): string[] {
  const ast = espree.parse(jssrc, {
    ecmaVersion: "latest",
    sourceType: "module",
  });

  const identifiers: string[] = [];

  const visitors: SimpleVisitors<unknown> = {
    ExportNamedDeclaration(node: ExportNamedDeclaration) {
      // export { foo, bar } or export { foo as bar }
      for (const specifier of node.specifiers) {
        identifiers.push((specifier.exported as Literal).value ?? (specifier.exported as any).value);
      }
      // export const foo = ..., export function foo() {}, export class Foo {}
      if (node.declaration) {
        const decl = node.declaration;
        if (decl.type === "VariableDeclaration") {
          for (const d of decl.declarations) {
            if (d.id.type === "Identifier") identifiers.push(d.id.name);
          }
        } else if (
          decl.type === "FunctionDeclaration" ||
          decl.type === "ClassDeclaration"
        ) {
          if (decl.id) identifiers.push(decl.id.name);
        }
      }
    },

    ExportDefaultDeclaration(_node: ExportDefaultDeclaration) {
      identifiers.push("default");
    },

    ExportAllDeclaration(node: ExportAllDeclaration) {
      // export * as ns from "..."
      if (node.exported) {
        identifiers.push(
          (node.exported as Literal).value ?? (node.exported as any).value
        );
      }
    },
  };

  simple(ast, visitors);
  return identifiers;
}