import { getTaskById, findTaskForCreep, releaseTask } from "utils/TaskManager";
import { RoomContext, GLOBAL_CONTEXT } from "utils/Context";

export function runHarvester(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        // Assign a new task to the harvester if it doesn't have one
        const task = findTaskForCreep(creep, 'harvest');
        if (task) {
            creep.memory.taskId = task.id;
            creep.memory.taskStarted = Game.time; // Record the time when the task was started

            task.assigned = creep.name;
        }

        if (!task) {
            debugLog(`No available harvest tasks for creep ${creep.name}`);

            return;
        }
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId!);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        releaseTask(creep); // Clear the invalid task ID

        return;
    }

    // if the creep is outside of the task room, go there
    if (creep.room.name !== task.roomId) {
        creep.travelTo(new RoomPosition(25, 25, task.roomId));

        return;
    }

    // Get the source object using the targetId from the task
    const source = Game.getObjectById(task.targetId) as Source | null;
    if (!source) {
        debugLog(`Source with ID ${task.targetId} not found for creep ${creep.name}`);
        releaseTask(creep); // Clear the invalid task ID
        return;
    }

    // if creep is full check for nearby container or link, otherwise drop
    if (creep.store.getFreeCapacity() === 0) {
        // if no nearby container, find a nearby link
        const nearbyLink = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
                return (
                    structure.structureType === STRUCTURE_LINK && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && structure.pos.getRangeTo(creep.pos) <= 4
                );
            }
        });

        if (nearbyLink) {
            const transferResult = creep.transfer(nearbyLink, RESOURCE_ENERGY);

            if (transferResult === ERR_NOT_IN_RANGE) {
                creep.travelTo(nearbyLink);
            } else if (transferResult === ERR_FULL) {
                creep.drop(RESOURCE_ENERGY); // Drop energy if the link is full
            }

            return;
        }

        // find a nearby container
        const nearbyContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
                return (
                    structure.structureType === STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && structure.pos.getRangeTo(creep.pos) <= 4
                );
            }
        });

        if (nearbyContainer) {
            const transferResult = creep.transfer(nearbyContainer, RESOURCE_ENERGY);

            if (transferResult === ERR_NOT_IN_RANGE) {
                creep.travelTo(nearbyContainer);
            } else if (transferResult === ERR_FULL) {
                creep.drop(RESOURCE_ENERGY); // Drop energy if the storage is full
            }

            return;
        }

        // if no nearby container or link, drop the energy on the ground
        creep.drop(RESOURCE_ENERGY);
        return;
    }

    // If the creep is not in range to harvest, move towards the source
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.travelTo(source);
    }
}