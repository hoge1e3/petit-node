import type {ImportDeclaration} from "acorn";
import * as espree from 'espree';
//import { generate } from 'escodegen';
import { simple } from "acorn-walk";
//import { SourceMapGenerator } from "source-map";
import { Content } from "@hoge1e3/fs";
import { ESModuleEntry, CompiledESModule } from "./Module";


type URLConverter = {
  conv:(s: string) => Promise<string>;
  deps:CompiledESModule[];
};
type Replacement={
    range:number[],
    to:Promise<string>,
};
function spliceStr(str:string, 
    begin:number, end:number, 
    replacement:string) {
  const firstPart = str.slice(0, begin);
  const lastPart = str.slice(end);
  return firstPart + (replacement || '') + lastPart;
}
export async function convert(entry: ESModuleEntry,urlConverter:URLConverter): Promise<CompiledESModule> {
  const file=entry.file;
  const sourceCode=file.text();
  let ast;
  try {
    ast = espree.parse(sourceCode, {
      sourceType: 'module',
      loc: true,
      range: true,
      ecmaVersion: 2024,
    });
  } catch (err) {
    throw err;
  }
  const repls=[] as Replacement[];
  const visitor = {
    ImportDeclaration(node: ImportDeclaration) {
      if (node.source) {
        const range=node.source.range||[0,0];
        const originalSource = node.source.value;
        const convertedSource = urlConverter.conv(originalSource as string);
        repls.unshift({
          to: convertedSource.then((s)=>JSON.stringify(s)),
          range:range.slice()
        });
        //node.source.value = convertedSource;
      }
    },
  };
  simple(ast, visitor);

  let conv2=sourceCode;
  for(let {range,to} of repls){
      conv2=spliceStr(conv2,range[0],range[1],await to);
  }
  const sourceURL=`//# sourceURL=file://${file.path()}`;
  const gensrc=`${conv2}
${sourceURL}
`;

  const url= URL.createObjectURL(new Blob([gensrc],{type:"text/javascript"}));
  return new CompiledESModule(
    entry, 
    urlConverter.deps, url, gensrc);
}