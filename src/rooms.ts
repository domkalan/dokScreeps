import { runHarvester } from "roles/harvester";
import { runBuilder } from "roles/builder";

import { getRoleNameCounter } from "utils/Counter";
import { ConstructionPlanner } from "constructionPlanner";
import { createBasicRoomPlan } from "plans/basic";
import { runQueen } from "roles/queen";
import { runScout } from "roles/scout";

// get owned rooms by controller ownership
export function getOwnedRooms(): Room[] {
    return Object.values(Game.rooms).filter(
        room => room.controller?.my === true,
    );
}

// append more body parts depending on available energy and role
function getCreepBodyParts(room: Room, role: string): BodyPartConstant[] {
    const baseBody: BodyPartConstant[] = [WORK, CARRY, MOVE];
    const energyAvailable = room.energyAvailable;

    // Calculate how many additional parts can be added based on available energy
    let additionalPartsCount = Math.floor((energyAvailable - 200) / 100); // Each additional part costs 100 energy

    // Limit the number of additional parts to a maximum of 5 for now
    additionalPartsCount = Math.min(additionalPartsCount, 5);

    // Create an array of additional body parts based on the role
    const additionalParts: BodyPartConstant[] = [];
    for (let i = 0; i < additionalPartsCount; i++) {
        if (role === 'harvester') {
            additionalParts.push(WORK);
        } else if (role === 'builder') {
            additionalParts.push(CARRY);
        } else if (role === 'queen') {
            additionalParts.push(CARRY, MOVE);
        }
    }

    return baseBody.concat(additionalParts);
}

// get the ideal number of creeps that should exist
function getIdealCreepCount(room: Room): { [role: string]: { count: number, priority: number } } {
    const roomStructures = room.find(FIND_STRUCTURES);
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

    const idealCounts: { [role: string]: { count: number, priority: number } } = {
        harvester: { count: room.memory.energySources.length, priority: 1 },
        builder: { count: 1, priority: 2 }, // always match the number of build tasks plus 1,
        queen: { count: 0, priority: 0 }, // always have one queen
    };

    // if the room controller is below level 2 or we have no extensions, we don't need a queen yet
    if (room.controller && room.controller.level >= 2) {
        if (roomStructures.filter(structure => structure.structureType === STRUCTURE_EXTENSION).length > 0) {
            idealCounts.queen = { count: 1, priority: 0 };
        }
        
        if (constructionSites.length > 0) {
            idealCounts.builder.count = constructionSites.length + 1; // always have one extra builder
        }
    }

    // hard cap builders to 3 for now, can be adjusted later
    if (idealCounts.builder.count > 3) {
        idealCounts.builder = { count: 3, priority: 3 };
    }

    return idealCounts;
}

// monitor creeps count and log if any role is underrepresented
function monitorCreepRoles(room: Room): void {
    const idealCounts = getIdealCreepCount(room);
    const roleCounts: { [role: string]: number } = {};

    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (creep.memory.role) {
            roleCounts[creep.memory.role] = (roleCounts[creep.memory.role] || 0) + 1;
        }
    }

    // reset the spawn queue for this room
    room.memory.spawnQueue = [];

    for(const role in idealCounts) {
        const idealCount = idealCounts[role];
        const actualCount = roleCounts[role] || 0;

        if (actualCount < idealCount.count) {
            console.log(`Room ${room.name} has ${actualCount} ${role}s, but ideally should have ${idealCount.count}. Adding to spawn queue.`);
            room.memory.spawnQueue.push({ role, priority: idealCount.priority });
        }
    }

    // if the spawn queue has roles, and the room has energy
    if (room.memory.spawnQueue.length > 0 && room.energyAvailable > 150) {
        // Sort the spawn queue by priority (lower number = higher priority)
        room.memory.spawnQueue.sort((a, b) => a.priority - b.priority);

        // Get the highest priority role to spawn
        const nextRoleToSpawn = room.memory.spawnQueue[0].role;

        // Log the spawning action
        console.log(`Spawning new creep with role: ${nextRoleToSpawn}`);

        // select all spawn structures in the room
        const spawns = room.find(FIND_MY_SPAWNS);
        // select the next available spawn (for simplicity, just take the first one)
        const spawn = spawns.length > 0 ? spawns[0] : null;

        if (spawn) {
            // Define a basic body for the new creep
            const body = getCreepBodyParts(room, nextRoleToSpawn);

            const roleCounter = getRoleNameCounter(nextRoleToSpawn);
            const creepName = `${nextRoleToSpawn}-${roleCounter}`;

            // Attempt to spawn the new creep
            const spawnResult = spawn.spawnCreep(body, creepName, {
                memory: { role: nextRoleToSpawn, room: room.name },
            });

            if (spawnResult === OK) {
                console.log(`Successfully spawned ${nextRoleToSpawn} creep.`);
            } else {
                console.log(`Failed to spawn ${nextRoleToSpawn} creep. Error code: ${spawnResult}`);
            }
        } else {
            console.log(`No available spawns in room ${room.name} to spawn new creeps.`);
        }
    }
}

