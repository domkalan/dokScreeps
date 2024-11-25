const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const main = async () => {
    const mainBuild = await readFileAsync(path.resolve('./dist/main.js'))
    const packageInfo = require(path.resolve('./package.json'));
    const timeNow = new Date();
    const timeStamp = `${timeNow.toDateString()} ${timeNow.toTimeString()}`

    const newBuild = `// dokScreeps v${packageInfo.version}\n// Build Date: ${timeStamp}\n\n${mainBuild.toString()}`;

    await writeFileAsync(path.resolve('./dist/main.orig.js'), mainBuild);
    await writeFileAsync(path.resolve('./dist/main.js'), newBuild);
};

main();