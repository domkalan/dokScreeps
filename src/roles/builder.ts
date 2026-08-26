import { RoomContext, GLOBAL_CONTEXT } from "utils/Context";
import { getTaskById, releaseTask, findTaskForCreep, completeTask, watchForStuckTask } from "utils/TaskManager";
import { runQueen } from './queen';

type EnergyTarget = Source | StructureStorage | StructureContainer | Resource | Ruin | Tombstone;

function hasWithdrawableEnergy(target: EnergyTarget): boolean {
    if (target instanceof StructureStorage || target instanceof StructureContainer ||
        target instanceof Ruin || target instanceof Tombstone) {
        return target.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
    }
    return target instanceof Resource && target.resourceType === RESOURCE_ENERGY && target.amount > 50;
}

function isBootstrapEnergyTarget(target: EnergyTarget): boolean {
    return (target instanceof Source && target.energy > 0) ||
        (target instanceof Resource && target.resourceType === RESOURCE_ENERGY && target.amount > 0);
}

function unloadNonEnergyCargo(creep: Creep, context: RoomContext): boolean {
    let resourceType: ResourceConstant | undefined;
    for (const storedResource in creep.store) {
        if (storedResource !== RESOURCE_ENERGY && creep.store[storedResource as ResourceConstant] > 0) {
            resourceType = storedResource as ResourceConstant;
            break;
        }
    }

    if (!resourceType) return false;

    delete creep.memory.focusedOn;
    const currentContext = GLOBAL_CONTEXT[creep.room.name] || context;
    const storage = currentContext.room.storage || currentContext.storages[0];

    if (!storage || storage.store.getFreeCapacity(resourceType) === 0) {
        creep.drop(resourceType);
        return true;
    }

    if (!creep.pos.isNearTo(storage)) {
        creep.travelTo(storage);
    } else {
        creep.transfer(storage, resourceType);
    }

    return true;
}

function closestByRange(
    creep: Creep,
    targetGroups: ReadonlyArray<ReadonlyArray<EnergyTarget>>,
    usable?: (target: EnergyTarget) => boolean
): EnergyTarget | null {
    let closest: EnergyTarget | null = null;
    let closestRange = Infinity;

    for (const targets of targetGroups) {
        for (const target of targets) {
            if (usable && !usable(target)) continue;
            const range = creep.pos.getRangeTo(target);
            if (range < closestRange) {
                closest = target;
                closestRange = range;
            }
        }
    }

    return closest;
}

export function bootstrapEnergy(creep: Creep): void {
    const currentContext = GLOBAL_CONTEXT[creep.room.name];
    const sources: ReadonlyArray<ReadonlyArray<EnergyTarget>> = currentContext
        ? [currentContext.sources, currentContext.resources]
        : [];

    if (!currentContext || (currentContext.sources.length === 0 && currentContext.resources.length === 0)) {
        debugLog(`No energy sources available for creep ${creep.name} in room ${creep.room.name}`);

        if (Game.time % 25 === 0) {
            creep.say('❌⚡');
        }

        return;
    }

    let closestSource: EnergyTarget | null = null;
    if (creep.memory.focusedOn?.startsWith('bootstrap_')) {
        const focusedId = creep.memory.focusedOn.slice('bootstrap_'.length);
        const focusedTarget = Game.getObjectById(focusedId as Id<any>) as EnergyTarget | null;
        if (focusedTarget && isBootstrapEnergyTarget(focusedTarget)) closestSource = focusedTarget;
    }

    if (!closestSource) {
        closestSource = closestByRange(creep, sources, isBootstrapEnergyTarget);
    }

    if (!closestSource) {
        debugLog(`No reachable energy sources for creep ${creep.name} in room ${creep.room.name}`);

        if (Game.time % 25 === 0) {
            creep.say('❌⚡');
        }

        return;
    }

    creep.memory.focusedOn = 'bootstrap_' + closestSource.id; // Store the target in memory

    if (!creep.pos.isNearTo(closestSource)) {
        creep.travelTo(closestSource);
        return;
    }

    if (closestSource instanceof Resource) {
        const pickupResult = creep.pickup(closestSource);
        if (pickupResult === OK) {
            debugLog(`Creep ${creep.name} picked up energy from dropped resource ${closestSource.id}`);
        }
    } else if (closestSource instanceof Source && closestSource.energy > 0) {
        if (creep.harvest(closestSource) === OK) {
            debugLog(`Creep ${creep.name} harvested energy from source ${closestSource.id}`);
        }
    }
}

