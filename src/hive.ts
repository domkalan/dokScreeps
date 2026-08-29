import { getRoleNameCounter } from './utils/Counter'
import { GLOBAL_CONTEXT } from './utils/Context';
import { getStoredEnergy } from 'rooms';
import { HiveIntershardData } from './types/hive';

export function isHighwayRoom(roomName: string) {
    let parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
    if (!parsed) return false;
    let x = parseInt(parsed[1], 10);
    let y = parseInt(parsed[2], 10);
    return x % 10 === 0 || y % 10 === 0;
}

function setTravelerRoomAvoidance(roomName: string, avoid: boolean): void {
    if (!Memory.rooms) {
        Memory.rooms = {};
    }

    const travelerRoomMemory = Memory.rooms[roomName] ||
        (Memory.rooms[roomName] = {} as RoomMemory);
    travelerRoomMemory.avoid = avoid;
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

    const roomMemory = Memory.hive.rooms[room.name];
    roomMemory.owner = room.controller?.owner?.username || null;
    roomMemory.lastScan = Game.time;
    roomMemory.highway = isHighwayRoom(room.name);

    // A claimed room owned by somebody else is unsafe even if its defensive
    // creeps and towers are not currently visible in the arrays below.
    let hostileRoom = !!room.controller?.owner && !room.controller.my;

    if (!hostileRoom) {
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        for (const hostileCreep of hostileCreeps) {
            if (hostileCreep.getActiveBodyparts(ATTACK) > 0 ||
                hostileCreep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                hostileCreep.getActiveBodyparts(WORK) > 0) {
                hostileRoom = true;
                break;
            }
        }
    }

    if (!hostileRoom) {
        const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
        for (const hostileStructure of hostileStructures) {
            if (hostileStructure.structureType === STRUCTURE_TOWER ||
                hostileStructure.structureType === STRUCTURE_NUKER) {
                hostileRoom = true;
                break;
            }
        }
    }

    roomMemory.hostile = hostileRoom;

    // BonzAI Traveler's default route callback reads Memory.rooms[name].avoid.
    // Keeping the flag here makes every travelTo call avoid scanned hostile
    // rooms without allocating a routeCallback in each creep role.
    setTravelerRoomAvoidance(room.name, hostileRoom);

    // A successful scan proves that a previously timed-out room is reachable.
    if (roomMemory.inaccessible) {
        delete roomMemory.inaccessible;
    }

    discoverRooms(room.name);
}

export function syncHiveData(): void {
    const otherShards = ['shard0', 'shard1', 'shard2', 'shard3'].filter(shard => shard !== Game.shard.name);
    let recentIntershard: HiveIntershardData | undefined = Memory.hive.interShard;
    let recentShard: string | undefined = undefined;

    for (const shard of otherShards) {
        // skip the current shard
        if (Game.shard.name === shard) {
            continue;
        }

        const rawMemory = InterShardMemory.getRemote(shard);
        if (!rawMemory) {
            continue;
        }

        const parsedMemory = JSON.parse(rawMemory) as Memory;

        if (parsedMemory.hive && parsedMemory.hive.interShard) {
            if (!recentIntershard || parsedMemory.hive.interShard.lastUpdated > recentIntershard.lastUpdated) {
                recentIntershard = parsedMemory.hive.interShard;
                recentShard = shard;
            }
        }
    }

    if (recentIntershard && recentShard) {
        console.log(`[HIVE][Sync] Updating hive intershard data from shard ${recentShard} with lastUpdated ${recentIntershard.lastUpdated}`);

        Memory.hive.interShard = recentIntershard;
    }
}

export function colonizePlanExists(): boolean {
    const otherShards = ['shard0', 'shard1', 'shard2', 'shard3'].filter(shard => shard !== Game.shard.name);
    let planExists: boolean = false;

    for (const shard of otherShards) {
        const rawMemory = InterShardMemory.getRemote(shard);

        if (!rawMemory) {
            continue;
        }

        const parsedMemory = JSON.parse(rawMemory) as Memory;

        if (parsedMemory.hive && parsedMemory.hive.interShard && parsedMemory.hive.interShard.colonizePlan) {
            planExists = true;
            break;
        }
    }

    return planExists;
}

