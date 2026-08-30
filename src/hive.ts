import { getRoleNameCounter } from './utils/Counter'
import { GLOBAL_CONTEXT } from './utils/Context';
import { getStoredEnergy } from 'rooms';
import { HiveIntershardData } from './types/hive';

const INTERSHARD_SYNC_INTERVAL = 25;
const INTERSHARD_HISTORY_TTL = 5000;

// Module globals survive between ticks in Screeps until the global is reset.
// Cache the serialized payload so unchanged inter-shard data does not pay for
// JSON.stringify + InterShardMemory.setLocal every sync pass.
let cachedInterShardSerialized: string | null = null;
let cachedInterShardUpdatedAt = -1;

function markInterShardUpdated(): void {
    Memory.hive.interShard.lastUpdated = Date.now();
}

function pruneInterShardHistory(): void {
    const interShard = Memory.hive.interShard;
    if (!interShard) {
        return;
    }

    const plan = interShard.expansionPlan;

    if (!plan || !plan.spawned) {
        return;
    }

    let changed = false;

    for (const creepName in plan.spawned) {
        const spawnRecord = plan.spawned[creepName];

        if (Game.time - spawnRecord.spawnedAt > INTERSHARD_HISTORY_TTL) {
            delete plan.spawned[creepName];

            if (interShard.portalsJumped?.[creepName]) {
                delete interShard.portalsJumped[creepName];
            }

            changed = true;
        }
    }

    if (changed) {
        markInterShardUpdated();
    }
}

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

export function spawnInRoom(role: string, body: BodyPartConstant[], limit: number = 1): void {
    let spawnedCount = 0;
    let spawnSuccess = false;

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        const roomStandbyEnergy = getStoredEnergy(GLOBAL_CONTEXT[room.name]);

        if (roomStandbyEnergy < 75000) {
            continue;
        }

        if (room.controller && room.controller.my) {
            for (const spawn of GLOBAL_CONTEXT[room.name].spawns) {
                if (spawn && !spawn.spawning) {
                    const roleName = `hive-${role}-${getRoleNameCounter(role)}`;
                    const spawnResult = spawn.spawnCreep(body, roleName, { memory: { role: role, room: room.name } });

                    debugLog(`Attempting to spawn ${roleName} in ${room.name}: ${spawnResult}`);

                    if (spawnResult === OK) {
                        console.log(`[HIVE] Spawned ${roleName} in ${room.name}`);

                        // reset portals jumped for this creep in inter-shard data
                        if (!Memory.hive.interShard.portalsJumped) {
                            Memory.hive.interShard.portalsJumped = {};
                        }
                        Memory.hive.interShard.portalsJumped[roleName] = [];

                        // Expansion spawn history is used to throttle future
                        // waves and also gives us a timestamp for pruning old
                        // portal-history records.
                        if (role === 'expansion' && Memory.hive.interShard.expansionPlan) {
                            const plan = Memory.hive.interShard.expansionPlan;
                            if (!plan.spawned) {
                                plan.spawned = {};
                            }
                            plan.spawned[roleName] = {
                                role,
                                spawnedAt: Game.time
                            };
                        }

                        markInterShardUpdated();

                        spawnSuccess = true;
                        spawnedCount++;
                        if (spawnedCount >= limit) {
                            return;
                        }
                    }
                }
            }
        }
    }

    if (!spawnSuccess) {
        console.log(`[HIVE] Failed to spawn ${role} in any room. All spawns are busy or insufficient energy.`);
    } else {
        console.log(`[HIVE] Spawned ${spawnedCount} ${role}(s) across available rooms.`);
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
            spawnInRoom('scout', [MOVE], 1);
        }
    }
}

