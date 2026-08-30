import { RoomContext, GLOBAL_CONTEXT } from "utils/Context";
import { getTaskById, releaseTask, findTaskForCreep, completeTask, watchForStuckTask } from "utils/TaskManager";
import { runQueen } from './queen';

type EnergyTarget = Source | StructureStorage | StructureContainer | Resource | Ruin | Tombstone;

function isRoomEdge(pos: RoomPosition): boolean {
    return pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49;
}

/**
 * Builder-specific movement wrapper. Builders normally only need range 3 for
 * build/repair/upgrade intents, so do not make Traveler solve a path all the
 * way to range 1. When a creep has just entered a room and is sitting on an
 * exit tile, step inward with a cheap native move before invoking Traveler;
 * starting PathFinder searches from room borders is both fragile and can be
 * surprisingly expensive when repeated.
 */
function moveBuilderTo(
    creep: Creep,
    target: RoomPosition | { pos: RoomPosition },
    range: number = 1
): void {
    if (creep.fatigue > 0) return;

    const pos = target instanceof RoomPosition ? target : target.pos;

    if (pos.roomName === creep.room.name && isRoomEdge(creep.pos)) {
        // Discard Traveler's old edge path and step onto a normal room tile.
        // Use a cardinal inward step so we return through the same traversable
        // exit lane the creep just used instead of diagonally hitting terrain.
        delete creep.memory._trav;
        const inward = creep.pos.x === 0 ? RIGHT
            : creep.pos.x === 49 ? LEFT
                : creep.pos.y === 0 ? BOTTOM
                    : TOP;
        creep.move(inward);
        return;
    }

    creep.travelTo(target, { range });
}

function repairCompletionHits(target: Structure): number {
    // Roads are selected for repair below 25%. Bringing them back to 50% is
    // enough to keep them out of the repair queue while avoiding builders
    // spending many extra ticks topping every road up to 100%.
    if (target.structureType === STRUCTURE_ROAD) {
        return Math.ceil(target.hitsMax * 0.5);
    }

    return target.hitsMax;
}

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
        moveBuilderTo(creep, storage, 1);
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
        moveBuilderTo(creep, closestSource, 1);
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
        moveBuilderTo(creep, target, 1);
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
        moveBuilderTo(creep, new RoomPosition(25, 25, task.roomId), 20); // Cross into the target room; exact center is unnecessary

        return;
    }

    const target = Game.getObjectById(task.targetId) as ConstructionSite | Structure | null;
    if (!target) {
        debugLog(`Construction site with ID ${task.targetId} not found for creep ${creep.name}`);

        completeTask(creep); // Remove stale tasks so they cannot be immediately reacquired

        return;
    }

    // builders sometimes get stuck, watch for stuck tasks
    if (watchForStuckTask(creep)) return;

    if (target instanceof ConstructionSite) {
        if (!creep.pos.inRangeTo(target, 3)) {
            moveBuilderTo(creep, target, 3);
        } else {
            creep.build(target);
        }
    } else if (target instanceof StructureController) {
        if (!creep.pos.inRangeTo(target, 3)) {
            moveBuilderTo(creep, target, 3);
        } else if (creep.upgradeController(target) === OK) {
            // If the controller is upgraded successfully, sign it if necessary
            if (Memory.controllerSign && target.sign?.text !== Memory.controllerSign) {
                if (!creep.pos.isNearTo(target)) {
                    moveBuilderTo(creep, target, 1);
                } else {
                    creep.signController(target, Memory.controllerSign);
                }
            }
        }
    } else if (target instanceof Structure) {
        const completionHits = repairCompletionHits(target);

        // A stale repair task can survive after another builder/tower finishes
        // the target. Complete it immediately instead of waiting 200 ticks.
        if (target.hits >= completionHits) {
            completeTask(creep);
            return;
        }

        if (!creep.pos.inRangeTo(target, 3)) {
            moveBuilderTo(creep, target, 3);
            return;
        }

        const repairResult = creep.repair(target);
        if (repairResult === OK) {
            const repairPower = creep.getActiveBodyparts(WORK) * REPAIR_POWER;
            // Structure.hits is not updated until intents resolve. Predict the
            // post-repair value so the task can be removed on the finishing tick.
            if (target.hits + repairPower >= completionHits) {
                completeTask(creep);
            }
        } else if (repairResult === ERR_INVALID_TARGET) {
            completeTask(creep);
        }
    }
}
