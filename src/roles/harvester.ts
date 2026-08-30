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
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, task.roomId));

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
        const currentContext = GLOBAL_CONTEXT[creep.room.name];
        let nearbyLink: StructureLink | null = null;
        let closestRange = 5;

        for (const link of currentContext?.links || []) {
            if (link.store.getFreeCapacity(RESOURCE_ENERGY) === 0) continue;
            const range = creep.pos.getRangeTo(link);
            if (range < closestRange) {
                nearbyLink = link;
                closestRange = range;
            }
        }

        if (nearbyLink) {
            if (!creep.pos.isNearTo(nearbyLink)) {
                if (creep.fatigue === 0) creep.travelTo(nearbyLink);
                return;
            }

            if (creep.transfer(nearbyLink, RESOURCE_ENERGY) === ERR_FULL) {
                creep.drop(RESOURCE_ENERGY); // Drop energy if the link is full
            }

            return;
        }

        let nearbyContainer: StructureContainer | null = null;
        closestRange = 5;
        for (const container of currentContext?.containers || []) {
            if (container.store.getFreeCapacity(RESOURCE_ENERGY) === 0) continue;
            const range = creep.pos.getRangeTo(container);
            if (range < closestRange) {
                nearbyContainer = container;
                closestRange = range;
            }
        }

        if (nearbyContainer) {
            if (!creep.pos.isNearTo(nearbyContainer)) {
                if (creep.fatigue === 0) creep.travelTo(nearbyContainer);
                return;
            }

            if (creep.transfer(nearbyContainer, RESOURCE_ENERGY) === ERR_FULL) {
                creep.drop(RESOURCE_ENERGY); // Drop energy if the storage is full
            }

            return;
        }

        // if no nearby container or link, drop the energy on the ground
        creep.drop(RESOURCE_ENERGY);
        return;
    }

    if (!creep.pos.isNearTo(source)) {
        if (creep.fatigue === 0) creep.travelTo(source);
    } else {
        creep.harvest(source);
    }
}
