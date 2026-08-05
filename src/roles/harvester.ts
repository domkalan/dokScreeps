import { getTaskById, findTaskForCreep, releaseTask } from "utils/TaskManager";
import { RoomContext } from "utils/Context";
import { globalContext } from "rooms";

export function runHarvester(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        // Assign a new task to the harvester if it doesn't have one
        const task = findTaskForCreep(creep, 'harvest');
        if (task) {
            creep.memory.taskId = task.id;
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
        const nearbyStorage = [
            ...globalContext[creep.room.name] ? globalContext[creep.room.name].structures : []
        ].find(structure => (structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_LINK) && structure.pos.inRangeTo(creep.pos, 4)) as StructureContainer | StructureLink | undefined;
        if (nearbyStorage) {
            const transferResult = creep.transfer(nearbyStorage, RESOURCE_ENERGY);

            if (transferResult === ERR_NOT_IN_RANGE) {
                creep.travelTo(nearbyStorage);
            } else if (transferResult === ERR_FULL) {
                creep.drop(RESOURCE_ENERGY); // Drop energy if the storage is full
            }

            return;
        } else {
            // Drop energy on the ground if no nearby storage is found
            creep.drop(RESOURCE_ENERGY);

            return;
        }
    }

    // If the creep is not in range to harvest, move towards the source
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.travelTo(source);
    }
}