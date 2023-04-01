const ejs = require('ejs');
const {writeFileSync, readFileSync} = require('fs');
const config = require('../circuit.config.cjs');

// read circuit from config
const target = process.argv[2];
const dir = process.argv[3];
if (!(target in config)) {
  throw new Error(`Target ${target} not found in config.`);
}

// generate the main component code
const ejsPath = './circuits/ejs/template.circom';
let circuit = ejs.render(readFileSync(ejsPath).toString(), config[target]);

// output to file
const targetPath = `./circuits/${dir}/${target}.circom`;
writeFileSync(targetPath, circuit);
console.log(`Main component created at: ${targetPath}\n`);
