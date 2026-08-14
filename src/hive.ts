import { getRoleNameCounter } from './utils/Counter';

export function scanRoom(room: Room, creep: Creep): void {
    creep.say(`📸`);

    debugLog(`Scanning room ${room.name} for energy sources and other information.`);

    // scan the room for energy sources and update memory
    const energySources = room.find(FIND_SOURCES);
    const energySourceIds = energySources.map(source => source.id);

    // if the room if not far away from an existing room, lets add it as additional energy
    // source to be mined by a remote miner
    const nearbyRooms = Game.map.describeExits(room.name);
    const ownedRooms = Object.values(Game.rooms).filter(room => room.controller?.my);

    const nearbyOwnedRoom = Object.values(nearbyRooms || {}).find(nearbyRoomName => {
        return ownedRooms.some(ownedRoom => ownedRoom.name === nearbyRoomName);
    });

    if (nearbyOwnedRoom && nearbyOwnedRoom !== room.name) {
        // create a local room object for this room
        if (!Memory.rooms[room.name] || !Memory.rooms[room.name].type) {
            Memory.rooms[room.name] = {
                type: 'remote',
                lastScan: 0,
                energySources: energySourceIds,
                remoteEnergySources: {},
                childRooms: [],
                parentRoom: nearbyOwnedRoom,
                controllerLevel: undefined,
                tasks: {},
                spawnQueue: [],
                constructionPlanner: undefined,
                defenseMode: false,
                defenseModeActivatedAt: undefined
            };
        }

        // inform remote room that this room is nearby and has energy sources
        debugLog(`Room ${room.name} is near owned room ${nearbyOwnedRoom}. Adding energy sources to hive memory.`);

        if (!Memory.rooms[nearbyOwnedRoom].remoteEnergySources) {
            Memory.rooms[nearbyOwnedRoom].remoteEnergySources = {};
        }

        if (!Memory.rooms[nearbyOwnedRoom].childRooms) {
            Memory.rooms[nearbyOwnedRoom].childRooms = [];
        }

        if (!Memory.rooms[nearbyOwnedRoom].childRooms!.includes(room.name)) {
            Memory.rooms[nearbyOwnedRoom].childRooms!.push(room.name);
        }

        for (const sourceId of energySourceIds) {
            debugLog(`Adding energy source ${sourceId} from room ${room.name} to remoteEnergySources of room ${nearbyOwnedRoom}.`);

            Memory.rooms[nearbyOwnedRoom].remoteEnergySources![sourceId] = {
                room: room.name,
                id: sourceId
            };
        }
    }

    const roomMemory = Memory.hive.rooms[room.name];
    if (roomMemory) {
        roomMemory.lastScan = Game.time;
        roomMemory.energySources = energySourceIds;

        // check if the room is hostile
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        roomMemory.hostile = hostileCreeps.length > 0;

        // check if the room has an owner
        const controller = room.controller;
        if (controller && controller.owner) {
            roomMemory.owner = controller.owner.username;
        } else {
            roomMemory.owner = null;
        }
    } else {
        debugLog(`Room ${room.name} not found in hive memory. Initializing...`);
        Memory.hive.rooms[room.name] = {
            hostile: false,
            owner: null,
            lastScan: Game.time,
            energySources: energySourceIds,
            energyProfitability: 0,
            resourceType: null
        };
    }

    // get nearby rooms and add them to the hive memory
    for (const direction in nearbyRooms) {
        const nearbyRoomName = nearbyRooms[direction as ExitKey];

        const roomDistanceFromHome = Game.map.getRoomLinearDistance(room.name, creep.memory.room);

        if (nearbyRoomName && !Memory.hive.rooms[nearbyRoomName] && roomDistanceFromHome <= 4) {
            Memory.hive.rooms[nearbyRoomName] = {
                hostile: false,
                owner: null,
                lastScan: 0,
                energySources: [],
                energyProfitability: 0,
                resourceType: null
            };
        }
    }
}

/**
 * Hive acts as a hive mind, cordinating work between colonies.
 */
export function runHive() {
    if (!Memory.hive) {
        Memory.hive = {
            rooms: {},
            scouts: {},
            lastScan: 0
        };
    }

    console.log(`Hive running. Last scan was at tick ${Memory.hive.lastScan}. Current tick is ${Game.time}. (${Game.time - Memory.hive.lastScan} ticks since last scan)`);

    // only run the hive logic every 100 ticks
    if (Game.time - Memory.hive.lastScan > 100) {
        // update the hive last scan time
        Memory.hive.lastScan = Game.time;

        // scan all rooms in the game
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];

            // skip rooms that could be invalid
            if (!room) continue;

            if (!Memory.hive.rooms[roomName]) {
                Memory.hive.rooms[roomName] = {
                    hostile: false,
                    owner: null,
                    lastScan: 0,
                    energySources: [],
                    energyProfitability: 0,
                    resourceType: null
                };
            }
        }

        // rooms should be scanned every 100,000 ticks, so check if any rooms need to be scanned
        const roomsNeedingScan = Object.entries(Memory.hive.rooms).filter(([roomName, roomData]) => {
            console.log(`Checking if room ${roomName} needs to be scanned. Last scan was at tick ${roomData.lastScan}. Current tick is ${Game.time}.`);

            return Game.time - roomData.lastScan > 100000;
        });

        if (roomsNeedingScan.length > 0 && Object.keys(Memory.hive.scouts).length === 0) {
            // No scouts available, create a new one by finding a free spawn in all of our owned rooms
            const ownedRooms = Object.values(Game.rooms).filter(room => room.controller?.my);
            let spawnFound = false;

            for (const room of ownedRooms) {
                const spawns = room.find(FIND_MY_SPAWNS).filter(spawn => !spawn.spawning && room.energyAvailable >= 100);

                if (spawns.length > 0) {
                    const scoutCounter = getRoleNameCounter('scout');

                    const spawn = spawns[0];
                    const scoutName = `scout-${scoutCounter}`;
                    const spawnResult = spawn.spawnCreep([MOVE], scoutName, {
                        memory: { role: 'scout', room: room.name },
                    });

                    if (spawnResult === OK) {
                        debugLog(`Spawned new scout: ${scoutName} in room ${room.name}`);
                        Memory.hive.scouts[scoutName] = { assigned: roomsNeedingScan[0][0] }; // Assign the first room needing scan
                        spawnFound = true;
                        break;
                    } else {
                        debugLog(`Failed to spawn scout in room ${room.name}. Error code: ${spawnResult}`);
                    }
                }
            }

            if (!spawnFound) {
                debugLog('No available spawns to create a new scout.');
            }
        }
    }
}