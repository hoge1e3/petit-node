import type {ImportDeclaration} from "acorn";
import * as espree from 'espree';
import { generate } from 'escodegen';
import { simple } from "acorn-walk";
import { SourceMapGenerator } from "source-map";
import { Content } from "@hoge1e3/fs";
import { ESModule } from "./Module";


type URLConverter = {
  conv:(s: string) => string;
  deps:ESModule[];
};

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

  const visitor = {
    ImportDeclaration(node: ImportDeclaration) {
      if (node.source) {
        const originalSource = node.source.value;
        const convertedSource = urlConverter.conv(originalSource as string);
        node.source.value = convertedSource;
      }
    },
  };

  //console.log(ast);
  simple(ast, visitor);

  //console.log(ast);
  /*const sourceMap = new SourceMapGenerator({
    file: filename,
  });*/

  //sourceMap.addSource(filename, sourceCode);

  const generatedCode: {code:string, map:SourceMapGenerator} = generate(
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
    }*/
  ) as any;

  const base64SourceMap = Content.plainText(generatedCode.map.toString(),"application/json").toURL();
  const sourceMapDataURL = `//# sourceMappingURL=${base64SourceMap}`;
  console.log(generatedCode);
  const gensrc=`${generatedCode.code}\n${sourceMapDataURL}`;
  const url= URL.createObjectURL(new Blob([gensrc],{type:"text/javascript"}));
  const srcmap=generatedCode.map.toJSON();
  return new ESModule(
    file, sourceCode, file.lastUpdate(), urlConverter.deps,
     url, gensrc, srcmap);
  //return ;
}