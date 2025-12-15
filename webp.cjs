const webpack = require('webpack');
let config = require('./webpack.config.cjs');
globalThis.global=globalThis;
//process.version="1.2.3";//atodekesu
exports.main=function main(){
  //globalThis.__conf=config;
  //console.log("conf",config);
  if (typeof config==="function") config=config(process.env,[]);
  const compiler = webpack(config);
  
  compiler.run((err, stats) => {
    if (err) {
      console.error('Webpack error:', err);
      process.exit(1);
    }
  
    console.log(stats.toString({ colors: true }));
    compiler.close(() => {});
  });
};
