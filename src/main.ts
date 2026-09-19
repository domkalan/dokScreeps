import * as rooms from './rooms';
import * as hive from './hive';
import * as cli from './cli';
import * as debug from './debug';
import * as creeps from './creeps';

// require legacy libraries
require('Traveler');
const profiler = require('screeps-profiler');

// attach debug functions
debug.attachDebug();

// attach cli functions to the global object for easy access in the console
cli.mountCommands();

// attach profiler
profiler.enable();

console.log(`Screeps bot initialized. Current game tick is ${Game.time}`);

function runTick() {
    debugLog(`Current game tick is ${Game.time}`);

    // patch the global every tick call
    cli.patchGlobal();

    // build the counts for creeps
    creeps.indexCreeps();

    // run logic loop for each owned room
    rooms.runRooms();

    // run the hive logic to coordinate work between colonies
    hive.runHive();

    // run creep logic for each creep
    creeps.runCreeps();

    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
        }
    }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = () => {
    // if we can generate pixels, do so if we have enough CPU bucket and pause for this tick
    if (Memory.pixelGen && Game.cpu.bucket >= 10000) {
        Game.cpu.generatePixel();

        return;
    }

    if (Memory.perfMode) {
        profiler.wrap(function () {
            runTick();

            if (typeof Memory.debugDisplay !== 'undefined') {
                debug.drawDebugInfo();
            }
        });
    }

    runTick();

    // draw debug information on the screen for each room
    if (typeof Memory.debugDisplay !== 'undefined') {
        debug.drawDebugInfo();
    }
};
