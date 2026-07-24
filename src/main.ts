import * as rooms from './rooms';
import * as hive from './hive';

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = () => {
  console.log(`Current game tick is ${Game.time}`);

  // run logic loop for each owned room
  rooms.runRooms();

  // run the hive logic to coordinate work between colonies
  hive.runHive();

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
};