export function goForEnergy(creep: Creep, context: RoomContext): void {
    let target = null;

    if (creep.memory.focusedOn) {
        target = Game.getObjectById(creep.memory.focusedOn) as StructureStorage | StructureContainer | Resource | Ruin | Tombstone | null;
    }

    if (!target || !hasWithdrawableEnergy(target)) {
        const currentContext = GLOBAL_CONTEXT[creep.room.name];
        // Only consider targets in the creep's current room. Cross-room objects
        // cannot be meaningfully ranked by range and only add scan work.
        const contexts = [currentContext || context];
        const energySources: Array<ReadonlyArray<EnergyTarget>> = [];

        for (const roomContext of contexts) {
            energySources.push(roomContext.energyStores, roomContext.resources, roomContext.ruins);
        }

        target = closestByRange(creep, energySources, hasWithdrawableEnergy) as StructureStorage | StructureContainer | Resource | Ruin | Tombstone | null;

        if (!target) {
            debugLog(`No available energy sources for creep ${creep.name}`);

            // haulers should never get stuck waiting for energy
            if (creep.memory.role === 'hauler') {
                releaseTask(creep); // Release the task if the creep has no energy and is a hauler

                return;
            }

            if (creep.body.some(part => part.type === WORK)) {
                bootstrapEnergy(creep); // Attempt to get energy from nearby sources if the creep is in a different room

                return;
            }

            if (Game.time % 25 === 0) {
                creep.say('❌⚡');
            }

            return;
        }

        creep.memory.focusedOn = target?.id; // Store the target in memory
    }

    if (!creep.pos.isNearTo(target)) {
        creep.travelTo(target);
        return;
    }

    if (target instanceof Resource) {
        const pickupResult = creep.pickup(target);
        if (pickupResult === OK) {
            debugLog(`Creep ${creep.name} picked up energy from dropped resource ${target.id}`);

            delete creep.memory.focusedOn; // Clear the focused target after picking up
        }

        return;
    } else if (target instanceof StructureStorage || target instanceof StructureContainer) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
        if (withdrawResult === OK) {
            debugLog(`Creep ${creep.name} withdrew energy from ${target.structureType} ${target.id}`);
        } else if (withdrawResult === ERR_FULL) {
            debugLog(`Creep ${creep.name} could not withdraw energy from ${target.structureType} ${target.id} because it is full`);

            delete creep.memory.focusedOn; // Clear the focused target after attempting to withdraw
        }

        return;
    } else if (target instanceof Ruin || target instanceof Tombstone) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
        if (withdrawResult === OK) {
            debugLog(`Creep ${creep.name} withdrew energy from Ruin ${target.id}`);

            delete creep.memory.focusedOn; // Clear the focused target after withdrawing
        }

        return;
    } else {
        debugLog(`Creep ${creep.name} has an invalid target for energy: ${target}`);
        delete creep.memory.focusedOn; // Clear the invalid target from memory
    }

    debugLog(`Creep ${creep.name} could not find any energy sources to withdraw from.`);
    if (Game.time % 25 === 0) {
        creep.say('🤷 ⚡');
    }
}

export function runBuilder(creep: Creep, context: RoomContext): void {
    if (creep.store[RESOURCE_ENERGY] === 0 && unloadNonEnergyCargo(creep, context)) {
        return;
    }

    // if creep has no energy, attempt to find from a nearby storage (link or container) if available
    if (creep.memory.focusedOn || creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
            delete creep.memory.focusedOn; // Clear the focused target if the creep is full
        } else {
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
    if (watchForStuckTask(creep)) return;

    if (target instanceof ConstructionSite) {
        if (!creep.pos.inRangeTo(target, 3)) {
            creep.travelTo(target);
        } else {
            creep.build(target);
        }
    } else if (target instanceof StructureController) {
        if (!creep.pos.inRangeTo(target, 3)) {
            creep.travelTo(target);
        } else if (creep.upgradeController(target) === OK) {
            // If the controller is upgraded successfully, sign it if necessary
            if (Memory.controllerSign && target.sign?.text !== Memory.controllerSign) {
                if (!creep.pos.isNearTo(target)) {
                    creep.travelTo(target);
                } else {
                    creep.signController(target, Memory.controllerSign);
                }
            }
        }
    } else if (target instanceof Structure) {
        if (!creep.pos.inRangeTo(target, 3)) {
            creep.travelTo(target);
        } else {
            creep.repair(target);
        }
    }
}