export function runHiveColonizePlan() {
    // check if we have a hive colonize plan
    if (!Memory.hive.interShard.colonizePlan) {
        return;
    }

    // if room is in spawning mode, check if we have spawned a scout
    if (Memory.hive.interShard.colonizePlan.phase === 'colonize' && (Memory.hive.interShard.colonizePlan.creepsSpawned['hive-colonizer'] === undefined || Memory.hive.interShard.colonizePlan.creepsSpawned['hive-colonizer'] < Game.time)) {
        // spawn a hive grade colonizer in the owning room
        const owningRoom = Game.rooms[Memory.hive.interShard.colonizePlan.owningRoom];
        if (owningRoom && owningRoom.controller && owningRoom.controller.my) {
            const spawn = GLOBAL_CONTEXT[owningRoom.name]?.spawns[0];
            if (spawn) {
                const colonizerName = `hive-colonizer-${getRoleNameCounter('hiveColonizer')}`;
                const spawnResult = spawn.spawnCreep([MOVE, CLAIM], colonizerName, { memory: { role: 'hiveColonizer', room: owningRoom.name } });

                if (spawnResult === OK) {
                    Memory.hive.interShard.colonizePlan.creepsSpawned['hive-colonizer'] = Game.time + 600; // add a cooldown to prevent spawning too many colonizers

                    // initialize the portalsJumped map if it doesn't exist
                    if (!Memory.hive.interShard.portalsJumped) {
                        Memory.hive.interShard.portalsJumped = {};
                    }

                    // reset the portalsJumped array for this colonizer
                    if (!Memory.hive.interShard.portalsJumped[colonizerName]) {
                        Memory.hive.interShard.portalsJumped[colonizerName] = [];
                    }
                }
            }
        }
    }

    // if the room is in bootstrap mode, check if we have spawned a hive grade builder
    if (Memory.hive.interShard.colonizePlan.phase === 'bootstrap' && (Memory.hive.interShard.colonizePlan.creepsSpawned['hive-builder'] === undefined || Memory.hive.interShard.colonizePlan.creepsSpawned['hive-builder'] < Game.time)) {
        // spawn a hive grade builder in any of our rooms that we own
        for (const roomName in Game.rooms) {
            const owningRoom = Game.rooms[roomName];

            if (owningRoom && owningRoom.controller && owningRoom.controller.my) {
                const spawn = GLOBAL_CONTEXT[owningRoom.name]?.spawns[0];

                if (spawn) {
                    const builderName = `hive-builder-${getRoleNameCounter('hiveBuilder')}`;
                    const spawnResult = spawn.spawnCreep([WORK, CARRY, MOVE, MOVE, WORK, CARRY, MOVE], builderName, { memory: { role: 'hiveBuilder', room: owningRoom.name } });

                    if (spawnResult === OK) {
                        Memory.hive.interShard.colonizePlan.creepsSpawned['hive-builder'] = Game.time + 200; // add a cooldown to prevent spawning too many builders

                        // initialize the portalsJumped map if it doesn't exist
                        if (!Memory.hive.interShard.portalsJumped) {
                            Memory.hive.interShard.portalsJumped = {};
                        }

                        // reset the portalsJumped array for this builder
                        if (!Memory.hive.interShard.portalsJumped[builderName]) {
                            Memory.hive.interShard.portalsJumped[builderName] = [];
                        }
                    }
                }
            }
        }
    }

    // if the room is in bootstrap mode, check if we have spawned a hive grade builder
    if (Memory.hive.interShard.colonizePlan.phase === 'defend' && (Memory.hive.interShard.colonizePlan.creepsSpawned['hive-agent'] === undefined || Memory.hive.interShard.colonizePlan.creepsSpawned['hive-agent'] < Game.time)) {
        // spawn a hive grade builder in any of our rooms that we own
        for (const roomName in Game.rooms) {
            const owningRoom = Game.rooms[roomName];

            if (owningRoom && owningRoom.controller && owningRoom.controller.my) {
                const spawn = GLOBAL_CONTEXT[owningRoom.name]?.spawns[0];

                if (spawn) {
                    const agentName = `hive-agent-${getRoleNameCounter('hiveAgent')}`;
                    const spawnResult = spawn.spawnCreep([MOVE, ATTACK, MOVE, ATTACK], agentName, { memory: { role: 'hiveAgent', room: owningRoom.name } });

                    if (spawnResult === OK) {
                        Memory.hive.interShard.colonizePlan.creepsSpawned['hive-agent'] = Game.time + 200; // add a cooldown to prevent spawning too many agents

                        // initialize the portalsJumped map if it doesn't exist
                        if (!Memory.hive.interShard.portalsJumped) {
                            Memory.hive.interShard.portalsJumped = {};
                        }


                        // reset the portalsJumped array for this agent
                        if (!Memory.hive.interShard.portalsJumped[agentName]) {
                            Memory.hive.interShard.portalsJumped[agentName] = [];
                        }
                    }
                }
            }
        }
    }

    // if the plan is finalized, we can set it to undefined
    if (Memory.hive.interShard.colonizePlan.phase === 'finished') {
        Memory.hive.interShard.colonizePlan = undefined;
    }
}

