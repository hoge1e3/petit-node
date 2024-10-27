import type {ImportDeclaration} from "acorn";
import * as espree from 'espree';
//import { generate } from 'escodegen';
import { simple } from "acorn-walk";
//import { SourceMapGenerator } from "source-map";
import { Content } from "@hoge1e3/fs";
import { ESModule } from "./Module";


type URLConverter = {
  conv:(s: string) => string;
  deps:ESModule[];
};
type Replacement={
    range:number[],
    to:string,
};
function spliceStr(str:string, 
    begin:number, end:number, 
    replacement:string) {
  const firstPart = str.slice(0, begin);
  const lastPart = str.slice(end);
  return firstPart + (replacement || '') + lastPart;
}
export function convert(file: SFile,urlConverter:URLConverter): ESModule {
  let sourceCode=file.text();
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
          to: JSON.stringify(convertedSource),
          range:range.slice()
        });
        //node.source.value = convertedSource;
      }
    },
  };
  simple(ast, visitor);

  let conv2=sourceCode;
  for(let {range,to} of repls){
      conv2=spliceStr(conv2,range[0],range[1],to);
  }
  const sourceURL=`//# sourceURL=file://${file.path()}`;
  const gensrc=`${conv2}
${sourceURL}
`;

  const url= URL.createObjectURL(new Blob([gensrc],{type:"text/javascript"}));
  return new ESModule(
    file, sourceCode, file.lastUpdate(), 
    urlConverter.deps,
    url, gensrc);
}