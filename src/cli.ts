import { createTask, releaseTask } from 'utils/TaskManager';
import { resetRoom } from './rooms';
import { HiveExpansionPlan } from './types/hive';

export function patchGlobal() {
    global.console.error = function (...args: any[]) {
        // Combine arguments into one string and wrap in raw()
        console.logUnsafe(`<span style="color: #ff5555; font-weight: bold;">[ERROR]`, ...args, `</span>`);
    }

    global.console.warn = function (...args: any[]) {
        console.logUnsafe(`<span style="color: #ffb86c;">[WARN]`, ...args, `</span>`);
    }

    global.console.info = function (...args: any[]) {
        console.logUnsafe(`<span style="color: #8be9fd;">[INFO]`, ...args, `</span>`);
    }
}

export function mountCommands() {
    // Mount commands to the global object so they can be called from the console
    const HELP_ENTRIES: { [key: string]: { desc: string, opts?: { [key: string]: { req: boolean } } } } = {};
    function registerCommand(name: string, description: string, opts: { [key: string]: { req: boolean } }, func: (...args: any[]) => any) {
        HELP_ENTRIES[name] = { desc: description, opts };

        global[name] = func;
    }

    registerCommand('resetRoom', 'Resets the specified room, clearing tasks and spawn queue.', { roomName: { req: true } }, function (roomName: string) {
        const room = Game.rooms[roomName];

        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        resetRoom(room);

        return `Room ${roomName} has been reset.`;
    });


    registerCommand('setDebug', 'Sets the room for debug display. Pass an empty string to disable.', { room: { req: true } }, function (room: string) {
        if (!room) {
            delete Memory.debugDisplay;
            return `Debug display has been disabled.`;
        }

        Memory.debugDisplay = room;

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

    registerCommand('removeStructures', 'Removes all structures of the specified types in the given room.', { roomName: { req: true }, structureTypes: { req: true } }, function (roomName: string, structureTypes: BuildableStructureConstant[]) {
        const room = Game.rooms[roomName];

        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        for (const structureType of structureTypes) {
            const structures = room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === structureType
            });

            for (const structure of structures) {
                structure.destroy();
            }
        }

        return `Structures of types ${structureTypes.join(', ')} in room ${roomName} have been removed.`;
    });

    registerCommand('removeConstructionSites', 'Removes all construction sites of the specified types in the given room.', { roomName: { req: true }, structureTypes: { req: true } }, function (roomName: string, structureTypes: BuildableStructureConstant[]) {
        const room = Game.rooms[roomName];

        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);

        for (const site of constructionSites) {
            site.remove();
        }

        return `${constructionSites.length} construction sites from room ${roomName} have been removed.`;
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
        existingRoomMemory.expandTo = roomName; // set the expandTo property to the new room

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

    registerCommand('lockoutRoom', 'Locks out the specified room, preventing any logic or spawning for that room.', { roomName: { req: true }, value: { req: true } }, function (roomName: string, value: boolean) {
        const roomMemory = Memory.rooms[roomName];

        if (!roomMemory) {
            return `No room found with name ${roomName}.`;
        }

        roomMemory.lockout = value;

        if (!value) {
            return `Room ${roomName} has been unlocked.`;
        }

        return `Room ${roomName} has been locked out.`;
    });

    registerCommand('leaveRoom', 'Unclaims and deletes a room from the hive.', { roomName: { req: true }, deleteStructures: { req: false } }, function (roomName: string, deleteStructures: boolean = false) {
        const roomMemory = Memory.rooms[roomName];
        const roomRef = Game.rooms[roomName];

        if (!roomMemory) {
            return `No room found with name ${roomName}.`;
        }

        // if the room is a remote, remove it from the parent room's childRooms array
        if (roomMemory.type === 'remote' && roomMemory.parentRoom) {
            const parentRoomMemory = Memory.rooms[roomMemory.parentRoom];
            if (parentRoomMemory && parentRoomMemory.childRooms) {
                parentRoomMemory.childRooms = parentRoomMemory.childRooms.filter(childRoom => childRoom !== roomName);
            }
        }

        // do we want to delete all structures in the room?
        if (deleteStructures) {
            // delete all structures in the room
            for (const structure of roomRef.find(FIND_STRUCTURES)) {
                structure.destroy();
            }
        }

        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];

            if (creep.memory.room === roomName) {
                creep.suicide();
            }
        }

        // unclaim the controller if we own it
        if (roomRef && roomRef.controller && roomRef.controller.my) {
            roomRef.controller.unclaim();
        }

        // delete the room from the hive's memory
        if (Memory.hive && Memory.hive.rooms) {
            delete Memory.hive.rooms[roomName];
        }

        // delete the room memory
        Memory.rooms[roomName].type = undefined as any;

        return `Room ${roomName} has been unclaimed and removed from the hive.`;
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

    registerCommand('transferOrder', 'Creates a transfer order for the specified resource and amount to the target room.', { roomName: { req: true }, resourceType: { req: true }, amount: { req: true }, targetRoom: { req: true } }, function (roomName: string, resourceType: ResourceConstant, amount: number, targetRoom: string) {
        const roomMemory = Memory.rooms[roomName];
        if (!roomMemory) {
            return `No room found with name ${roomName}.`;
        }

        if (!roomMemory.transferOrders) {
            roomMemory.transferOrders = [];
        }

        // calculate transfer cost based on distance and amount
        const room = Game.rooms[roomName];
        const targetRoomRef = Game.rooms[targetRoom];

        if (!room || !targetRoomRef) {
            return `One or both rooms not found: ${roomName}, ${targetRoom}.`;
        }

        const cost = Game.market.calcTransactionCost(amount, roomName, targetRoom);

        if (amount + cost > 300000) {
            return `Transfer order exceeds maximum allowed amount of 300,000 (including transaction cost of ${cost}).`;
        }

        roomMemory.transferOrders.push({
            resource: resourceType,
            amount,
            target: targetRoom,
            type: 'export'
        });

        // processTransfers fills the terminal with transaction energy as part
        // of this order. A second export order would send that energy away.

        return `Transfer order for ${amount} ${resourceType} from room ${roomName} to room ${targetRoom} has been created.`;
    });

    registerCommand('setRoomType', 'Sets the specified room type to either "home" or "remote". If setting to "remote", a parent room must be specified.', { roomName: { req: true }, type: { req: true } }, function (roomName: string, type: 'home' | 'remote' | 'shill', parentRoom?: string) {
        const room = Game.rooms[roomName];
        if (!room) {
            return `No room found with name ${roomName}.`;
        }

        // reset the room to clear any existing tasks and spawn queue
        resetRoom(room);

        // set the room type to 'home' or 'shill'

        if (type === 'home' || type === 'shill') {
            Memory.rooms[roomName].type = type;
        } else if (type === 'remote') {
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

    registerCommand('help', 'Displays a list of all available CLI commands.', {}, function () {
        let helpText = '';
        for (const command in HELP_ENTRIES) {
            const entry = HELP_ENTRIES[command];
            helpText += `${command}(${Object.keys(entry.opts || {}).join(', ')}): ${entry.desc}\n`;
        }

        return helpText;
    });

    // hiveExpansion('E4S21', 'shard0', [['shard3', 'W0S20', '5c0e406c504e0a34e3d61df0'], ['shard2', 'W0S20', '59f1c0062b28ff65f7f2166f'], ['shard1', 'W0S20', '69f291863d008a3381151b1b']]);
    registerCommand('hiveExpansion', 'Sets a new hive expansion plan', { room: { req: true }, shard: { req: true }, portals: { req: true } }, function (room: string, shard: string, portals: [string, string, string][]) {
        if (!shard && !room && !portals) {
            Memory.hive.interShard.expansionPlan = undefined;
            Memory.hive.interShard.lastUpdated = Date.now();

            return `Hive expansion plan has been cleared.`;
        }

        const expansionPlan: HiveExpansionPlan = {
            portals,
            target: { shard, room },
            phase: 'settle',
            spawned: {}
        };

        if (!Memory.hive.interShard) {
            Memory.hive.interShard = {
                lastUpdated: 0,
            };
        }

        Memory.hive.interShard.expansionPlan = expansionPlan;
        Memory.hive.interShard.lastUpdated = Date.now();

        return `Hive expansion plan set for room ${room} on shard ${shard}.`;
    });

    // pixel generation command
    registerCommand('setPixelGen', 'Enables or disables pixel generation mode.', { enabled: { req: true } }, function (enabled: boolean) {
        Memory.pixelGen = enabled;

        if (enabled) {
            return `Pixel generation mode has been enabled.`;
        } else {
            return `Pixel generation mode has been disabled.`;
        }
    });

    registerCommand('resetAvoid', 'Resets the avoid properties for all rooms in the hive and room memory.', {}, function () {
        if (Memory.hive) {
            for (const roomName in Memory.hive.rooms) {
                const roomMemory = Memory.hive.rooms[roomName];
                if (roomMemory) {
                    roomMemory.hostile = false;
                }
            }

            for (const roomName in Memory.rooms) {
                const roomMemory = Memory.rooms[roomName];
                if (roomMemory) {
                    roomMemory.avoid = undefined;
                }
            }

            return `Avoid properties for all rooms have been reset.`;
        } else {
            return `Hive not found.`;
        }
    });

    registerCommand('setSpawnMultiplier', 'Sets the spawn energy multiplier for the specified room.', { roomName: { req: true }, multiplier: { req: true } }, function (roomName: string, multiplier: number) {
        const roomMemory = Memory.rooms[roomName];

        if (!roomMemory) {
            return `No room found with name ${roomName}.`;
        }

        roomMemory.spawnEnergyMultiplier = multiplier;

        return `Spawn energy multiplier for room ${roomName} has been set to ${multiplier}.`;
    });
}
