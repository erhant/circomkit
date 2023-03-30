const ejs = require('ejs');
const {writeFileSync, readFileSync, existsSync, mkdirSync} = require('fs');
const config = require('../circuit.config.cjs');

// read circuit from config
const target = process.argv[2];
if (!(target in config)) {
  throw new Error(`Target ${target} not found in config.`);
}

// generate the main component code
const templatePath = './circuits/ejs/template.circom';
let circuit = ejs.render(readFileSync(templatePath).toString(), config[target]);

// output to file
const dirName = config[target].dir ? config[target].dir : 'main';
if (typeof dirName !== 'string') {
  throw new Error(`Bad target type.`);
}

const dir = `./circuits/${dirName}`;
if (!existsSync(dir)) {
  mkdirSync(dir, {recursive: true});
}

const targetPath = `${dir}/${target}.circom`;
writeFileSync(targetPath, circuit);
console.log(`Main component created at: ${targetPath}\n`);
