import { getTaskById, findTaskForCreep } from "utils/TaskManager";

export function goForEnergy(creep: Creep): void {
    if (creep.memory.goingFor) {
        const target = Game.getObjectById(creep.memory.goingFor);
        if (target && target instanceof StructureStorage && target.store[RESOURCE_ENERGY] > 0) {
            const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
            if (withdrawResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            } else if (withdrawResult === OK) {
                delete creep.memory.goingFor; // Clear the goingFor memory once energy is withdrawn
            }
        } else if (target && target instanceof Resource) {
            const pickupResult = creep.pickup(target);
            if (pickupResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            } else if (pickupResult === OK) {
                delete creep.memory.goingFor; // Clear the goingFor memory once energy is picked up
            }
        } else {
            delete creep.memory.goingFor; // Clear the goingFor memory if the target is invalid or out of energy
        }

        return;
    }

    // If the creep doesn't have a target, find the closest energy source (storage or dropped energy)
    const nearbyStorage = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return (
                (structure.structureType === STRUCTURE_STORAGE ||
                    structure.structureType === STRUCTURE_CONTAINER) &&
                structure.store[RESOURCE_ENERGY] > 0
            );
        }
    });

    if (nearbyStorage.length > 0) {
        const targetStorage = nearbyStorage[0];
        creep.memory.goingFor = targetStorage.id; // Store the target in memory
        const withdrawResult = creep.withdraw(targetStorage, RESOURCE_ENERGY);
        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(targetStorage, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
    } else {
        // If no nearby storage is available, attempt to find dropped energy on the ground
        const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY,
        });

        if (droppedEnergy) {
            creep.memory.goingFor = droppedEnergy.id; // Store the target in memory
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        } else {
            console.log(`Creep ${creep.name} has no energy and no nearby storage or dropped energy.`);
        }
    }
}

export function runBuilder(creep: Creep): void {
    if (!creep.memory.taskId) {
        // Assign a new task to the builder if it doesn't have one
        const task = findTaskForCreep(creep, 'build');
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

    const target = Game.getObjectById(task.targetId);
    if (!target) {
        console.log(`Construction site with ID ${task.targetId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    // if creep has no energy, attempt to find from a nearby storage (link or container) if available
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep);
    } else {
        if (target instanceof ConstructionSite) {
            const buildResult = creep.build(target);
            if (buildResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            } else if (buildResult === OK) {
                // make sure the task is reserved for this creep while it's working on it
                task.assigned = creep.id;
            }
        } else if (target instanceof StructureController) {
            if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        }
    }
}