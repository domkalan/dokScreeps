import { RoomContext, GLOBAL_CONTEXT } from "utils/Context";
import { getTaskById, releaseTask, findTaskForCreep, completeTask, watchForStuckTask } from "utils/TaskManager";
import { runQueen } from './queen';

export function bootstrapEnergy(creep: Creep): void {
    const sources = [
        ...GLOBAL_CONTEXT[creep.room.name] ? GLOBAL_CONTEXT[creep.room.name].sources : [],
        ...GLOBAL_CONTEXT[creep.room.name] ? GLOBAL_CONTEXT[creep.room.name].resources : []
    ] as Array<Source | Resource | Ruin | Tombstone>;

    if (sources.length === 0) {
        debugLog(`No energy sources available for creep ${creep.name} in room ${creep.room.name}`);

        creep.say('❌⚡');

        return;
    }

    const closestSource = creep.pos.findClosestByRange(sources);

    if (!closestSource) {
        debugLog(`No reachable energy sources for creep ${creep.name} in room ${creep.room.name}`);

        creep.say('❌⚡');

        return;
    }

    creep.memory.focusedOn = 'bootstrap_' + closestSource.id; // Store the target in memory

    if (closestSource instanceof Resource) {
        const pickupResult = creep.pickup(closestSource);

        if (pickupResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(closestSource);
        } else if (pickupResult === OK) {
            debugLog(`Creep ${creep.name} picked up energy from dropped resource ${closestSource.id}`);
        }
    } else if (closestSource instanceof Source) {
        const harvestResult = creep.harvest(closestSource);

        if (harvestResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(closestSource);
        } else if (harvestResult === OK) {
            debugLog(`Creep ${creep.name} harvested energy from source ${closestSource.id}`);
        }
    } else if (closestSource instanceof Ruin || closestSource instanceof Tombstone) {
        const withdrawResult = creep.withdraw(closestSource, RESOURCE_ENERGY);

        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(closestSource);
        } else if (withdrawResult === OK) {
            debugLog(`Creep ${creep.name} withdrew energy from ${closestSource instanceof Ruin ? 'Ruin' : 'Tombstone'} ${closestSource.id}`);
        }
    }
}

export function goForEnergy(creep: Creep, context: RoomContext): void {
    let target = null;

    if (creep.memory.focusedOn) {
        target = Game.getObjectById(creep.memory.focusedOn) as StructureStorage | StructureContainer | Resource | Ruin | Tombstone | null;
    }

    if (!target || (target instanceof Structure && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
        const energySources = [
            ...context.structures,
            ...context.resources,
            ...GLOBAL_CONTEXT[creep.room.name] ? GLOBAL_CONTEXT[creep.room.name].structures : [],
            ...GLOBAL_CONTEXT[creep.room.name] ? GLOBAL_CONTEXT[creep.room.name].resources : []
        ].filter(resource => {
            return (
                // Check if the resource is a structure with energy
                (resource instanceof Structure && (
                    resource.structureType === STRUCTURE_STORAGE ||
                    resource.structureType === STRUCTURE_CONTAINER
                ) && (
                    resource as StructureStorage | StructureContainer
                ).store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||

                // Check if the resource is a Ruin or Tombstone with energy
                (resource instanceof Ruin && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||
                (resource instanceof Tombstone && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||
                // Check if the resource is a dropped energy resource
                (resource instanceof Resource && resource.resourceType === RESOURCE_ENERGY && resource.amount > 50)
            );
        });

        if (energySources.length > 0) {
            target = creep.pos.findClosestByRange(energySources as Array<StructureStorage | StructureContainer | Ruin | Tombstone | Resource>);
        }

        if (!target) {
            debugLog(`No available energy sources for creep ${creep.name}`);

            // haulers should never get stuck waiting for energy
            if (creep.memory.role === 'hauler') {
                releaseTask(creep); // Release the task if the creep has no energy and is a hauler

                return;
            }

            if ((creep.room.name !== creep.memory.room || !context.room.storage) && creep.body.some(part => part.type === WORK)) {
                bootstrapEnergy(creep); // Attempt to get energy from nearby sources if the creep is in a different room

                return;
            }

            creep.say('❌⚡');

            return;
        }

        creep.memory.focusedOn = target?.id; // Store the target in memory
    }

    if (target instanceof Resource) {
        const pickupResult = creep.pickup(target);

        if (pickupResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(target);
        } else if (pickupResult === OK) {
            debugLog(`Creep ${creep.name} picked up energy from dropped resource ${target.id}`);

            delete creep.memory.focusedOn; // Clear the focused target after picking up
        }

        return;
    } else if (target instanceof StructureStorage || target instanceof StructureContainer) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);

        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(target);
        } else if (withdrawResult === OK) {
            debugLog(`Creep ${creep.name} withdrew energy from ${target.structureType} ${target.id}`);
        } else if (withdrawResult === ERR_FULL) {
            debugLog(`Creep ${creep.name} could not withdraw energy from ${target.structureType} ${target.id} because it is full`);

            delete creep.memory.focusedOn; // Clear the focused target after attempting to withdraw
        }

        return;
    } else if (target instanceof Ruin || target instanceof Tombstone) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);

        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(target);
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
    if (creep.memory.focusedOn || creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
            delete creep.memory.focusedOn; // Clear the focused target if the creep is full
            return;
        }

        if (creep.memory.focusedOn?.startsWith('bootstrap_')) {
            bootstrapEnergy(creep); // Attempt to get energy from nearby sources if the creep is in a different room

            return;
        }

        // if the creep has a task, but no energy, release the task so it can go get more energy
        if (creep.memory.taskId) {
            releaseTask(creep); // Release the task if the creep has no energy and is a builder
        }

        goForEnergy(creep, context); // Attempt to get energy from nearby storage or dropped energy

        return;
    }

    if (!creep.memory.taskId) {
        // Assign a new task to the builder if it doesn't have one
        const task = findTaskForCreep(creep, 'build');
        if (task) {
            creep.memory.taskId = task.id;
            creep.memory.taskStarted = Game.time; // Record the time when the task was started

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

        releaseTask(creep); // Release the task if it no longer exists

        return;
    }

    // task is not in the same room as the creep, so we should move to the target room first before attempting to build
    if (task.roomId && task.roomId !== creep.room.name) {
        creep.travelTo(new RoomPosition(25, 25, task.roomId)); // Move to the center of the target room

        return;
    }

    const target = Game.getObjectById(task.targetId) as ConstructionSite | Structure | null;
    if (!target) {
        debugLog(`Construction site with ID ${task.targetId} not found for creep ${creep.name}`);

        releaseTask(creep); // Release the task if the target is no longer valid

        return;
    }

    // builders sometimes get stuck, watch for stuck tasks
    watchForStuckTask(creep);

    if (target instanceof ConstructionSite) {
        // fire the build action
        const buildResult = creep.build(target);

        if (buildResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(target);
        }
    } else if (target instanceof StructureController) {
        const upgradeResult = creep.upgradeController(target);

        if (upgradeResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(target);
        } else if (upgradeResult === OK) {
            // If the controller is upgraded successfully, sign it if necessary
            if (Memory.controllerSign && target.sign?.text !== Memory.controllerSign) {
                const signResult = creep.signController(target, Memory.controllerSign);

                if (signResult === ERR_NOT_IN_RANGE) {
                    creep.travelTo(target);
                }
            }
        }
    } else if (target instanceof Structure) {
        const repairResult = creep.repair(target);

        if (repairResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(target);
        }
    }
}