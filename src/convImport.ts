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
  let filename=file.path();
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
          //console.log("imp",sourceCode.substring(range[0],range[1]));
          //
        const originalSource = node.source.value;
        const convertedSource = urlConverter.conv(originalSource as string);
        repls.unshift({
              to: JSON.stringify(convertedSource),
              range:range.slice()
        });
        node.source.value = convertedSource;
      }
    },
  };
  //console.log(ast);
  simple(ast, visitor);

  let conv2=sourceCode;
  console.log("repls",repls);
  for(let {range,to} of repls){
      //console.log("slice",conv2.slice(...range),range,to);
      conv2=spliceStr(conv2,range[0],range[1],to);
  }
 // console.log("conv2",conv2);

  //console.log(ast);
  /*const sourceMap = new SourceMapGenerator({
    file: filename,
  });*/

  //sourceMap.addSource(filename, sourceCode);

/*  const generatedCode: {code:string, map:SourceMapGenerator} = generate(
    ast,
    {
      sourceMap: filename,
      sourceMapRoot: 'pNode',
      sourceMapWithCode: true,
      sourceContent: sourceCode,
      //file: filename,
    },
    /*(originalCode, generatedCode, node) => {
      const originalRange = node.range;
      const mapping = {
        source: filename,
        original: {
          line: originalRange ? node.loc.start.line : null,
          column: originalRange ? node.loc.start.column : null,
        },
        generated: {
          line: null,
          column: null,
        },
      };
      sourceMap.addMapping(mapping);
    }
  ) as any;

  const base64SourceMap = Content.plainText(generatedCode.map.toString(),"application/json").toURL();
  const sourceMapDataURL = `//# sourceMappingURL=${base64SourceMap}`;
*/
  const sourceURL=`//# sourceURL=file://${file.path()}`;
  //console.log(generatedCode);
//
/*
const gensrc=`${generatedCode.code}
${sourceMapDataURL}
${sourceURL}
`;
*/
  const gensrc=`${conv2}
${sourceURL}
`;

  const url= URL.createObjectURL(new Blob([gensrc],{type:"text/javascript"}));
//  const srcmap=generatedCode.map.toJSON();
  return new ESModule(
    file, sourceCode, file.lastUpdate(), 
    urlConverter.deps,
    url, gensrc);//, srcmap);
  //return ;
}