export function runHiveScan() {
    // Refresh every visible room. This clears Traveler's avoid flag promptly
    // after a transient threat leaves and also covers rooms visible to remote
    // workers, not only owned rooms.
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        // skip rooms that could be invalid
        if (!room) continue;

        scanRoom(room);
    }

    // scan all rooms in the hive memory that we have not scanned recently
    for (const roomName in Memory.hive.rooms) {
        const roomMemory = Memory.hive.rooms[roomName];

        // Migrate existing scout data to Traveler even when the room is not
        // currently visible. A later successful scan clears stale avoidance.
        setTravelerRoomAvoidance(roomName, roomMemory.hostile);

        // if the room is marked as inaccessible, skip it
        if (roomMemory.inaccessible) continue;

        // if we have not scanned this room in the last 1000 ticks, scan it
        if (Game.time - roomMemory.lastScan > 1000) {
            // create a task in the hive task to scan this room
            const taskId = `scan-${roomName}`;
            const existingTask = Memory.hive.tasks[taskId];
            if (existingTask && !existingTask.completed && Game.time <= existingTask.expires) {
                continue;
            }

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
                const roomStandbyEnergy = getStoredEnergy(GLOBAL_CONTEXT[room.name]);

                if (roomStandbyEnergy < 75000) {
                    continue;
                }

                if (room.controller && room.controller.my) {
                    const spawn = GLOBAL_CONTEXT[room.name]?.spawns[0];
                    if (spawn) {
                        const scoutName = `hive-scout-${getRoleNameCounter('scout')}`;
                        const spawnResult = spawn.spawnCreep([MOVE], scoutName, { memory: { role: 'scout', room: room.name } });

                        if (spawnResult === OK) {
                            break;
                        }
                    }
                }
            }
        }
    }

    // check if we have valid creeps for portal jumps
    for (const creepStoreName in Memory.hive.interShard.portalsJumped || {}) {
        const creep = Game.creeps[creepStoreName];

        if (!creep) {
            delete Memory.hive.interShard.portalsJumped![creepStoreName];
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
            interShard: {
                lastUpdated: 0
            },
            lastScan: 0
        };

        syncHiveData();

        return;
    }

    // sync intershard data every 2 ticks
    if (Game.time % 2 === 0 || Game.time - Memory.hive.interShard.lastUpdated > 100) {
        syncHiveData();
    }

    // only run the hive logic every 100 ticks
    if (Game.time - Memory.hive.lastScan > 100) {
        // update the hive last scan time
        Memory.hive.lastScan = Game.time;

        // run the local shard hive scan
        runHiveScan();

        // run the hive colonization logic
        runHiveColonizePlan();

        // set the local shard memory for future comparison with other shards
        InterShardMemory.setLocal(JSON.stringify({
            hive: {
                interShard: Memory.hive.interShard
            }
        }));
    }
}
