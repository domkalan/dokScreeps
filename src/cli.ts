import { resetRoom } from './rooms';

export function addCliFunctions() {
    global.resetScout = function () {
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

            for (const roomName in Memory.rooms) {
                Memory.rooms[roomName].remoteEnergySources = {};
            }

            debugLog('All scout data has been reset.');
        } else {
            debugLog('No scout data found to reset.');
        }
    }

    global.resetScoutTimer = function (roomName: string) {
        if (Memory.hive && Memory.hive.rooms[roomName]) {
            Memory.hive.rooms[roomName].lastScan = 0;

            debugLog(`Scout data for room ${roomName} has been reset.`);
        } else {
            debugLog(`No scout data found for room ${roomName} to reset.`);
        }
    }

    global.resetRoom = function (roomName: string) {
        const room = Game.rooms[roomName];
        if (room) {
            resetRoom(room);
        } else {
            debugLog(`No room found with name ${roomName}.`);
        }
    }

    global.setDebug = function (value: boolean) {
        Memory.debugMode = value;
    }

    global.snapshotStructures = function (roomName: string) {
        const room = Game.rooms[roomName];
        if (room) {
            if (!room.memory.constructionPlanner) {
                return 'No construction planner found for room ${roomName}.';
            }

            const defenses = room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_WALL ||
                    structure.structureType === STRUCTURE_RAMPART ||
                    structure.structureType === STRUCTURE_ROAD
            });

            for (const defense of defenses) {
                const existingPlan = room.memory.constructionPlanner.plan.find(item => item.x === defense.pos.x && item.y === defense.pos.y);
                if (!existingPlan) {
                    const structureType: BuildableStructureConstant = defense.structureType as BuildableStructureConstant;

                    room.memory.constructionPlanner.plan.push({
                        x: defense.pos.x,
                        y: defense.pos.y,
                        structureType,
                        priority: 1,
                        minRcl: 1
                    });
                }
            }

            return `Added ${defenses.length} defenses to the construction plan for room ${roomName}.`;
        }

        return `No room found with name ${roomName}.`;
    }

    global.claimRoom = function (roomName: string, existingRoom: string) {
        const room = Game.rooms[roomName];

        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        const existingRoomMemory = Memory.rooms[existingRoom];
        if (!existingRoomMemory || existingRoomMemory.type !== 'home') {
            return `No existing home room found with name ${existingRoom}.`;
        }

        existingRoomMemory.tasks[roomName] = {
            id: `claim-${roomName}`,
            type: 'claim',
            completed: false,
            priority: 1,
            targetId: roomName,
            roomId: room.name,
            created: Game.time,
            expires: Game.time + 10000
        };

        return `Claim task for room ${roomName} has been added to home room ${existingRoom}.`;
    }
}