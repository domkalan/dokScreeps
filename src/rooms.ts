import { runTower } from "tower";
import { CREEP_COUNTS } from "creeps";

import { ConstructionPlanner } from "constructionPlanner";
import { createBasicRoomPlan } from "plans/basic";

import { buildRoomContext, RoomContext, GLOBAL_CONTEXT, CONTEXT_CACHE } from "utils/Context";
import { getRoleNameCounter } from "utils/Counter";
import { createTask, getTaskCounts, monitorTasks } from "utils/TaskManager";
import * as perfTracking from "utils/PerformanceTracking";

export let ROOM_TOTAL_CPU: number = 0;
export let ROOM_CPU: { [roomName: string]: number } = {};

// get stored energy in the room from storage and containers
export function getStoredEnergy(context: RoomContext): number {
    return context.storedEnergy;
}

// append more body parts depending on available energy and role
function getCreepBodyParts(room: Room, role: string, context: RoomContext): [BodyPartConstant[], number] {
    let baseBody: BodyPartConstant[] = [WORK, CARRY, MOVE];
    let energyUsed: number = 200;

    // adjust energy available based on stored energy in the room
    let energyAvailable = room.energyAvailable * 0.75;

    // if defender, we need a different base body
    if (role === 'defender' || role === 'attacker') {
        baseBody = [ATTACK, MOVE];
        energyUsed = 130; // ATTACK + MOVE costs 130 energy
    } else if (role === 'claimer') {
        baseBody = [CLAIM, MOVE];
        energyUsed = 630; // CLAIM + MOVE costs 630 energy
    } else if (role === 'hauler' || role === 'filler') {
        baseBody = [WORK, CARRY, MOVE];
        energyUsed = 200; // WORK + CARRY + MOVE costs 200 energy
    }

    // Create an array of additional body parts based on the role
    const additionalParts: BodyPartConstant[] = [];
    while (true) {
        let nextParts: BodyPartConstant[] = [];

        if (role === 'harvester') {
            if (additionalParts.length >= 4) {
                break; // Limit harvesters to 5 WORK parts
            }

            nextParts = [WORK];
        } else if (role === 'builder') {
            nextParts = [WORK, CARRY, MOVE];
        } else if (role === 'queen' || role === 'hauler' || role === 'filler') {
            nextParts = [CARRY, MOVE];
        } else if (role === 'defender' || role === 'attacker') {
            nextParts = [TOUGH, MOVE, ATTACK];
        } else {
            break;
        }

        const nextCost = nextParts.reduce(
            (total, part) => total + BODYPART_COST[part],
            0
        );

        if (
            energyUsed + nextCost > energyAvailable ||
            baseBody.length + additionalParts.length + nextParts.length > 50
        ) {
            break;
        }

        additionalParts.push(...nextParts);
        energyUsed += nextCost;
    }

    return [baseBody.concat(additionalParts), energyUsed];
}

