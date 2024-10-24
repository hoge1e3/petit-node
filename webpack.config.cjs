
const IgnoreDynamicRequire = require('webpack-ignore-dynamic-require');
module.exports = (env,argv)=>({
    // モード値を production に設定すると最適化された状態で、
    // development に設定するとソースマップ有効でJSファイルが出力される
    mode: 'development',
    // メインとなるJavaScriptファイル（エントリーポイント）
    entry: './src/index.ts',
    experiments: {
    	outputModule: true,
    },
    output: //[
      {
        //library: "pNode",
        //libraryTarget: 'umd',
	      libraryTarget: 'module',
        path: `${__dirname}/dist`,
        filename: "index.js",
      },
      /*{
        library: "pNode",
        libraryTarget: 'umd',
      	//libraryTarget: 'module',
        path: `${__dirname}/dist`,
        filename: "index.umd.js",
      },
    ],*/
    module: {
        rules: [
            {
                // 拡張子 .ts の場合
                test: /\.ts$/,
                // TypeScript をコンパイルする
                use: {
        			loader:'ts-loader',
        			/*options:{
        				plugins: ['@babel/plugin-syntax-dynamic-import'],
        			},*/
        		},
            },
        ],
        parser: {
          javascript: {
            importMeta: !env.production,
          },
        },
    },
    // import 文で .ts ファイルを解決するため
    // これを定義しないと import 文で拡張子を書く必要が生まれる。
    // フロントエンドの開発では拡張子を省略することが多いので、
    // 記載したほうがトラブルに巻き込まれにくい。
    resolve: {
        // 拡張子を配列で指定
        extensions: [
            '.ts', '.js',
        ],
    },
    
  plugins: [
    new IgnoreDynamicRequire()
  ],
});
