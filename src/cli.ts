import { createTask, releaseTask } from 'utils/TaskManager';
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

    global.setPerfMode = function (enabled: boolean) {
        Memory.perfMode = enabled;

        if (enabled) {
            return `Performance tracking mode has been enabled.`;
        } else {
            return `Performance tracking mode has been disabled.`;
        }
    }

    global.setCacheMode = function (enabled: boolean) {
        Memory.cacheMode = enabled;

        if (enabled) {
            return `Cache mode has been enabled.`;
        } else {
            return `Cache mode has been disabled.`;
        }
    }

    global.setStorageLink = function (roomName: string, linkId: string) {
        const roomMemory = Memory.rooms[roomName];

        if (!roomMemory) {
            return `No room found with name ${roomName}.`;
        }

        roomMemory.storageLink = linkId;

        return `Storage link for room ${roomName} has been set to ${linkId}.`;
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

    global.setRoomType = function (roomName: string, type: 'home' | 'remote', parentRoom?: string) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        // reset the room to clear any existing tasks and spawn queue
        resetRoom(room);

        // set the room type to 'home'


        if (type === 'remote') {
            if (!parentRoom) {
                return `Parent room must be specified when setting room type to 'remote'.`;
            }

            Memory.rooms[roomName].type = type;

            // set parent type if provided
            Memory.rooms[roomName].parentRoom = parentRoom || undefined;

            // parent room ref
            const parentRoomRef = Game.rooms[parentRoom || ''];

            if (parentRoom && parentRoomRef) {
                // add the room to the parent room's childRooms array if it's not already there
                if (!parentRoomRef.memory.childRooms) {
                    parentRoomRef.memory.childRooms = [];
                }

                if (!parentRoomRef.memory.childRooms.includes(roomName)) {
                    parentRoomRef.memory.childRooms.push(roomName);
                }

                // add room energy sources as remote energy sources to the parent room's memory
                const roomEnergySources = room.find(FIND_SOURCES).map(source => source.id);
                for (const sourceId of roomEnergySources) {
                    parentRoomRef.memory.remoteEnergySources![sourceId] = { room: roomName, id: sourceId };
                }
            }

            // all creeps in this room should have their tasks wiped and be reassigned to the parent room
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep.memory.room === roomName) {
                    releaseTask(creep); // Release the task if the creep is in the remote room

                    creep.memory.taskId = undefined;
                    creep.memory.room = parentRoom || '';
                }
            }
        } else if (type === 'home') {
            const parentRoomRef = Game.rooms[room.memory.parentRoom || ''];

            // if room was previously a remote
            // remove it from the parent room's childRooms array and remove its remote energy sources
            if (parentRoomRef && parentRoomRef.memory.childRooms) {
                // remove child dep
                parentRoomRef.memory.childRooms = parentRoomRef.memory.childRooms.filter((childRoom: string) => childRoom !== roomName);

                // remove remote energy sources
                const roomEnergySources = room.find(FIND_SOURCES).map(source => source.id);
                for (const sourceId of roomEnergySources) {
                    // remove the remote energy source from the parent room's memory if it exists
                    delete parentRoomRef.memory.remoteEnergySources![sourceId];
                }
            }

            // all creeps currently in this room should have their tasks wiped and be reassigned to this room
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep.memory.room === roomName) {
                    releaseTask(creep); // Release the task if the creep is in the remote room

                    creep.memory.taskId = undefined;
                    creep.memory.room = roomName;
                }
            }

            Memory.rooms[roomName].type = type;
            Memory.rooms[roomName].parentRoom = undefined;
        }

        return `Bootstrap task for room ${roomName} has been added.`;
    }
}