// get the ideal number of creeps that should exist
function getIdealCreepCount(room: Room, context: RoomContext, roleCounts: { [role: string]: number }): { [role: string]: { count: number, priority: number } } {
    const roomControlLevel = context.room.controller?.level || 0;
    const taskCounts = getTaskCounts(room);

    const idealCounts: { [role: string]: { count: number, priority: number } } = {
        harvester: { count: taskCounts.harvester, priority: 0 },
        builder: { count: 1, priority: 10 }, // builders are important, but not as critical as harvesters, medium priority
        queen: { count: 1, priority: 2.5 }, // always have one queen, low priority since we don't need it until later,
        hauler: { count: 1, priority: 5 }, // always have one hauler, medium priority
        claimer: { count: 0, priority: 10 }, // only spawn a claimer if we have a claim task, medium priority
        defender: { count: 0, priority: 10 }, // only spawn a defender if we have a hostile, medium priority
        attacker: { count: 0, priority: 10 }, // only spawn an attacker if we have an attack task, medium priority,
        scout: { count: 0, priority: 10 }, // only spawn a scout if we have a remote room to scout, medium priority,
        filler: { count: 0, priority: 15 } // filler creeps are only spawned if we have a fill task and sufficient energy, medium priority
    };

    // if we have more than 10 builder tasks, spawn more builders, but not more than the room control level
    if (Math.min(Math.floor(taskCounts.builder / 2), roomControlLevel) > idealCounts.builder.count) {
        idealCounts.builder.count = Math.min(Math.floor(taskCounts.builder / 2), roomControlLevel);
        idealCounts.builder.priority = 5;
    }

    // remote harvester spawning
    if (roleCounts.harvester && roleCounts.harvester >= room.memory.energySources.length) {
        idealCounts.harvester.priority = 5; // if we have enough haulers, lower the priority
    }

    // 2 tasks per hauler, if we have more than 100 tasks per hauler, increase the priority of haulers
    if (Math.min(Math.floor(taskCounts.hauler / 4), roomControlLevel) > idealCounts.hauler.count) {
        // increase the number of haulers to match the number of tasks, but not more than the room control level
        idealCounts.hauler.count = Math.min(Math.floor(taskCounts.hauler / 4), roomControlLevel);
        // increase the priority of haulers to 5 if we have more than 2 tasks per hauler
        idealCounts.hauler.priority = 5;
    }

    // if we have any filler jobs, spawn a filler creep if we have enough energy
    if (Math.max(taskCounts.filler + taskCounts.filler, 1) > idealCounts.filler.count && getStoredEnergy(context) > 50000) {
        // increase the number of fillers to match the number of tasks, but not more than the room control level
        idealCounts.filler.count = 1;
    }

    if (taskCounts.claimer > 0 && getStoredEnergy(context) > 10000) {
        idealCounts.claimer.count = taskCounts.claimer;
        idealCounts.claimer.priority = 7.5; // if we have claim tasks, increase the priority of claimers
    }

    // if we have attack tasks, spawn attackers
    if (taskCounts.attacker > 0) {
        idealCounts.attacker.count = taskCounts.attacker;
        idealCounts.attacker.priority = 1; // if we have attack tasks, increase the priority of attackers

        if (idealCounts.attacker.count > roomControlLevel) {
            idealCounts.attacker.count = roomControlLevel; // limit the number of attackers to the room control level
        }
    }

    return idealCounts;
}

// monitor creeps count and log if any role is underrepresented
function monitorCreepRoles(room: Room, context: RoomContext): void {
    if (!CREEP_COUNTS[room.name]) {
        debugLog(`No creeps found in room ${room.name}. Skipping role monitoring.`);

        return; // no creeps in this room, nothing to monitor
    }

    const idealCounts = getIdealCreepCount(room, context, CREEP_COUNTS[room.name]!);

    for (const role in idealCounts) {
        const idealCount = idealCounts[role];
        const actualCount = CREEP_COUNTS[room.name]?.[role] || 0;

        if (actualCount < idealCount.count && !room.memory.spawnQueue.some(entry => entry.role === role)) {
            debugLog(`Room ${room.name} has ${actualCount} ${role}s, but ideally should have ${idealCount.count}. Adding to spawn queue.`);
            room.memory.spawnQueue.push({ role, priority: idealCount.priority });
        }
    }

    // clean up the spawn queue to remove any roles that are no longer needed
    const nextSpawnQueue: typeof room.memory.spawnQueue = [];
    for (const entry of room.memory.spawnQueue) {
        const ideal = idealCounts[entry.role];

        if (!ideal) {
            continue;
        }

        const actual = CREEP_COUNTS[room.name]?.[entry.role] || 0;
        if (actual < ideal.count) nextSpawnQueue.push(entry);
    }
    room.memory.spawnQueue = nextSpawnQueue;

    // if the spawn queue has roles, and the room has energy
    if (room.memory.spawnQueue.length > 0 && room.energyAvailable > 150) {
        // Sort the spawn queue by priority (lower number = higher priority)
        room.memory.spawnQueue.sort((a, b) => a.priority - b.priority);

        // Get the highest priority role to spawn
        const nextRoleToSpawn = room.memory.spawnQueue.shift();

        if (nextRoleToSpawn) {
            {
                const [spawnSuccess, creepName] = spawnCreep(room, nextRoleToSpawn.role, context);

                if (!spawnSuccess) {
                    debugLog(`Failed to spawn ${nextRoleToSpawn.role} in room ${room.name}. Re-adding to spawn queue.`);
                    room.memory.spawnQueue.push(nextRoleToSpawn); // re-add to the queue if spawning failed
                } else if (spawnSuccess === true) {
                    debugLog(`Successfully spawned ${nextRoleToSpawn.role} in room ${room.name}.`);

                    // add creep name to room creep cache
                    CONTEXT_CACHE[room.name].cache.myCreeps.push(creepName);
                }
            }
        }
    }
}

