import { runHarvester } from "roles/harvester";
import { runBuilder } from "roles/builder";
import { runQueen } from "roles/queen";
import { runScout } from "roles/scout";
import { runHauler } from "roles/hauler";
import { runDefender } from "roles/defender";

import { runTower } from "tower";

import { ConstructionPlanner } from "constructionPlanner";
import { createBasicRoomPlan } from "plans/basic";

import { buildRoomContext, RoomContext } from "utils/Context";
import { getRoleNameCounter } from "utils/Counter";
import { createTask, monitorTasks } from "utils/TaskManager";


// get owned rooms by controller ownership
export function getOwnedRooms(): Room[] {
    return Object.values(Game.rooms).filter(
        room => room.controller?.my === true
    );
}

// append more body parts depending on available energy and role
function getCreepBodyParts(room: Room, role: string): [BodyPartConstant[], number] {
    let baseBody: BodyPartConstant[] = [WORK, CARRY, MOVE];
    let energyUsed: number = 200;

    // no clue why this isnt working, so subtract 100
    const energyAvailable = room.energyAvailable - 100;

    // if defender, we need a different base body
    if (role === 'defender' || role === 'attacker') {
        baseBody = [ATTACK, MOVE];
        energyUsed = 130; // ATTACK + MOVE costs 130 energy
    } else if (role === 'claimer') {
        baseBody = [CLAIM, MOVE];
        energyUsed = 130; // CLAIM + MOVE costs 130 energy
    } else if (role === 'hauler') {
        baseBody = [CARRY, MOVE];
        energyUsed = 100; // CARRY + MOVE costs 100 energy
    }

    // Create an array of additional body parts based on the role
    const additionalParts: BodyPartConstant[] = [];
    while (energyUsed < energyAvailable) {
        if (role === 'harvester') {
            additionalParts.push(WORK);
            energyUsed += 100; // WORK costs 100 energy

            // limit harvesters to 4 WORK parts
            if (additionalParts.length === 4) {
                break;
            }
        } else if (role === 'builder') {
            additionalParts.push(WORK, CARRY, MOVE);
            energyUsed += 200; // WORK + CARRY + MOVE costs 200 energy
        } else if (role === 'queen') {
            additionalParts.push(CARRY, MOVE);
            energyUsed += 100; // CARRY + MOVE costs 100 energy
        } else if (role === 'defender' || role === 'attacker') {
            additionalParts.push(TOUGH, MOVE, ATTACK);
            energyUsed += 190; // TOUGH + MOVE + ATTACK costs 190 energy
        } else if (role === 'hauler') {
            additionalParts.push(CARRY, MOVE);
            energyUsed += 100; // CARRY + MOVE costs 100 energy
        }
    }

    return [baseBody.concat(additionalParts), energyUsed];
}

// get the ideal number of creeps that should exist
function getIdealCreepCount(room: Room, context: RoomContext, roleCounts: { [role: string]: number }): { [role: string]: { count: number, priority: number } } {
    const roomControlLevel = context.room.controller?.level || 0;
    const haulerJobs = Object.values(room.memory.tasks).filter(task => task.type === 'haul' && !task.assigned && !task.completed);
    const builderJobs = Object.values(room.memory.tasks).filter(task => task.type === 'build' && !task.completed);
    const attackJobs = Object.values(room.memory.tasks).filter(task => task.type === 'attack' && !task.assigned && !task.completed);
    const claimJobs = Object.values(room.memory.tasks).filter(task => (task.type === 'claim' || task.type === 'reserve') && !task.assigned && !task.completed);

    const idealCounts: { [role: string]: { count: number, priority: number } } = {
        harvester: { count: room.memory.energySources.length, priority: 0 },
        builder: { count: 1, priority: 5 }, // always match the number of build tasks plus 1,
        queen: { count: 1, priority: 2.5 }, // always have one queen, low priority since we don't need it until later,
        hauler: { count: 1, priority: 5 }, // always have one hauler, medium priority
        claimer: { count: 0, priority: 10 }, // only spawn a claimer if we have a claim task, medium priority
        defender: { count: 0, priority: 10 }, // only spawn a defender if we have a hostile, medium priority
        attacker: { count: 0, priority: 10 }, // only spawn an attacker if we have an attack task, medium priority,
        scout: { count: 0, priority: 10 } // only spawn a scout if we have a remote room to scout, medium priority
    };

    if (Math.ceil(builderJobs.length / 2) > idealCounts.builder.count) {
        idealCounts.builder.count = Math.ceil(builderJobs.length / 2) + 1;
        idealCounts.builder.priority = 2.5; // if we have build tasks, increase the priority of builders

        if (builderJobs.length > roomControlLevel) {
            idealCounts.builder.count = roomControlLevel + 1; // limit the number of builders to the room control level
        }
    }

    // remote harvester spawning
    if (roleCounts.harvester && roleCounts.harvester >= room.memory.energySources.length) {
        idealCounts.harvester.count = Object.keys(room.memory.remoteEnergySources || {}).length + 1;
        idealCounts.harvester.priority = 5; // if we have enough haulers, lower the priority
    }

    // 2 tasks per hauler, if we have more than 2 tasks per hauler, increase the priority of haulers
    if (Math.ceil(haulerJobs.length / 1.5) > idealCounts.hauler.count) {
        idealCounts.hauler.count = Math.ceil(haulerJobs.length / 1.5) + 1;
        idealCounts.hauler.priority = 5; // if we have enough hauler jobs, increase the priority
    }

    if (claimJobs.length > 0) {
        idealCounts.claimer.count = claimJobs.length;
        idealCounts.claimer.priority = 7.5; // if we have claim tasks, increase the priority of claimers
    }

    // if we have attack tasks, spawn attackers
    if (attackJobs.length > 0) {
        idealCounts.attacker.count = attackJobs.length;
        idealCounts.attacker.priority = 5; // if we have attack tasks, increase the priority of attackers

        if (idealCounts.attacker.count > roomControlLevel) {
            idealCounts.attacker.count = roomControlLevel; // limit the number of attackers to the room control level
        }
    }

    return idealCounts;
}

