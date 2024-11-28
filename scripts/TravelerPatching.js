const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const main = async () => {
    const mainBuild = await readFileAsync(path.resolve('./dist/traveler.js'));

    const timeNow = new Date();
    const timeStamp = `${timeNow.toDateString()} ${timeNow.toTimeString()}`

    let newBuild = `// Patch Date: ${timeStamp}\n\n${mainBuild.toString()}`;

    newBuild = newBuild.replace('// this.updateRoomStatus(creep.room);', 'this.updateRoomStatus(creep.room);');
    newBuild = newBuild.replace('// this.circle(destination, "orange");', 'this.circle(destination, "orange");');

    await writeFileAsync(path.resolve('./dist/traveler.orig.js'), mainBuild);
    await writeFileAsync(path.resolve('./dist/traveler.js'), newBuild);
};

main();