// spawn a creep for a given role in a room
function spawnCreep(room: Room, role: string, context: RoomContext): [true, string] | [false, null] {
    // Log the spawning action
    debugLog(`Spawning new creep with role: ${role}`);

    let spawn: StructureSpawn | undefined;
    for (const candidate of context.spawns) {
        if (!candidate.spawning) {
            spawn = candidate;
            break;
        }
    }

    if (spawn) {
        // Define a basic body for the new creep
        const [body, bodyEnergy] = getCreepBodyParts(room, role, context);
        const roleCounter = getRoleNameCounter(role);
        const creepName = `${role}-${roleCounter}`;

        // Attempt to spawn the new creep
        const spawnResult = spawn.spawnCreep(body, creepName, {
            memory: { role, room: room.name },
        });

        if (spawnResult === OK) {
            debugLog(`Successfully spawned new creep: ${creepName} with role: ${role}`);

            return [true, creepName];
        } else if (spawnResult === ERR_NOT_ENOUGH_ENERGY) {
            debugLog(`Not enough energy to spawn ${creepName} with role: ${role}. Required: ${body.reduce((sum, part) => sum + BODYPART_COST[part], 0)}, Available: ${room.energyAvailable}`);

            return [false, null];
        }

        debugLog(`Failed to spawn ${creepName} with role: ${role}. Error code: ${spawnResult}`);
    } else {
        debugLog(`No available spawns in room ${room.name} to spawn new creeps.`);
    }

    return [false, null];
}

// scan a room for energy sources and update its memory
function scanRoom(room: Room, context: RoomContext): void {
    debugLog(`Scanning room ${room.name}`);

    // Update the last scan time
    room.memory.lastScan = Game.time;

    // update hive with last scan time
    if (Memory.hive.rooms[room.name]) {
        Memory.hive.rooms[room.name].lastScan = Game.time;
    }

    // Scan for energy sources in the room
    room.memory.energySources = context.sources.map(source => source.id);

    if (!room.memory.energyThresholdMet) {
        // create a harvest task for each energy source
        for (const source of context.sources) {
            createTask(room, 'harvest', source.id, 1);
        }

        // process any nearby remote energy sources and create tasks for them if they are not already in memory
        for (const source in room.memory.remoteEnergySources) {
            const remoteSource = room.memory.remoteEnergySources[source];

            createTask(room, 'harvest', source, 10, remoteSource.room); // low priority for remote harvesting
        }
    }

    // create a task for upgrading the controller if it exists
    if (room.controller && room.controller.my) {
        if (room.controller.ticksToDowngrade < 5000) {
            debugLog(`Controller in room ${room.name} is close to downgrading. Creating upgrade task.`);

            createTask(room, 'build', room.controller.id, 0); // high priority for upgrading the controller
        }
    }

    // if the controller level has changed, log it
    if (room.controller && room.controller.level !== room.memory.controllerLevel) {
        debugLog(`Controller in room ${room.name} has leveled up from ${room.memory.controllerLevel} to ${room.controller.level}`);
    }

    // if the construction planner is enabled and there is no plan, create a basic plan
    if (room.memory.constructionPlanner && room.memory.constructionPlanner.plan.length === 0) {
        ConstructionPlanner.setPlan(room, createBasicRoomPlan(room, context.spawns[0]));
    }

    // run the construction planner for the room
    // TODO: make this return a list of tasks to create
    ConstructionPlanner.run(room, context);

    // review structures that are low on health and create a build task to repair
    for (const structure of context.regularRepairTargets) {
        createTask(room, 'build', structure.id, 1); // high priority for repairing structures
    }

    // review walls and ramparts that are low on health and create a build task to repair
    const defenseRepair: Structure[] = [];
    for (const structure of context.defenseStructures) {
        if (((structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) &&
            structure.hits < (room.controller?.level || 0) * 10000) ||
            (structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax * 0.25)) {
            defenseRepair.push(structure);
        }
    }
    defenseRepair.sort((a, b) => a.hits - b.hits);

    for (const defense of defenseRepair) {
        createTask(room, 'build', defense.id, defense.hits < 1000 ? 0 : 5, undefined, undefined, 110); // high priority for repairing walls and ramparts
    }

    // add an ultra-low priority task to maintain the rooms controller
    createTask(room, 'build', room.controller?.id || '', 100, undefined, undefined, 120); // ultra-low priority for maintaining the controller

    // find ruins and tombstones that have resources in them and create a task to haul from them
    for (const ruin of context.ruins) {
        if (ruin.store.getUsedCapacity() < 100) continue;
        for (const resourceType in ruin.store) {
            if (resourceType === RESOURCE_ENERGY) {
                // only worth if there is at least 100 energy in the ruin
                if (ruin.store[resourceType] < 100) {
                    continue;
                }

                // create a medium priority task to haul energy from ruins and tombstones
                createTask(room, 'haul', ruin.id + '_' + resourceType, 5, room.name, undefined, 105, resourceType as ResourceConstant); // medium priority for hauling energy from ruins and tombstones

                continue;
            }

            // create a high priority task to haul other resources from ruins and tombstones
            createTask(room, 'haul', ruin.id + '_' + resourceType, 0, room.name, undefined, 105, resourceType as ResourceConstant); // medium priority for hauling from ruins and tombstones
        }
    }

    // we should attempt to pick up any dropped resources in the room, but only if they are above a certain threshold
    for (const resource of context.resources) {
        if (resource.amount <= 50) continue;
        if (resource.resourceType === RESOURCE_ENERGY && resource.amount > 100) {
            // medium priority for hauling dropped resources
            createTask(room, 'haul', resource.id, 5, room.name, undefined, 105, resource.resourceType);
        } else if (resource.resourceType !== RESOURCE_ENERGY) {
            // high priority for hauling dropped resources
            createTask(room, 'haul', resource.id, 0, room.name, undefined, 105, resource.resourceType);
        }
    }

    // request containers with 25% fill to be hauled to parent room
    for (const container of context.containers) {
        if (container.store.getUsedCapacity(RESOURCE_ENERGY) <= container.store.getCapacity(RESOURCE_ENERGY) * 0.25) continue;
        createTask(room, 'haul', container.id, 10, room.name, undefined, 105, RESOURCE_ENERGY); // medium priority for hauling from remote containers
    }

    // get all spawns and extensions that are not full and create a fill task for them
    for (const structure of context.spawnEnergyReceivers) {
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0) continue;
        createTask(room, 'fill', structure.id, 5, room.name); // medium priority for filling spawns and extensions
    }

    // get total count of stored energy from storage if it exists
    const storedEnergy = getStoredEnergy(context);

    if (storedEnergy > 250000 && !room.memory.energyThresholdMet && !room.memory.energyThresholdOverride) {
        room.memory.energyThresholdMet = true;
    } else if (storedEnergy < 75000 && room.memory.energyThresholdMet) {
        room.memory.energyThresholdMet = false;
    }

    debugLog(`Room ${room.name} scanned. Found ${context.sources.length} energy sources.`);
}

