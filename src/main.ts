import * as rooms from './rooms';
import * as hive from './hive';
import * as cli from './cli';
import * as debug from './debug';
import * as creeps from './creeps';
import * as context from 'utils/Context';

// require legacy libraries
require('Traveler');

// Attach the debugLog function to the global object for easy access in the console
global.debugLog = function (message: string): void {
    if (Memory.debugMode) {
        console.log(`[DEBUG] ${message}`);
    }
}

// attach cli functions to the global object for easy access in the console
cli.addCliFunctions();

console.log(`Screeps bot initialized. Current game tick is ${Game.time}`);

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = () => {
    debugLog(`Current game tick is ${Game.time}`);

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

    // draw debug information on the screen for each room
    debug.drawDebugInfo();
};
