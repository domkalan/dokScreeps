import { RoomContext } from "utils/Context";
import { getTaskById, releaseTask, findTaskForCreep, completeTask, createTask } from "utils/TaskManager";

import { runQueen } from "./queen";

export function goForEnergy(creep: Creep, context: RoomContext): void {
    let target = null;

    if (creep.memory.focusedOn) {
        target = Game.getObjectById(creep.memory.focusedOn) as StructureStorage | StructureContainer | Resource | null;
    }

    if (!target || (target instanceof Structure && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
        // Find the closest storage, container, or dropped resource with energy
        const possibleTargets = [...context.resources, ...context.structures].filter(resource => {
            return (
                (resource instanceof Resource && resource.resourceType === RESOURCE_ENERGY) ||
                (resource instanceof StructureStorage && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||
                (resource instanceof StructureContainer && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            );

            // sort, dropped resources first, then storage, then containers
        }).sort((a, b) => {
            if (a instanceof Resource && b instanceof Resource) {
                return 0; // Both are dropped resources, no change in order
            } else if (a instanceof Resource) {
                return -1; // a is a dropped resource, it should come first
            } else if (b instanceof Resource) {
                return 1; // b is a dropped resource, it should come first
            } else if (a instanceof StructureStorage && b instanceof StructureStorage) {
                return 0; // Both are storage, no change in order
            } else if (a instanceof StructureStorage) {
                return -1; // a is storage, it should come before containers
            } else if (b instanceof StructureStorage) {
                return 1; // b is storage, it should come before containers
            } else {
                return 0; // Both are containers, no change in order
            }
        });

        if (possibleTargets.length === 0) {
            debugLog(`No available energy sources for creep ${creep.name}`);
            creep.say('⚡ ❌');
            return;
        }

        target = creep.pos.findClosestByPath(possibleTargets) as StructureStorage | StructureContainer | Resource | null;
        creep.memory.focusedOn = target?.id; // Store the target in memory
    }

    if (target instanceof Resource) {
        const pickupResult = creep.pickup(target);

        if (pickupResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
        } else if (pickupResult === OK) {
            debugLog(`Creep ${creep.name} picked up energy from dropped resource ${target.id}`);

            delete creep.memory.focusedOn; // Clear the focused target after picking up
        }

        return;
    } else if (target instanceof StructureStorage || target instanceof StructureContainer) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);

        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
        } else if (withdrawResult === OK) {
            debugLog(`Creep ${creep.name} withdrew energy from ${target.structureType} ${target.id}`);

            delete creep.memory.focusedOn; // Clear the focused target after withdrawing
        }

        return;
    } else {
        debugLog(`Creep ${creep.name} has an invalid target for energy: ${target}`);
        delete creep.memory.focusedOn; // Clear the invalid target from memory
    }

    debugLog(`Creep ${creep.name} could not find any energy sources to withdraw from.`);
    creep.say('🤷 ⚡');
}

export function runBuilder(creep: Creep, context: RoomContext): void {
    // if creep has no energy, attempt to find from a nearby storage (link or container) if available
    if (creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.memory.taskId) {
            releaseTask(creep); // Release the task if the creep has no energy

            delete creep.memory.taskId; // Clear the task ID from memory
        }

        goForEnergy(creep, context); // Attempt to get energy from nearby storage or dropped energy

        return;
    }

    if (!creep.memory.taskId) {
        // Assign a new task to the builder if it doesn't have one
        const task = findTaskForCreep(creep, 'build');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.name;
        } else {
            debugLog(`No available build tasks for creep ${creep.name}`);

            runQueen(creep, context); // Attempt to upgrade the controller if no build tasks are available

            return;
        }
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    const target = Game.getObjectById(task.targetId);
    if (!target) {
        debugLog(`Construction site with ID ${task.targetId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    if (target instanceof ConstructionSite) {
        // if the build target is a rampart, we want to have full energy
        if (target.structureType === STRUCTURE_RAMPART && creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity(RESOURCE_ENERGY)) {
            debugLog(`Creep ${creep.name} is building a rampart but does not have full energy. Going to get more energy.`);
            goForEnergy(creep, context);
            return;
        }

        // fire the build action
        const buildResult = creep.build(target);

        if (buildResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        } else if (buildResult === OK) {
            // if the build is successful and the structure is a rampart, instantly begin repairing it to full health
            if (target.structureType === STRUCTURE_RAMPART) {
                completeTask(creep);

                const repairTask = createTask(creep.room, 'build', target.id, 0); // Create a repair task for the rampart

                creep.memory.taskId = repairTask.id; // Assign the new repair task to the creep
            }
        }
    } else if (target instanceof StructureController) {
        if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
    } else if (target instanceof Structure) {
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }

        if (target.hits >= target.hitsMax) {
            debugLog(`Creep ${creep.name} has finished repairing structure ${target.id}.`);

            delete creep.memory.taskId; // Clear the task ID after finishing the repair
            delete creep.room.memory.tasks[task.id]; // Remove the task from room memory
        }
    }
}