import type {ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration, ImportDeclaration, Literal} from "acorn";
import * as espree from 'espree';
//import { generate } from 'escodegen';
import { simple, SimpleVisitors } from "acorn-walk";
//import { SourceMapGenerator } from "source-map";
//import { Content } from "@hoge1e3/fs2";
import { ESModuleEntry, CompiledESModule } from "./ESModule";


type URLConverter = {
  conv:(s: string) => Promise<string>;
  deps:CompiledESModule[];
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
    const e=err as any;
    e.file=file;
    e.message="At "+file.path()+":"+e.lineNumber+":"+e.column+" "+e.message;
    throw e;
  }
  const replPromises=[] as Promise<Replacement>[];
  const convLiteral=(source: Literal)=>{
    const range=source.range||[0,0];
    const originalSource = source.value;
    const convertedSource = urlConverter.conv(originalSource as string);
    replPromises.push(convertedSource.then((s:string)=>({
      to: JSON.stringify(s),
      range: range.slice()
    })));
  };
  const visitor = {
    ExportAllDeclaration(node: ExportAllDeclaration) {
      if (node.source) convLiteral(node.source);
    },
    ExportNamedDeclaration(node: ExportNamedDeclaration) {
      if (node.source) convLiteral(node.source);
    },
    ImportDeclaration(node: ImportDeclaration) {
      if (node.source) convLiteral(node.source);
    },
  } as SimpleVisitors<unknown>;
  simple(ast, visitor);
  let conv2=sourceCode;
  await Promise.all(replPromises).then((repls)=>{
    const sorted=repls.sort((a,b)=>b.range[0]-a.range[0])
    for(let {range,to} of sorted){
      conv2=spliceStr(conv2,range[0],range[1],to);
    }
  });
  const sourceURL=`//# sourceURL=file://${file.path()}`;
  const gensrc=`${conv2}
${sourceURL}
`;

  const url= URL.createObjectURL(new Blob([gensrc],{type:"text/javascript"}));
  return new CompiledESModule(
    entry, 
    urlConverter.deps, url, gensrc);
}