import { createTask } from 'utils/TaskManager';
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

            return `All scout data for hive has been reset.`;
        } else {
            return `Hive not found.`;
        }
    }

    global.resetScoutTimer = function (roomName: string) {
        if (Memory.hive && Memory.hive.rooms[roomName]) {
            Memory.hive.rooms[roomName].lastScan = 0;

            return `Scout timer for room ${roomName} has been reset.`;
        } else {
            return `No room found with name ${roomName}.`;
        }
    }

    global.resetRoom = function (roomName: string) {
        const room = Game.rooms[roomName];

        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        resetRoom(room);

        return `Room ${roomName} has been reset.`;
    }

    global.setDebug = function (room: string) {
        Memory.debugDisplay = room;

        if (!room) {
            return `Debug display has been disabled.`;
        }

        return `Debug display set to room ${room}.`;
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

    global.attackStructures = function (roomName: string, structureTypes: BuildableStructureConstant[]) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        const parentRoomName = room.memory.parentRoom;
        if (!parentRoomName) {
            return `No parent room found for room ${roomName}.`;
        }

        const parentRoom = Game.rooms[parentRoomName];
        if (!parentRoom) {
            return `No parent room found with name ${parentRoomName}.`;
        }

        let totalStructures = 0;

        for (const structureType of structureTypes) {
            const structures = room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === structureType
            });

            for (const structure of structures) {
                totalStructures++;

                createTask(parentRoom, 'attack', structure.id, 5, room.name); // high priority for attacking structures
            }
        }

        return `Attack tasks for ${totalStructures} structures in room ${roomName} have been added to home room ${parentRoomName}.`;
    }

    global.attackStructureById = function (roomName: string, structureId: string) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        const parentRoomName = room.memory.parentRoom;
        if (!parentRoomName) {
            return `No parent room found for room ${roomName}.`;
        }

        const parentRoom = Game.rooms[parentRoomName];
        if (!parentRoom) {
            return `No parent room found with name ${parentRoomName}.`;
        }

        createTask(parentRoom, 'attack', structureId, 5, room.name); // high priority for attacking structures

        return `Attack task for structure ${structureId} in room ${roomName} has been added to home room ${parentRoomName}.`;
    }

    global.claimRoom = function (roomName: string, existingRoom: string) {
        // make sure the room has a memory object
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {
                type: 'remote',
                parentRoom: existingRoom,
                remoteEnergySources: {},
                lastScan: 0,
                energySources: [],
                tasks: {},
                spawnQueue: [],
                defenseMode: false
            };
        }

        const existingRoomMemory = Memory.rooms[existingRoom];
        if (!existingRoomMemory || existingRoomMemory.type !== 'home') {
            return `No existing home room found with name ${existingRoom}.`;
        }

        existingRoomMemory.tasks[`claim-${roomName}`] = {
            id: `claim-${roomName}`,
            type: 'claim',
            completed: false,
            priority: 1,
            targetId: roomName,
            roomId: roomName,
            created: Game.time,
            expires: Game.time + 1000
        };

        return `Claim task for room ${roomName} has been added to home room ${existingRoom}.`;
    }

    global.addRemoteRoom = function (roomName: string, existingRoom: string) {
        // make sure the room has a memory object
        if (!Memory.rooms[roomName] || Memory.rooms[roomName].type !== 'remote') {
            Memory.rooms[roomName] = {
                type: 'remote',
                parentRoom: existingRoom,
                remoteEnergySources: {},
                lastScan: 0,
                energySources: [],
                tasks: {},
                spawnQueue: [],
                defenseMode: false
            };
        }

        const existingRoomMemory = Memory.rooms[existingRoom];
        if (!existingRoomMemory || existingRoomMemory.type !== 'home') {
            return `No existing home room found with name ${existingRoom}.`;
        }

        return `Add remote task for room ${roomName} has been added to home room ${existingRoom}.`;
    }

    global.resetCreepTask = function (creepName: string) {
        const creep = Game.creeps[creepName];
        if (!creep) {
            return `No creep found with name ${creepName}.`;
        }

        creep.memory.taskId = undefined;

        return `Tasks for creep ${creepName} have been reset.`;
    }
}