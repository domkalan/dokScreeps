import { RoomContext } from "utils/Context";
import { getTaskById, releaseTask, findTaskForCreep, completeTask, createTask } from "utils/TaskManager";
import { runQueen } from './queen';

export function goForEnergy(creep: Creep, context: RoomContext): void {
    let target = null;

    if (creep.memory.focusedOn) {
        target = Game.getObjectById(creep.memory.focusedOn) as StructureStorage | StructureContainer | Resource | Ruin | Tombstone | null;
    }

    if (!target || (target instanceof Structure && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
        const droppedEnergy = context.resources.filter(
            (resource): resource is Resource =>
                resource instanceof Resource && resource.resourceType === RESOURCE_ENERGY
        );

        const withdrawableEnergy = [...context.structures, ...context.ruins].filter(resource => {
            return (
                (resource instanceof StructureStorage && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||
                (resource instanceof StructureContainer && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||
                (resource instanceof Ruin && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||
                (resource instanceof Tombstone && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            );
        });

        if (droppedEnergy.length > 0) {
            target = creep.pos.findClosestByPath(droppedEnergy);
        } else if (withdrawableEnergy.length > 0) {
            target = creep.pos.findClosestByPath(withdrawableEnergy as Array<StructureStorage | StructureContainer | Ruin | Tombstone>);
        }

        if (!target) {
            // if the creep is stuck not getting energy for more than 50 ticks, fallback to searching for haul tasks with energy resource
            if (creep.memory.lastAction && Game.time - creep.memory.lastAction > 50 || !creep.memory.lastAction) {
                const homeRoom = Game.rooms[creep.memory.room];

                const haulTask = Object.values(homeRoom.memory.tasks).find(task => task.type === 'haul' && task.resourceType === RESOURCE_ENERGY && !task.assigned);

                if (haulTask) {
                    creep.memory.focusedOn = haulTask.targetId; // Store the target in memory
                }

                // reset the lastAction timer to avoid repeated attempts
                creep.memory.lastAction = Game.time;

                creep.say(`🧐`);

                return;
            }

            debugLog(`No available energy sources for creep ${creep.name}`);
            creep.say(`⚡ ❌ ${Game.time - creep.memory.lastAction}`);

            return;
        }

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
    } else if (target instanceof Ruin || target instanceof Tombstone) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);

        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
        } else if (withdrawResult === OK) {
            debugLog(`Creep ${creep.name} withdrew energy from Ruin ${target.id}`);

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
        // fire the build action
        const buildResult = creep.build(target);

        if (buildResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        } else if (buildResult === OK) {
            //completeTask(creep);
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

            completeTask(creep);
        }
    }
}