export function resetRoom(room: Room): void {
    if (!room.memory) {
        room.memory = {
            type: 'home',
            parentRoom: null,
            tasks: {},
            lastScan: 0,
            energySources: [],
            controllerLevel: 0,
            spawnQueue: [],
            defenseMode: false,
        };
    }

    room.memory.tasks = {};
    room.memory.spawnQueue = [];
    room.memory.lastScan = 0;
    room.memory.defenseMode = false;

    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.memory.room === room.name) {
            creep.memory.taskId = undefined;
        }
    }

    debugLog(`Room ${room.name} has been reset.`);
}

export function runTowers(room: Room, context: RoomContext, managingRoom?: Room): void {
    if (context.storedEnergy >= 50000 && context.towerRepairTargets.length > 1) {
        let canRepair = false;
        for (const tower of context.towers) {
            if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= tower.store.getCapacity(RESOURCE_ENERGY) * 0.75) {
                canRepair = true;
                break;
            }
        }
        if (canRepair) context.towerRepairTargets.sort((a, b) => a.hits - b.hits);
    }

    let towerCount = 0;
    for (const tower of context.towers) {
        runTower(tower, context, managingRoom || room, towerCount);
        towerCount++;
    }
}

// defense mode override for a room if hostiles are detected
function runColonyDefense(room: Room, context: RoomContext): void {
    // get total length of defenders from context
    const defenders = context.creepsByRole.defender || [];
    const hostiles = context.hostiles;

    debugLog(`Hostiles detected in room ${room.name}: ${hostiles.map(h => h.name).join(', ')}`);

    // set room to defense mode
    if (!room.memory.defenseMode) {
        room.memory.defenseMode = true;
        room.memory.defenseModeActivatedAt = Game.time;

        debugLog(`Room ${room.name} is now in defense mode.`);
    }

    // if we have no defenders, queue a defender to be spawned
    if (defenders.length < (hostiles.length + 2)) { // add a buffer of 2 to ensure we have enough defenders
        debugLog(`No defenders present in room ${room.name}. Queuing a defender to be spawned.`);

        spawnCreep(room, 'defender', context);
    }

    for (const structure of context.energyReceivers) {
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0) continue;
        createTask(room, 'fill', structure.id, 5); // medium priority for filling structures
    }

    // have harvesters continue to harvest
    for (const source of context.sources) {
        createTask(room, 'harvest', source.id, 1); // high priority for harvesting
    }

    runTowers(room, context);
}

