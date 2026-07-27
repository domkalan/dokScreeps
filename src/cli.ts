import { resetRoom } from './rooms';

export function addCliFunctions() {
    global.resetScoutData = function () {
        if (Memory.hive) {
            Memory.hive.rooms = {};
            Memory.hive.scouts = {};
            Memory.hive.lastScan = 0;
            
            // kill all current scout creeps
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep.memory.role === 'scout') {
                    creep.suicide();
                }
            }

            for(const roomName in Memory.rooms) {
                Memory.rooms[roomName].remoteEnergySources = {};
            }

            debugLog('All scout data has been reset.');
        } else {
            debugLog('No scout data found to reset.');
        }
    }

    global.resetScoutTimerFor = function (roomName: string) {
        if (Memory.hive && Memory.hive.rooms[roomName]) {
            Memory.hive.rooms[roomName].lastScan = 0;

            debugLog(`Scout data for room ${roomName} has been reset.`);
        } else {
            debugLog(`No scout data found for room ${roomName} to reset.`);
        }
    }

    global.resetRoomTasks = function (roomName: string) {
        const room = Game.rooms[roomName];
        if (room) {
            resetRoom(room);
        } else {
            debugLog(`No room found with name ${roomName}.`);
        }
    }

    global.setDebug = function (value : boolean) {
        Memory.debugMode = value;
    }
}