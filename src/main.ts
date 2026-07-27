import * as rooms from './rooms';
import * as hive from './hive';
import * as cli from './cli';
import * as debug from './debug';

// Attach the debugLog function to the global object for easy access in the console
global.debugLog = function (message: string): void {
    if (Memory.debugMode) {
        debugLog(`[DEBUG] ${message}`);
    }
}

// attach cli functions to the global object for easy access in the console
cli.addCliFunctions();

console.log(`Screeps bot initialized. Current game tick is ${Game.time}`);

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = () => {
    debugLog(`Current game tick is ${Game.time}`);

    // run logic loop for each owned room
    rooms.runRooms();

    // run the hive logic to coordinate work between colonies
    hive.runHive();

    // draw debug information on the screen for each room
    debug.drawDebugInfo();

    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
        }
    }

    // Generate a pixel for when the bucket is at 10000 and the pixel generation cooldown is 0
    if (Game.cpu.bucket >= 10000 && Game.cpu.generatePixel() === OK) {
        console.log('Generated a pixel!');
    }
};