// run colony logic for a given room
function runColony(room: Room): void {
    debugLog(`Running colony logic for room ${room.name}`);

    // monitor tasks for the room
    monitorTasks(room);

    // get room context
    const context = GLOBAL_CONTEXT[room.name];

    // if we have hostiles, the room goes into defensive mode and we need to spawn defenders if we don't have enough
    if (context.hostiles.length > 0 || room.memory.defenseMode === true && room.memory.defenseModeActivatedAt && Game.time - room.memory.defenseModeActivatedAt < 100) {
        runColonyDefense(room, context);

        return;
    } else if (context.hostiles.length === 0 && room.memory.defenseMode) {
        debugLog(`Room ${room.name} is no longer under threat. Exiting defense mode.`);

        resetRoom(room);

        return;
    }

    // Check if the room needs to be scanned
    if (room.memory.lastScan === undefined || Game.time - room.memory.lastScan > 100) {
        // scan the room
        scanRoom(room, context);
    }

    // every 10 ticks, we should transfer energy from links to the link closet to storage
    if (Game.time % 10 === 0 && room.memory.storageLink) {
        for (const link of context.links) {
            // if the link is the storage link, request haul if full
            if (link.id === room.memory.storageLink && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                createTask(room, 'haul', link.id, 0, room.name, undefined, 105, RESOURCE_ENERGY);

                continue; // skip the storage link
            }

            if (link.store.getUsedCapacity(RESOURCE_ENERGY) < 400) {
                continue;
            }

            // all child links should transfer energy to the storage link
            const transferResult = link.transferEnergy(Game.getObjectById(room.memory.storageLink) as StructureLink);

            if (transferResult === OK) {
                debugLog(`Transferred energy from link ${link.id} to storage link ${room.memory.storageLink} in room ${room.name}.`);
            } else {
                debugLog(`Failed to transfer energy from link ${link.id} to storage link ${room.memory.storageLink} in room ${room.name}. Error code: ${transferResult}`);
            }
        }
    }

    // monitor the roles of creeps in the room
    monitorCreepRoles(room, context);

    // run all towers
    runTowers(room, context);
}

function scanRemoteRoom(room: Room, context: RoomContext, parentRoom: Room): void {
    debugLog(`Scanning remote room ${room.name}`);

    // Update the last scan time
    room.memory.lastScan = Game.time;

    // update hive with last scan time
    if (Memory.hive.rooms[room.name]) {
        Memory.hive.rooms[room.name].lastScan = Game.time;
    }

    // pickup all dropped resources
    if (context.resources.length > 0) {
        for (const resource of context.resources) {
            if (resource instanceof Resource && resource.amount > 50) {
                createTask(parentRoom, 'haul', resource.id, 5, room.name, undefined, 200, resource.resourceType); // medium priority for hauling from remote rooms
            }
        }
    }

    // extract energy from ruins if they have any
    if (context.ruins.length > 0) {
        for (const ruin of context.ruins) {
            for (const resourceType in ruin.store) {
                // create a high priority task to haul other resources from ruins and tombstones
                createTask(parentRoom, 'haul', ruin.id + '_' + resourceType, 0, room.name, undefined, 105, resourceType as ResourceConstant); // medium priority for hauling from ruins and tombstones
            }
        }
    }

    // if the container is at cooldown, we should create a task to fill it with energy from the parent room
    if (context.room.controller && context.room.controller.my) {
        debugLog(`Controller in remote room ${room.name} is close to downgrading. Creating upgrade task.`);

        if (context.room.controller.ticksToDowngrade <= 5000) {
            createTask(parentRoom, 'build', context.room.controller.id, 0, room.name); // high priority for upgrading the controller
        } else {
            createTask(parentRoom, 'build', context.room.controller.id, 10, room.name); // high priority for upgrading the controller
        }

        // repair damaged structures that are at 50% health or lower, but ignore walls and ramparts for now
        for (const structure of context.regularRepairTargets) {
            createTask(parentRoom, 'build', structure.id, 5, room.name); // high priority for repairing structures
        }

        // repair defensive structures that are at 10k health * rc, but ignore walls and ramparts for now
        const defenseRepair: Structure[] = [];
        for (const structure of context.defenseStructures) {
            if (((structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) &&
                structure.hits < (room.controller?.level || 0) * 10000) ||
                (structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax * 0.25)) {
                defenseRepair.push(structure);
            }
        }
        defenseRepair.sort((a, b) => a.hits - b.hits);

        for (const defense of defenseRepair) {
            createTask(parentRoom, 'build', defense.id, defense.hits < 1000 ? 0 : 5, room.name, undefined, 110); // high priority for repairing walls and ramparts
        }

        // fill extensions and spawns if they are empty
        for (const structure of context.energyReceivers) {
            if (structure.store.getFreeCapacity(RESOURCE_ENERGY) === 0) continue;
            createTask(parentRoom, 'fill', structure.id, 110, room.name); // medium priority for filling structures
        }
    } else {
        // if this room is not owned by us, we should create a task to reserve it if we have a controller
        if (context.room.controller) {
            createTask(parentRoom, 'reserve', context.room.controller.id, 5, room.name); // medium priority for reserving remote rooms
        }
    }

    // get construction sites in the room and create build tasks for them
    if (context.constructionSites.length > 0) {
        for (const site of context.constructionSites) {
            createTask(parentRoom, 'build', site.id, 5, room.name); // high priority for building construction sites
        }
    }

    // request containers with 25% fill to be hauled to parent room
    for (const container of context.containers) {
        if (container.store.getUsedCapacity(RESOURCE_ENERGY) <= container.store.getCapacity(RESOURCE_ENERGY) * 0.25) continue;
        createTask(parentRoom, 'haul', container.id, 10, room.name, undefined, 105, RESOURCE_ENERGY); // medium priority for hauling from remote containers
    }
}

