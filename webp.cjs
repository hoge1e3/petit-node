
let WebpackCLI = require("webpack-cli");
const runCLI = async (args) => {
    // Create a new instance of the CLI object
    const cli = new WebpackCLI();
    try {
        await cli.run(args);
    }
    catch (error) {
        cli.logger.error(error);
        process.exit(2);
    }
};
exports.main = function main(){
  process.chdir(this.resolve(".").path());
  return runCLI();
};
