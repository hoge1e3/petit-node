const webpack = require('webpack');
const config = require('./webpack.config.cjs');

exports.main=function main(){
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