// create a new task and add it to the room's memory
function createTask(room: Room, type: string, targetId: string, priority: number): void {
    const taskId = `${type}_${targetId}`;

    if (room.memory.tasks[taskId]) {
        return;
    }

    // Create a new task and add it to the room's memory
    room.memory.tasks[taskId] = {
        id: taskId,
        assigned: '',
        type,
        targetId,
        priority
    };
}

// scan a room for energy sources and update its memory
function scanRoom(room: Room): void {
    console.log(`Scanning room ${room.name}`);

    // Update the last scan time
    room.memory.lastScan = Game.time;

    // Ensure the tasks object exists in room memory
    if (!room.memory.tasks) {
        room.memory.tasks = {};
    }

    // Remove invalid tasks from the room's memory and check if assigned creep still exists
    for (const taskId in room.memory.tasks) {
        const task = room.memory.tasks[taskId];
        const target = Game.getObjectById(task.targetId);
        
        if (!target) {
            console.log(`Removing invalid task ${taskId} from room ${room.name}`);
            delete room.memory.tasks[taskId];
        }

        // Check if the assigned creep still exists
        if (task.assigned && !Game.creeps[task.assigned]) {
            console.log(`Assigned creep ${task.assigned} for task ${taskId} no longer exists. Unassigning task.`);
            task.assigned = '';
        }
    }

    // Scan for energy sources in the room
    const energySources = room.find(FIND_SOURCES);
    room.memory.energySources = energySources.map(source => source.id);

    // create a harvest task for each energy source
    for (const source of energySources) {
        createTask(room, 'harvest', source.id, 1);
    }

    // create a task for upgrading the controller if it exists
    if (room.controller) {
        createTask(room, 'build', room.controller.id, 3);
    }

    // if the controller level has changed, log it
    if (room.controller && room.controller.level !== room.memory.controllerLevel) {
        console.log(`Controller in room ${room.name} has leveled up from ${room.memory.controllerLevel} to ${room.controller.level}`);
    }

    // if the construction planner is enabled and there is no plan, create a basic plan
    if (room.memory.constructionPlanner && room.memory.constructionPlanner.plan.length === 0) {
        ConstructionPlanner.setPlan(room, createBasicRoomPlan(room));
    }

    // run the construction planner for the room
    ConstructionPlanner.run(room);

    // set the last known level of the controller in memory
    if (room.controller) {
        room.memory.controllerLevel = room.controller.level;
    }

    // create a build task for each construction site in the room
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    for (const site of constructionSites) {
        createTask(room, 'build', site.id, 1);
    }

    console.log(`Room ${room.name} scanned. Found ${energySources.length} energy sources.`);
}

function runCreeps(room: Room): void {
    const creepsInRoom = Object.values(Game.creeps).filter(creep => creep.memory.room === room.name);

    for (const creep of creepsInRoom) {
        switch (creep.memory.role) {
            case 'harvester':
                runHarvester(creep);
                break;
            case 'builder':
                runBuilder(creep);
                break;
            case 'queen':
                runQueen(creep);
                break;
            case 'scout':
                runScout(creep);
                break;
            default:
                console.log(`Creep ${creep.name} has an unknown role: ${creep.memory.role}`);
        }
    }
}

// run colony logic for a given room
function runColony(room: Room): void {
    console.log(`Running colony logic for room ${room.name}`);

    // Check if the room needs to be scanned
    if (room.memory.lastScan === undefined || Game.time - room.memory.lastScan > 100) {
        // scan the room
        scanRoom(room);

        // monitor the roles of creeps in the room
        monitorCreepRoles(room);
    }

    runCreeps(room);
}

// run logic for all owned rooms
export function runRooms() {
    const rooms = getOwnedRooms();

    for (const room of rooms) {
        runColony(room);
    }
}