export function runHiveExpansionPlan() {
    const plan = Memory.hive.interShard.expansionPlan;

    if (!plan) {
        return;
    }

    // Backwards-compatible migration for expansion plans created before the
    // spawn history field was populated by spawnInRoom.
    if (!plan.spawned) {
        plan.spawned = {};
    }

    // Find the most recent expansion spawn. The previous implementation keyed
    // this map by creep name and then looked up "expansion", which meant the
    // throttle never engaged.
    let lastExpansionSpawn = 0;

    for (const creepName in plan.spawned) {
        const creepData = plan.spawned[creepName];

        if (creepData.role === 'expansion' && creepData.spawnedAt > lastExpansionSpawn) {
            lastExpansionSpawn = creepData.spawnedAt;
        }
    }

    // if we have not spawned an expansion creep in the last 750 ticks, spawn one
    if (lastExpansionSpawn === 0 || Game.time - lastExpansionSpawn > 750) {
        console.log('Requesting new expansion creep to be spawned...');

        if (plan.phase === 'settle') {
            spawnInRoom('expansion', [CLAIM, MOVE, WORK, MOVE, CARRY, MOVE, ATTACK, MOVE], 1);
        } else if (plan.phase === 'build') {
            spawnInRoom('expansion', [WORK, MOVE, CARRY, MOVE, ATTACK, MOVE], 1);
        }
    }
}

export function syncHiveInterShard() {
    // set each shard we should iterate through and send the inter-shard data to
    const shards = ['shard0', 'shard1', 'shard2', 'shard3'];

    // get the local shard inter-shard data
    const localInterShardData: HiveIntershardData = Memory.hive.interShard;

    if (!localInterShardData) {
        console.error('Local inter-shard data is missing. Initializing...');
        Memory.hive.interShard = {
            lastUpdated: 0
        };

        return;
    }

    // Keep historical maps bounded before serializing them.
    pruneInterShardHistory();

    let newestInterShardDataFrom: string | null = null;
    let newestInterShardData: HiveIntershardData | null = null;
    let newestInterShardDataUpdatedAt: number = localInterShardData.lastUpdated;

    // loop through each shard to compare current shard data
    for (const shard of shards) {
        if (shard === Game.shard.name) {
            continue;
        }

        // get the raw inter-shard data from the other shard
        const interShardDataRaw = InterShardMemory.getRemote(shard);

        // if data does not exist on the other shard, skip it
        if (!interShardDataRaw) {
            continue;
        }

        let interShardData: HiveIntershardData;

        try {
            // parse the inter-shard data from the other shard
            interShardData = JSON.parse(interShardDataRaw);
        } catch (error) {
            console.error(`[HIVE] Failed to parse inter-shard data from ${shard}:`, error);
            continue;
        }

        // if the other shard's inter-shard data is newer, update the local inter-shard data
        if (interShardData.lastUpdated > newestInterShardDataUpdatedAt) {
            newestInterShardData = interShardData;
            newestInterShardDataFrom = shard;
            newestInterShardDataUpdatedAt = interShardData.lastUpdated;
        }
    }

    // if we found newer inter-shard data, update the local inter-shard data
    if (newestInterShardData) {
        console.info(`Syncing InterShard data from ${newestInterShardDataFrom} -> ${Game.shard.name}`);
        Memory.hive.interShard = newestInterShardData;
        cachedInterShardSerialized = null;
        cachedInterShardUpdatedAt = -1;
    }

    // Only stringify/write if the inter-shard version changed. setLocal data
    // persists, so repeatedly writing identical JSON just burns CPU.
    const interShardData = Memory.hive.interShard;
    if (cachedInterShardSerialized === null || cachedInterShardUpdatedAt !== interShardData.lastUpdated) {
        cachedInterShardSerialized = JSON.stringify(interShardData);
        cachedInterShardUpdatedAt = interShardData.lastUpdated;
        InterShardMemory.setLocal(cachedInterShardSerialized);
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

        return;
    }

    // Inter-shard state does not need tick-level freshness. Reducing this from
    // every 5 ticks to every 25 avoids repeated remote reads / JSON parsing.
    if (Game.time % INTERSHARD_SYNC_INTERVAL === 0) {
        // sync inter-shard data between shards
        syncHiveInterShard();
    }

    // only run the hive logic every 100 ticks
    if (Game.time - Memory.hive.lastScan > 100) {
        // update the hive last scan time
        Memory.hive.lastScan = Game.time;

        // run the local shard hive scan
        runHiveScan();

        // run the hive expansion plan
        runHiveExpansionPlan();
    }
}