// monitor creeps count and log if any role is underrepresented
function monitorCreepRoles(room: Room, context: RoomContext): void {
    const roleCounts: { [role: string]: number } = {};

    for (const name in Game.creeps) {
        const creep = Game.creeps[name];

        if (creep.memory.room !== room.name) {
            continue;
        }

        if (creep.ticksToLive && creep.ticksToLive < 50) {
            debugLog(`Creep ${creep.name} is about to die.`);

            continue; // skip counting this creep if it's about to die
        }

        if (creep.memory.role) {
            roleCounts[creep.memory.role] = (roleCounts[creep.memory.role] || 0) + 1;
        }
    }

    const idealCounts = getIdealCreepCount(room, context, roleCounts);

    for (const role in idealCounts) {
        const idealCount = idealCounts[role];
        const actualCount = roleCounts[role] || 0;

        if (actualCount < idealCount.count && !room.memory.spawnQueue.some(entry => entry.role === role)) {
            debugLog(`Room ${room.name} has ${actualCount} ${role}s, but ideally should have ${idealCount.count}. Adding to spawn queue.`);
            room.memory.spawnQueue.push({ role, priority: idealCount.priority });
        }
    }

    // clean up the spawn queue to remove any roles that are no longer needed
    room.memory.spawnQueue = room.memory.spawnQueue.filter(entry => {
        const ideal = idealCounts[entry.role];

        if (!ideal) {
            return false;
        }

        const actual = roleCounts[entry.role] || 0;
        return actual < ideal.count;
    });

    // if the spawn queue has roles, and the room has energy
    if (room.memory.spawnQueue.length > 0 && room.energyAvailable > 150) {
        // Sort the spawn queue by priority (lower number = higher priority)
        room.memory.spawnQueue.sort((a, b) => a.priority - b.priority);

        // Get the highest priority role to spawn
        const nextRoleToSpawn = room.memory.spawnQueue.shift();

        if (nextRoleToSpawn) {
            {
                const spawnResult = spawnCreep(room, nextRoleToSpawn.role, context);

                if (!spawnResult) {
                    debugLog(`Failed to spawn ${nextRoleToSpawn.role} in room ${room.name}. Re-adding to spawn queue.`);
                    room.memory.spawnQueue.push(nextRoleToSpawn); // re-add to the queue if spawning failed
                }
            }
        }
    }
}

// spawn a creep for a given role in a room
function spawnCreep(room: Room, role: string, context: RoomContext): boolean {
    // Log the spawning action
    debugLog(`Spawning new creep with role: ${role}`);

    const spawn = context.structures.find(structure => structure.structureType === STRUCTURE_SPAWN && !(structure as StructureSpawn).spawning) as StructureSpawn;

    if (spawn) {
        // Define a basic body for the new creep
        const [body, bodyEnergy] = getCreepBodyParts(room, role);
        const roleCounter = getRoleNameCounter(role);
        const creepName = `${role}-${roleCounter}`;

        // Attempt to spawn the new creep
        const spawnResult = spawn.spawnCreep(body, creepName, {
            memory: { role, room: room.name },
        });

        if (spawnResult === OK) {
            debugLog(`Successfully spawned new creep: ${creepName} with role: ${role}`);

            return true;
        } else if (spawnResult === ERR_NOT_ENOUGH_ENERGY) {
            debugLog(`Not enough energy to spawn ${creepName} with role: ${role}. Required: ${body.reduce((sum, part) => sum + BODYPART_COST[part], 0)}, Available: ${room.energyAvailable}`);
            new RoomVisual(room.name).text(`X`, spawn.pos.x, spawn.pos.y + 0.36, { color: 'red', font: 1, align: 'center' }).text(`${role} ${bodyEnergy}/${room.energyAvailable}`, spawn.pos.x, spawn.pos.y + 1, { color: 'red', font: 0.25, align: 'center' });

            return false;
        }

        debugLog(`Failed to spawn ${creepName} with role: ${role}. Error code: ${spawnResult}`);
    } else {
        debugLog(`No available spawns in room ${room.name} to spawn new creeps.`);
    }

    return false;
}

