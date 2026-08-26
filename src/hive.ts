import { getRoleNameCounter } from './utils/Counter'
import { GLOBAL_CONTEXT } from './utils/Context';

export function isHighwayRoom(roomName: string) {
    let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
    if (!parsed) return false;
    let x = parseInt(parsed[1], 10);
    let y = parseInt(parsed[2], 10);
    return x % 10 === 0 || y % 10 === 0;
}

export function discoverRooms(roomName: string): void {
    // discover rooms that are within 12 linear range of a given room
    if (Game.map.getRoomLinearDistance(roomName, Memory.hive.scoutingRoom || Object.keys(Game.rooms)[0]) > 6) {
        return;
    }

    // get exists from room to add to known hive rooms
    const exitsInRoom = Game.map.describeExits(roomName);

    for (const exitDirection in exitsInRoom) {
        const exitRoomName = exitsInRoom[exitDirection as ExitKey];
        if (exitRoomName && !Memory.hive.rooms[exitRoomName]) {
            Memory.hive.rooms[exitRoomName] = {
                name: exitRoomName,
                shard: Game.shard.name,
                owner: null,
                hostile: false,
                lastScan: 0,
                highway: false
            };
        }
    }
}

export function scanRoom(room: Room): void {
    // we did not know about this room, so lets add it to the hive memory
    if (!Memory.hive.rooms[room.name]) {
        Memory.hive.rooms[room.name] = {
            name: room.name,
            shard: Game.shard.name,
            owner: null,
            hostile: false,
            lastScan: 0,
            highway: false
        };
    }

    // we have never been in this room before, so lets understand the exits
    if (Memory.hive.rooms[room.name].lastScan === 0 || Game.time - Memory.hive.rooms[room.name].lastScan > 1000) {
        Memory.hive.rooms[room.name].owner = room.controller?.owner?.username || null;
        Memory.hive.rooms[room.name].lastScan = Game.time;

        // is this room a highway room?
        Memory.hive.rooms[room.name].highway = isHighwayRoom(room.name);

        // if this room is not highway, check if hostile
        if (!Memory.hive.rooms[room.name].highway) {
            let hostileRoom = false;

            // check room for creeps with attacker parts, if we find any, mark the room as hostile
            const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
            for (const hostileCreep of hostileCreeps) {
                if (hostileCreep.body.some(part => part.type === ATTACK || part.type === RANGED_ATTACK)) {
                    hostileRoom = true;
                    break;
                }
            }

            // check room for towers or nukes
            const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
            for (const hostileStructure of hostileStructures) {
                if (hostileStructure.structureType === STRUCTURE_TOWER || hostileStructure.structureType === STRUCTURE_NUKER) {
                    hostileRoom = true;
                    break;
                }
            }

            Memory.hive.rooms[room.name].hostile = hostileRoom;
        } else {
            Memory.hive.rooms[room.name].hostile = false;
        }
    }

    discoverRooms(room.name);
}

export function runHiveScan() {
    // scan all current loaded rooms in the game
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        // skip rooms that could be invalid
        if (!room) continue;

        if (room.controller && room.controller.my) {
            // did we know about this room?
            if (!Memory.hive.rooms[roomName]) {
                scanRoom(room);
            } else {
                scanRoom(room);
            }
        }
    }

    // scan all rooms in the hive memory that we have not scanned recently
    for (const roomName in Memory.hive.rooms) {
        const roomMemory = Memory.hive.rooms[roomName];

        // if the room is marked as inaccessible, skip it
        if (roomMemory.inaccessible) continue;

        // if we have not scanned this room in the last 1000 ticks, scan it
        if (Game.time - roomMemory.lastScan > 1000) {
            // create a task in the hive task to scan this room
            const taskId = `scan-${roomName}`;
            Memory.hive.tasks[taskId] = {
                type: 'scan',
                roomId: roomName,
                shardId: Game.shard.name,
                targetId: '',
                priority: 1,
                expires: Game.time + 2000,
                assigned: null,
                completed: false
            };
        }
    }

    // remove expired tasks from the hive memory
    for (const taskId in Memory.hive.tasks) {
        const task = Memory.hive.tasks[taskId];
        if (Game.time > task.expires) {
            delete Memory.hive.tasks[taskId];
        }
    }

    // check if we have a current scout creep
    let hasScout = false;
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.memory.role === 'scout') {
            hasScout = true;
            break;
        }
    }

    // if we do not have a scout, spawn one only if we have scout tasks
    if (!hasScout) {
        let hasScoutTask = false;
        for (const taskId in Memory.hive.tasks) {
            const task = Memory.hive.tasks[taskId];
            if ((task.type === 'scan' || task.type === 'jump') && !task.assigned) {
                hasScoutTask = true;
                break;
            }
        }

        if (hasScoutTask) {
            // spawn a scout in the first room we own
            for (const roomName in Game.rooms) {
                const room = Game.rooms[roomName];
                if (room.controller && room.controller.my) {
                    const spawn = GLOBAL_CONTEXT[room.name]?.spawns[0];
                    if (spawn) {
                        const scoutName = `scout-${getRoleNameCounter('scout')}`;
                        const spawnResult = spawn.spawnCreep([MOVE], scoutName, { memory: { role: 'scout', room: room.name } });

                        if (spawnResult === OK) {
                            break;
                        }
                    }
                }
            }
        }
    }

    let hasTransporters = 0;
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.memory.role === 'transporter') {
            hasTransporters++;
        }
    }

    // check if we have a transporter task
    let hasTransportTask = false;
    let transportSrcRoom: string | undefined;
    let transportersNeeded = 1;

    for (const taskId in Memory.hive.tasks) {
        const task = Memory.hive.tasks[taskId];
        if (task.type === 'transport') {
            hasTransportTask = true;
            transportSrcRoom = task.roomId;
            transportersNeeded = Math.max(transportersNeeded, task.kv?.transporterCount || 0);
            break;
        }
    }

    if (hasTransportTask && transportersNeeded > hasTransporters) {
        const room = Game.rooms[transportSrcRoom || ''];
        if (room && room.controller && room.controller.my) {
            const spawn = GLOBAL_CONTEXT[room.name]?.spawns[0];
            if (spawn) {
                const transporterName = `transporter-${getRoleNameCounter('transporter')}`;
                spawn.spawnCreep([CARRY, CARRY, MOVE, MOVE, CARRY, CARRY, MOVE, MOVE], transporterName, { memory: { role: 'transporter', room: room.name } });
            }
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
            tasks: {},
            lastScan: 0
        };
    }

    // only run the hive logic every 100 ticks
    if (Game.time - Memory.hive.lastScan > 100) {
        // update the hive last scan time
        Memory.hive.lastScan = Game.time;

        // run the hive scan
        runHiveScan();
    }
}