function runRemote(room: Room): void {
    debugLog(`Running remote logic for room ${room.name}`);

    const context = GLOBAL_CONTEXT[room.name];

    if (!room.memory.parentRoom) {
        debugLog(`Remote room ${room.name} does not have a parent room assigned. Skipping remote logic.`);

        return;
    }

    // get a reference to the parent room
    const parentRoom = Game.rooms[room.memory.parentRoom];

    if (!parentRoom) {
        debugLog(`Parent room ${room.memory.parentRoom} not found for remote room ${room.name}.`);

        return;
    }

    // if we have hostiles, we need to spawn attackers since this is a remote room
    if (context.hostiles.length > 0) {
        for (const hostile of context.hostiles) {
            debugLog(`Hostile ${hostile.name} detected in remote room ${room.name}. Creating attack task.`);

            createTask(parentRoom, 'attack', hostile.id, 0, room.name); // medium priority for attacking hostiles
        }
    }

    // Check if the room needs to be scanned
    if (room.memory.lastScan === undefined || Game.time - room.memory.lastScan > 100) {
        // scan the room
        scanRemoteRoom(room, context, parentRoom);
    }

    runTowers(room, context, parentRoom);
}

// run logic for all owned rooms
export function runRooms() {
    // reset the room cpu usage for this tick
    ROOM_CPU = {};

    const cpuStart = Game.cpu.getUsed();
    const trackIndividualCpu = Memory.perfMode || typeof Memory.debugDisplay !== 'undefined';

    // build context on our rooms globally
    for (const roomName in Game.rooms) {
        try {
            buildRoomContext(Game.rooms[roomName]);
        } catch (error) {
            debugLog(`Error building context for room ${roomName}: ${error}`);
        }
    }

    // run logic for each room
    for (const roomName in Game.rooms) {
        try {
            const room = Game.rooms[roomName];
            const roomCpuStart = trackIndividualCpu ? Game.cpu.getUsed() : 0;

            if (room.controller && room.controller.my && room.memory.type === 'home') {
                runColony(room);
            } else if (room.memory.type === 'remote') {
                runRemote(room);
            }

            if (trackIndividualCpu) {
                ROOM_CPU[roomName] = Game.cpu.getUsed() - roomCpuStart;

                // signal to perfTracking room tick finished
                perfTracking.onRoomTick(room, ROOM_CPU[roomName], GLOBAL_CONTEXT[roomName], CREEP_COUNTS[roomName] || {});
            }
        } catch (error) {
            debugLog(`Error running room ${roomName}: ${error}`);
        }
    }

    ROOM_TOTAL_CPU = Game.cpu.getUsed() - cpuStart;

    // signal to perfTracking room tick finished
    perfTracking.onRoomsTicked(ROOM_TOTAL_CPU);
}
