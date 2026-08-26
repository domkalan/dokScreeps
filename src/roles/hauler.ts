import { RoomContext } from "../utils/Context";
import { completeTask, findTaskForCreep, getTaskById, releaseTask, watchForStuckTask } from "../utils/TaskManager";
import { goForEnergy } from "./builder";
import { runQueen } from "./queen";

/**
 * This task is responsible for running a hauler creep in fill mode.
 * 
 * The hauler will attempt to find a task to fill energy into a structure or storage.
 * @param creep 
 * @param context 
 */
export function runFillTask(creep: Creep, context: RoomContext) {
    // if creep does not have a task, attempt to find a task
    if (!creep.memory.taskId) {
        const task = findTaskForCreep(creep, 'fill');
        if (task) {
            creep.memory.taskId = task.id;
            creep.memory.taskStarted = Game.time; // Record the time when the task was started

            task.assigned = creep.name;
        } else {
            runQueen(creep, context);

            return;
        }
    }

    // validate the task still exists and is valid
    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        releaseTask(creep); // Clear the invalid task ID

        return;
    }

    // before running the task, make sure the creep has energy to carry
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep, context);

        return;
    }

    // travel to the room of the task if not already there
    if (creep.room.name !== task.roomId) {
        creep.travelTo(new RoomPosition(25, 25, task.roomId));

        return;
    }

    // validate that the target is still valid
    const target = Game.getObjectById(task.targetId) as Structure | null;
    if (!target) {
        debugLog(`Target with ID ${task.targetId} not found for creep ${creep.name}`);

        completeTask(creep); // Mark the task as complete since the target is no longer valid
        return;
    }

    // watch for stuck tasks, haulers sometimes get stuck
    if (watchForStuckTask(creep)) return;

    // run a fill action based on the type of target
    if (target instanceof Structure) {
        if (!creep.pos.isNearTo(target)) {
            creep.travelTo(target);
            return;
        }

        const transferResult = creep.transfer(target, RESOURCE_ENERGY);
        if (transferResult === ERR_FULL) {
            debugLog(`Target ${target.id} is full for creep ${creep.name}`);

            // mark the task as completed since the target is full
            completeTask(creep);
        } else if (transferResult === ERR_NOT_ENOUGH_RESOURCES) {
            debugLog(`Creep ${creep.name} does not have enough resources to fill target ${target.id}`);

            // mark the task as completed since the creep does not have enough resources
            releaseTask(creep);
        } else if (transferResult === OK) {
            completeTask(creep);
        }
    }
}

export function depositToStorage(creep: Creep, context: RoomContext) {
    const storage = context.room.storage;

    if (storage) {
        const resources = Object.keys(creep.store) as ResourceConstant[];
        if (resources.length > 0) {
            const resourceType = resources[0]; // Assuming we only want to deposit one type of resource at a time
            if (!creep.pos.isNearTo(storage)) {
                creep.travelTo(storage);
            } else {
                creep.transfer(storage, resourceType);
            }
        }
    } else {
        // if not else just fill spawn and extensions
        let target: StructureSpawn | StructureExtension | undefined;
        for (const receiver of context.spawnEnergyReceivers) {
            if (receiver.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                target = receiver;
                break;
            }
        }

        if (target) {
            const storeKeys = Object.keys(creep.store);

            if (!creep.pos.isNearTo(target)) {
                creep.travelTo(target);
            } else {
                creep.transfer(target, storeKeys[0] as ResourceConstant);
            }
        } else {
            const spawn = context.spawns[0];
            if (spawn) {
                if (!creep.pos.isNearTo(spawn)) {
                    creep.travelTo(spawn);

                    return;
                }

                const storeKeys = Object.keys(creep.store);

                creep.drop(storeKeys[0] as ResourceConstant);
            }
        }
    }
}

export function runHauler(creep: Creep, context: RoomContext) {
    // if creep does not have a task, attempt to find a task
    if (!creep.memory.taskId) {
        const task = findTaskForCreep(creep, 'haul');
        if (task) {
            creep.memory.taskId = task.id;
            creep.memory.taskStarted = Game.time; // Record the time when the task was started

            task.assigned = creep.name;
        } else {
            // no task was assigned, so the creep should idle
            runFillTask(creep, context);

            return;
        }
    }

    // validate the task still exists and is valid
    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        releaseTask(creep); // Clear the invalid task ID

        return;
    }

    // if the task is a fill task, run the fill task function
    if (task.type === 'fill') {
        runFillTask(creep, context);

        return;
    }

    // before running the task, make sure the creep has 100% free capacity to carry
    if (creep.store.getFreeCapacity() !== creep.store.getCapacity()) {
        depositToStorage(creep, context);

        return;
    }

    // travel to the room of the task if not already there
    if (creep.room.name !== task.roomId) {
        creep.travelTo(new RoomPosition(25, 25, task.roomId));

        return;
    }

    // validate that the target is still valid
    const target = Game.getObjectById(task.targetId) as Resource | Structure | null;
    if (!target) {
        debugLog(`Target with ID ${task.targetId} not found for creep ${creep.name}`);

        completeTask(creep); // Mark the task as complete since the target is no longer valid

        return;
    }

    // haulers sometimes get stuck, watch for stuck tasks
    if (watchForStuckTask(creep)) return;

    // run a pickup or withdraw action based on the type of target
    if (target instanceof Resource) {
        // if the resource is under 50, complete the task and return to avoid wasting time on a nearly depleted resource
        if (target.amount <= 50) {
            completeTask(creep);

            return;
        }

        if (!creep.pos.isNearTo(target)) {
            creep.travelTo(target);
        } else {
            creep.pickup(target);
        }
    } else if (target instanceof Structure) {
        if (!creep.pos.isNearTo(target)) {
            creep.travelTo(target);
            return;
        }

        const withdrawResult = creep.withdraw(target, task.resourceType || RESOURCE_ENERGY);
        if (withdrawResult === ERR_NOT_ENOUGH_RESOURCES) {
            debugLog(`Target ${target.id} does not have enough resources for creep ${creep.name}`);

            // mark the task as completed since the target does not have enough resources
            completeTask(creep);
        } else if (withdrawResult !== OK) {
            debugLog(`Unexpected result from withdraw: ${withdrawResult}`);
        }
    }
}
