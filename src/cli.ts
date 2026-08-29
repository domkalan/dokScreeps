import { createTask, releaseTask } from 'utils/TaskManager';
import { resetRoom } from './rooms';
import { HiveColonizePlan } from './types/hive';
import { colonizePlanExists } from './hive';


const HELP_ENTRIES: { [key: string]: { desc: string, opts?: { [key: string]: { req: boolean } } } } = {};
export function registerCommand(name: string, description: string, opts: { [key: string]: { req: boolean } }, func: (...args: any[]) => any) {
    HELP_ENTRIES[name] = { desc: description, opts };

    global[name] = func;
}

export function mountCommands() {
    registerCommand('resetRoom', 'Resets the specified room, clearing tasks and spawn queue.', { roomName: { req: true } }, function (roomName: string) {
        const room = Game.rooms[roomName];

        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        resetRoom(room);

        return `Room ${roomName} has been reset.`;
    });


    registerCommand('setDebug', 'Sets the room for debug display. Pass an empty string to disable.', { room: { req: true } }, function (room: string) {
        Memory.debugDisplay = room;

        if (!room) {
            return `Debug display has been disabled.`;
        }

        return `Debug display set to room ${room}.`;
    });

    registerCommand('setPerfMode', 'Enables or disables performance tracking mode.', { enabled: { req: true } }, function (enabled: boolean) {
        Memory.perfMode = enabled;

        if (enabled) {
            return `Performance tracking mode has been enabled.`;
        } else {
            return `Performance tracking mode has been disabled.`;
        }
    });

    registerCommand('setCacheMode', 'Enables or disables cache mode.', { enabled: { req: true } }, function (enabled: boolean) {
        Memory.cacheMode = enabled;

        if (enabled) {
            return `Cache mode has been enabled.`;
        } else {
            return `Cache mode has been disabled.`;
        }
    });

    registerCommand('setStorageLink', 'Sets the storage link for the specified room.', { roomName: { req: true } }, function (roomName: string, linkId: string) {
        const roomMemory = Memory.rooms[roomName];

        if (!roomMemory) {
            return `No room found with name ${roomName}.`;
        }

        roomMemory.storageLink = linkId;

        return `Storage link for room ${roomName} has been set to ${linkId}.`;
    });

    registerCommand('snapshotStructures', 'Snapshots the current structures in the room and adds them to the construction plan.', { roomName: { req: true } }, function (roomName: string) {
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
                let hasExistingPlan = false;
                for (const item of room.memory.constructionPlanner.plan) {
                    if (item.x === defense.pos.x && item.y === defense.pos.y) {
                        hasExistingPlan = true;
                        break;
                    }
                }
                if (!hasExistingPlan) {
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
    });

    registerCommand('attackStructures', 'Creates attack tasks for all structures of the specified types in the given room.', { roomName: { req: true } }, function (roomName: string, structureTypes: BuildableStructureConstant[]) {
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
    });

    registerCommand('attackStructureById', 'Creates an attack task for the specified structure ID in the given room.', { roomName: { req: true }, structureId: { req: true } }, function (roomName: string, structureId: string) {
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
    });

    registerCommand('drainStructures', 'Creates drain tasks for all structures of the specified types in the given room that contain the specified resource type.', { roomName: { req: true }, resourceType: { req: true }, structureTypes: { req: true } }, function (roomName: string, resourceType: ResourceConstant, structureTypes: string[]) {
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

        const structures = room.find(FIND_STRUCTURES, {
            filter: (structure) => structureTypes.includes(structure.structureType) && typeof (structure as StructureContainer).store !== 'undefined' && (structure as StructureContainer).store.getUsedCapacity(resourceType) > 0
        });

        for (const structure of structures) {
            totalStructures++;

            createTask(parentRoom, 'haul', structure.id, 5, room.name, undefined, 5000, resourceType); // high priority for attacking structures
        }

        return `Drain tasks for ${totalStructures} structures in room ${roomName} have been added to home room ${parentRoomName}.`;
    });

    registerCommand('claimRoom', 'Creates a claim task for the specified room and adds it to the existing home room.', { roomName: { req: true }, existingRoom: { req: true } }, function (roomName: string, existingRoom: string) {
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
    });

    registerCommand('addRemoteRoom', 'Adds a remote room to the specified existing home room.', { roomName: { req: true }, existingRoom: { req: true } }, function (roomName: string, existingRoom: string) {
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
    });

    registerCommand('resetCreepTask', 'Resets the task for the specified creep.', { creepName: { req: true } }, function (creepName: string) {
        const creep = Game.creeps[creepName];
        if (!creep) {
            return `No creep found with name ${creepName}.`;
        }

        creep.memory.taskId = undefined;

        return `Tasks for creep ${creepName} have been reset.`;
    });

    registerCommand('forceEnergyHarvest', 'Forces the specified room to continue spawning harvesters even if the energy threshold is met.', { roomName: { req: true }, setting: { req: true } }, function (roomName: string, setting: boolean) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        room.memory.energyThresholdOverride = setting;
        if (setting === true) {
            room.memory.energyThresholdMet = false; // reset the energy threshold met flag to force spawning
        }

        return `Energy threshold override for room ${roomName} has been set to ${setting}.`;
    });

    registerCommand('setRoomType', 'Sets the specified room type to either "home" or "remote". If setting to "remote", a parent room must be specified.', { roomName: { req: true }, type: { req: true } }, function (roomName: string, type: 'home' | 'remote', parentRoom?: string) {
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
                const childRooms: string[] = [];
                for (const childRoom of parentRoomRef.memory.childRooms) {
                    if (childRoom !== roomName) childRooms.push(childRoom);
                }
                parentRoomRef.memory.childRooms = childRooms;

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
    });

    registerCommand('resetHive', 'Resets the entire hive, clearing all data and tasks.', {}, function () {
        if (Memory.hive) {
            Memory.hive.rooms = {};
            Memory.hive.tasks = {};
            Memory.hive.lastScan = 0;

            // kill all current scout creeps
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep.memory.role === 'scout') {
                    creep.suicide();
                }
            }

            return `All scout data for hive has been reset.`;
        } else {
            return `Hive not found.`;
        }
    });

    registerCommand('resetHiveTick', 'Resets the hive tick, causing the hive to rescan all rooms.', {}, function () {
        if (Memory.hive) {
            Memory.hive.lastScan = 0;
            return `Hive tick has been reset.`;
        } else {
            return `Hive not found.`;
        }
    });

    registerCommand('resetHiveRoomScan', 'Resets the scout timer for the specified room.', { roomName: { req: true } }, function (roomName: string) {
        if (Memory.hive && Memory.hive.rooms[roomName]) {
            Memory.hive.rooms[roomName].lastScan = 0;

            return `Scout timer for room ${roomName} has been reset.`;
        } else {
            return `No room found with name ${roomName}.`;
        }
    });


    // hiveColonizePlan(['shard3', 'W1S22'], [['shard3', 'W0S20', '5c0e406c504e0a34e3d61df0'], ['shard2', 'W0S20', '59f1c0062b28ff65f7f2166f']], 'shard1', 'E1S18')
    // hiveColonizePlan(['shard3', 'W1S22'], [['shard3', 'W0S20', '5c0e406c504e0a34e3d61df0'], ['shard2', 'W0S20', '59f1c0062b28ff65f7f2166f'], ['shard1', 'W0S20', '69f291863d008a3381151b1b']], 'shard0', 'W1S19')
    registerCommand('hiveColonizePlan', 'Creates a hive colonization plan with the specified portals, target shard, and target room.', { portals: { req: true }, targetShard: { req: true }, targetRoom: { req: true }, force: { req: false } }, function (owningRoom: [string, string], portals: [string, string, string][], targetShard: string, targetRoom: string, force: boolean = false) {
        const colonizeRunning = colonizePlanExists();

        if (colonizeRunning && !force) {
            return `Hive colonization plan already exists on another shard.`;
        }

        const hiveColonizePlan: HiveColonizePlan = {
            portals: portals, // third element is portal id, which will be filled in later
            targetShard: targetShard,
            targetRoom: targetRoom,
            owningShard: owningRoom[0],
            owningRoom: owningRoom[1],
            phase: 'colonize',
            creepsSpawned: {}
        };

        if (Memory.hive.interShard.colonizePlan && !force) {
            return `Hive colonization plan already exists.`;
        }

        Memory.hive.interShard.colonizePlan = hiveColonizePlan;
        Memory.hive.interShard.lastUpdated = Game.time;

        Memory.hive.lastScan = 0; // force hive to rescan and pick up the new colonization plan

        return `Hive colonization plan for ${targetRoom} on shard ${targetShard} has been created.`;
    });

    registerCommand('help', 'Displays a list of all available CLI commands.', {}, function () {
        let helpText = 'Available CLI commands:\n';

        for (const command in HELP_ENTRIES) {
            const entry = HELP_ENTRIES[command];
            helpText += `\n${command}: ${entry.desc}\n`;

            if (entry.opts) {
                helpText += '\tOptions:\n';
                for (const opt in entry.opts) {
                    const optEntry = entry.opts[opt];
                    helpText += `\t\t${opt}: ${optEntry.req ? 'Required' : 'Optional'}\n`;
                }
            }
        }

        return helpText;
    });
}