// scan a room for energy sources and update its memory
function scanRoom(room: Room, context: RoomContext): void {
    debugLog(`Scanning room ${room.name}`);

    // Update the last scan time
    room.memory.lastScan = Game.time;

    // Scan for energy sources in the room
    room.memory.energySources = context.sources.map(source => source.id);

    // create a harvest task for each energy source
    for (const source of context.sources) {
        createTask(room, 'harvest', source.id, 1);
    }

    // process any nearby remote energy sources and create tasks for them if they are not already in memory
    for (const source in room.memory.remoteEnergySources) {
        const remoteSource = room.memory.remoteEnergySources[source];

        createTask(room, 'harvest', source, 10, remoteSource.room); // low priority for remote harvesting
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
        ConstructionPlanner.setPlan(room, createBasicRoomPlan(room));
    }

    // run the construction planner for the room
    // TODO: make this return a list of tasks to create
    ConstructionPlanner.run(room, context);

    // review structures that are low on health and create a build task to repair
    const structuresToRepair = context.structures.filter(structure => {
        return (
            (structure.hits < structure.hitsMax * 0.5) && // less than 50% health
            (structure.structureType !== STRUCTURE_WALL && structure.structureType !== STRUCTURE_RAMPART) // ignore walls and ramparts for now
        );
    });

    for (const structure of structuresToRepair) {
        createTask(room, 'build', structure.id, 1); // high priority for repairing structures
    }

    // review walls and ramparts that are low on health and create a build task to repair
    const wallsToRepair = context.structures.filter(structure => {
        return (
            (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) &&
            (structure.hits < (room.controller?.level || 0) * 10000) // less than RCL * 10k health
        );
    }).sort((a, b) => a.hits - b.hits); // sort by lowest health first

    for (const wall of wallsToRepair) {
        createTask(room, 'build', wall.id, wall.hits < 1000 ? 0 : 5, undefined, undefined, 110); // high priority for repairing walls and ramparts
    }

    const roadsToRepair = context.structures.filter(structure => {
        return (
            structure.structureType === STRUCTURE_ROAD &&
            structure.hits < structure.hitsMax * 0.5 // less than 50% health
        );
    });

    for (const road of roadsToRepair) {
        createTask(room, 'build', road.id, 10, undefined, undefined, 110); // medium priority for repairing roads
    }

    // add an ultra-low priority task to maintain the rooms controller
    createTask(room, 'build', room.controller?.id || '', 100, undefined, undefined, 120); // ultra-low priority for maintaining the controller

    // if we are at rcl 4 or higher, we can start claiming our child rooms
    if (room.controller && room.controller.level >= 4) {
        for (const childRoomName of room.memory.childRooms || []) {
            const childRoom = Game.rooms[childRoomName];

            if (childRoom && childRoom.controller && !childRoom.controller.my) {
                createTask(room, 'reserve', childRoom.controller.id, 5, childRoomName); // medium priority for claiming child rooms
            }
        }
    }

    // find the main storage or container in the room
    const mainStorage = context.structures.find(structure => {
        return (
            (structure.structureType === STRUCTURE_STORAGE || structure.structureType === STRUCTURE_CONTAINER) &&
            (structure as StructureStorage | StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
        );
    }) as StructureStorage | StructureContainer | undefined;

    if (mainStorage && mainStorage.store.getUsedCapacity(RESOURCE_ENERGY) < mainStorage.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
        createTask(room, 'fill', mainStorage.id, 2.5); // medium priority for filling storage
    }

    debugLog(`Room ${room.name} scanned. Found ${context.sources.length} energy sources.`);
}

function runCreeps(room: Room, context: RoomContext): void {
    for (const creepName in Game.creeps) {
        try {
            const creep = Game.creeps[creepName];

            if (creep.memory.room !== room.name) {
                continue;
            }

            // check creep position
            if (creep.pos.x != creep.memory.atLocation?.x || creep.pos.y !== creep.memory.atLocation?.y) {
                creep.memory.atLocation = { x: creep.pos.x, y: creep.pos.y };
                creep.memory.atLocationFor = Game.time;
            } else if (creep.memory._move) {
                const stallTime = Game.time - (creep.memory.atLocationFor || 0);

                // if the creep has been at the same location for more than 10 ticks, move it randomly
                if (stallTime >= 5 && stallTime < 10 && creep.fatigue === 0) {
                    // delete cached path to force recalculation
                    delete creep.memory._move;

                    if (stallTime > 5) {
                        creep.say(`🐢 ${stallTime - 5}`);
                    }
                } else if (stallTime >= 10 && creep.fatigue === 0) {
                    creep.say(`💀`);

                    const randomDirection = Math.floor(Math.random() * 8) + 1 as any; // Random direction between 1 and 8
                    creep.move(randomDirection);

                    continue;
                } else if (creep.fatigue > 0) {
                    creep.say(`💨 ${creep.fatigue}`);
                    creep.memory.atLocationFor = Game.time; // reset the stall timer if the creep is fatigued
                }
            }

            // run the appropriate role logic for the creep
            switch (creep.memory.role) {
                case 'harvester':
                    runHarvester(creep, context);
                    break;
                case 'builder':
                    runBuilder(creep, context);
                    break;
                case 'queen':
                    runQueen(creep, context);
                    break;
                case 'scout':
                    runScout(creep, context);
                    break;
                case 'hauler':
                    runHauler(creep, context);
                    break;
                case 'defender':
                    runDefender(creep, context);
                    break;
                default:
                    debugLog(`Creep ${creep.name} has an unknown role: ${creep.memory.role}`);
            }
        } catch (error) {
            debugLog(`Error running creep ${creepName}: ${error}`);
        }
    }
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

export function runTowers(room: Room, context: RoomContext): void {
    const towers = context.structures.filter(structure => structure.structureType === STRUCTURE_TOWER) as StructureTower[];

    for (const tower of towers) {
        runTower(tower, context);
    }
}

// defense mode override for a room if hostiles are detected
function runColonyDefense(room: Room, context: RoomContext): void {
    // get total length of defenders from context
    const defenders = context.myCreeps.filter(creep => creep.memory.role === 'defender');
    const hostiles = context.hostiles;

    debugLog(`Hostiles detected in room ${room.name}: ${hostiles.map(h => h.name).join(', ')}`);

    // set room to defense mode
    if (!room.memory.defenseMode) {
        room.memory.defenseMode = true;
        room.memory.defenseModeActivatedAt = Game.time;

        debugLog(`Room ${room.name} is now in defense mode.`);
    }

    const structures = room.find(FIND_STRUCTURES);
    const sources = room.find(FIND_SOURCES);

    // if we have no defenders, queue a defender to be spawned
    if (defenders.length < (hostiles.length + 2)) { // add a buffer of 2 to ensure we have enough defenders
        debugLog(`No defenders present in room ${room.name}. Queuing a defender to be spawned.`);

        spawnCreep(room, 'defender', context);
    }

    const structuresToFill = structures.filter(structure => {
        return (
            (structure.structureType === STRUCTURE_EXTENSION ||
                structure.structureType === STRUCTURE_SPAWN ||
                structure.structureType === STRUCTURE_TOWER) &&
            (structure as any).store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
    });

    for (const structure of structuresToFill) {
        createTask(room, 'fill', structure.id, 5); // medium priority for filling structures
    }

    // have harvesters continue to harvest
    for (const source of sources) {
        createTask(room, 'harvest', source.id, 1); // high priority for harvesting
    }

    // switch roles in defense mode, all creeps that are not defenders will act as haulers to fill structures with energy
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];

        if (creep.memory.room !== room.name) {
            continue;
        }

        switch (creep.memory.role) {
            case 'harvester':
                runHarvester(creep, context);
                break;
            case 'defender':
                runDefender(creep, context);
                break;
            default:
                runHauler(creep, context); // all other creeps will act as haulers to fill structures with energy
        }
    }
}

// run colony logic for a given room
function runColony(room: Room): void {
    debugLog(`Running colony logic for room ${room.name}`);

    // monitor tasks for the room
    monitorTasks(room);

    // get room context
    const context = buildRoomContext(room);

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

    // monitor the roles of creeps in the room
    monitorCreepRoles(room, context);

    // run all creeps
    runCreeps(room, context);

    // run all towers
    runTowers(room, context);
}

// run logic for all owned rooms
export function runRooms() {
    const rooms = getOwnedRooms();

    for (const room of rooms) {
        if (room.memory.type === 'home') {
            runColony(room);
        } else if (room.memory.type === 'remote') {
            console.log(`Room ${room.name} is a remote room`);
        }
    }
}
