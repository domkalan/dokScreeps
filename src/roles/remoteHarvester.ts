import { findTaskForCreep, getTaskById } from '../utils/TaskManager';

/**
 * Remote harvester is responsible for harvesting energy from a remote room and bringing it back to the home room.
 * The remote harvester will look for storage in the home room to deposit energy, if none are found it will drop
 * in a radius near the spawn.
 */
export function runRemoteHarvester(creep: Creep): void {
    // find the remote harvest task assigned to this creep
    if (!creep.memory.taskId) {
        // Assign a new task to the builder if it doesn't have one
        const task = findTaskForCreep(creep, 'remoteHarvest');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.id;
        } else {
            console.log(`No available build tasks for creep ${creep.name}`);
            return;
        }
    }

    const task = getTaskById(creep.memory.taskId);
    if (!task) {
        console.log(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        // If the creep is full, find a place to deposit the energy
        const homeRoom = Game.rooms[creep.memory.room];
        if (!homeRoom) {
            console.log(`Home room ${creep.memory.room} not visible for creep ${creep.name}`);
            return;
        }

        // Look for storage in the home room
        const storage = homeRoom.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_STORAGE
        })[0];

        if (storage) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        } else {
            // If no storage is found, drop the energy near the spawn
            const spawn = homeRoom.find(FIND_MY_SPAWNS)[0];
            if (spawn) {
                if (spawn.pos.inRangeTo(creep.pos, 3)) {
                    creep.drop(RESOURCE_ENERGY);
                } else {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
                }
            } else {
                console.log(`No storage or spawn found in home room ${homeRoom.name} for creep ${creep.name}`);
            }
        }
    }

    if (!task.room) {
        console.log(`Task with ID ${task.id} does not have a target room specified for creep ${creep.name}`);
        return;
    }

    const targetRoom = Game.rooms[task.room];
    if (!targetRoom) {
        console.log(`Target room ${task.room} not visible for creep ${creep.name}`);
        return;
    }

    // If the creep is in the target room, harvest energy from the source
    if (creep.room.name === targetRoom.name) {
        const source = Game.getObjectById(task.targetId) as Source;
        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
            }
        } else {
            console.log(`Source with ID ${task.targetId} not found in room ${targetRoom.name} for creep ${creep.name}`);
        }
    } else {
        // Move to the target room
        const exitDir = creep.room.findExitTo(targetRoom.name) as any;

        if (exitDir !== ERR_NO_PATH) {
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
            }
        } else {
            console.log(`No exit found from room ${creep.room.name} to room ${targetRoom.name} for creep ${creep.name}`);
        }
    }
}