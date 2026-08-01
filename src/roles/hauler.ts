import { RoomContext } from 'utils/Context';
import { completeTask, deleteTask, findTaskForCreep, getTaskById, releaseTask } from '../utils/TaskManager';
import { goForEnergy } from './builder';
import { runQueen } from './queen';
import { getStoredEnergy } from '../rooms';

export function depositInventory(creep: Creep, context: RoomContext): void {
    let target: StructureStorage | StructureContainer | StructureSpawn | StructureLink | null = null;

    if (creep.memory.focusedOn) {
        debugLog(`Creep ${creep.name} is focused on ${creep.memory.focusedOn}`);

        target = Game.getObjectById(creep.memory.focusedOn) as StructureStorage | StructureContainer;
    }

    if (!target) {
        const possibleTargets = context.structures.filter(structure => {
            return ((structure.structureType === STRUCTURE_STORAGE || structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_LINK) &&
                (structure as StructureStorage | StructureContainer | StructureSpawn).store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
                (structure.structureType === STRUCTURE_SPAWN);
        });

        if (possibleTargets.length > 0) {
            target = creep.pos.findClosestByRange(possibleTargets) as StructureStorage | StructureContainer | StructureSpawn | StructureLink | null;

            if (target) {
                debugLog(`Creep ${creep.name} found a new target ${target.id} to deposit energy.`);
                creep.memory.focusedOn = target.id; // Set the focusedOn memory to the new target
            }
        }
    }

    if (!target) {
        debugLog(`Creep ${creep.name} has no valid target to deposit energy.`);
        delete creep.memory.focusedOn; // Clear the focusedOn memory if no valid target is found
        return;
    }

    // if spawn is selected, we drop on the ground near the spawn
    if (target.structureType === 'spawn') {
        if (!creep.pos.isNearTo(target)) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });

            return;
        }

        // drop energy on the ground near the spawn
        creep.drop(RESOURCE_ENERGY);

        debugLog(`Creep ${creep.name} dropped energy near spawn.`);

        return;
    }

    const transferResult = creep.transfer(target, RESOURCE_ENERGY);

    if (transferResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
    } else if (transferResult === OK) {
        debugLog(`Creep ${creep.name} successfully deposited energy into ${target.structureType} (${target.id}).`);

        delete creep.memory.focusedOn; // Clear the focusedOn memory after successful transfer
    } else if (transferResult === ERR_FULL) {
        creep.drop(RESOURCE_ENERGY);

        debugLog(`Creep ${creep.name} attempted to deposit energy into ${target.structureType} (${target.id}) but it is already full.`);

        delete creep.memory.focusedOn; // Clear the focusedOn memory since the target is full
    } else {
        debugLog(`Creep ${creep.name} failed to deposit energy into ${target.structureType} (${target.id}) with error code: ${transferResult}`);
    }
}

export function runFill(creep: Creep, context: RoomContext): void {
    // ensure task remains valid
    if (!creep.memory.taskId) {
        debugLog(`Creep ${creep.name} has no valid task ID for filling.`);
        return;
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId);

    // ensure task is still valid and of type 'fill'
    if (!task || task.type !== 'fill') {
        debugLog(`Task with ID ${creep.memory.taskId} not found or is not a fill task for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    if (creep.store[RESOURCE_ENERGY] === 0) {
        debugLog(`Creep ${creep.name} has no energy to fill structures.`);

        goForEnergy(creep, context); // Attempt to get energy from nearby storage or dropped energy

        return;
    }

    // get the target
    const target = Game.getObjectById(task?.targetId) as StructureSpawn | StructureExtension | StructureTower | null;

    // if target is invalid or full, clear the focusedOn memory and return
    if (!target) {
        delete creep.memory.focusedOn; // Clear the focusedOn memory if the target is invalid or full
        debugLog(`Creep ${creep.name} has no valid fill target.`);
        return;
    }

    const transferResult = creep.transfer(target, RESOURCE_ENERGY);

    if (transferResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
    } else if (transferResult === OK) {
        debugLog(`Creep ${creep.name} successfully filled ${target.structureType} (${target.id}).`);

        completeTask(creep); // Mark the task as complete after successfully filling the target
    } else if (transferResult === ERR_FULL) {
        debugLog(`Creep ${creep.name} attempted to fill ${target.structureType} (${target.id}) but it is already full.`);

        completeTask(creep); // Mark the task as complete since the target is full
    } else {
        debugLog(`Creep ${creep.name} failed to fill ${target.structureType} (${target.id}) with error code: ${transferResult}`);
    }
}

export function runHaul(creep: Creep, context: RoomContext): void {
    // ensure task remains valid
    if (!creep.memory.taskId) {
        debugLog(`Creep ${creep.name} has no valid task ID for hauling.`);
        return;
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId);

    // ensure task is still valid and of type 'haul'
    if (!task || task.type !== 'haul') {
        debugLog(`Task with ID ${creep.memory.taskId} not found or is not a haul task for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    // get the target
    const target = Game.getObjectById(task?.targetId) as Resource | Ruin | Tombstone | null;

    // if target is invalid or empty, clear the focusedOn memory and return
    if (!target || (target instanceof Resource && target.amount === 0)) {
        deleteTask(creep); // Clear the task since the target is invalid or empty

        debugLog(`Creep ${creep.name} has no valid haul target.`);

        return;
    }

    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        debugLog(`Creep ${creep.name} has no free capacity to haul energy.`);

        depositInventory(creep, context); // Attempt to deposit energy into storage or container

        return;
    }

    if (target instanceof Ruin || target instanceof Tombstone || target instanceof StructureContainer || target instanceof StructureStorage) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);

        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        } else if (withdrawResult === OK) {
            debugLog(`Creep ${creep.name} successfully hauled energy from ${target instanceof Resource ? 'Resource' : target instanceof Ruin ? 'Ruin' : 'Tombstone'} (${target.id}).`);

            completeTask(creep); // Mark the task as complete after successfully hauling energy
        } else {
            debugLog(`Creep ${creep.name} failed to haul energy from ${target instanceof Resource ? 'Resource' : target instanceof Ruin ? 'Ruin' : 'Tombstone'} (${target.id}) with error code: ${withdrawResult}`);
        }
    } else if (target instanceof Resource) {
        const pickupResult = creep.pickup(target);

        if (pickupResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        } else if (pickupResult === OK) {
            debugLog(`Creep ${creep.name} successfully hauled energy from Resource (${target.id}).`);

            completeTask(creep); // Mark the task as complete after successfully hauling energy
        } else {
            debugLog(`Creep ${creep.name} failed to haul energy from Resource (${target.id}) with error code: ${pickupResult}`);
        }
    }
}

// hauler main loop
export function runHauler(creep: Creep, context: RoomContext): void {
    // get the current task
    let currentTask = creep.memory.taskId ? getTaskById(creep.memory.room, creep.memory.taskId) : null;

    // if no task attempt to assign a new task
    if (!currentTask) {
        const task = findTaskForCreep(creep, 'haul');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.name;
            currentTask = task;
        } else if (getStoredEnergy(context) > creep.store.getFreeCapacity()) {
            const fillTask = findTaskForCreep(creep, 'fill');
            if (fillTask) {
                creep.memory.taskId = fillTask.id;
                fillTask.assigned = creep.name;
                currentTask = fillTask;
            } else {
                debugLog(`No available haul or fill tasks for creep ${creep.name}`);

                runQueen(creep, context); // Attempt to upgrade the controller if no haul or fill tasks are available

                return;
            }
        } else {
            debugLog(`No available haul or fill tasks for creep ${creep.name}`);

            runQueen(creep, context); // Attempt to upgrade the controller if no haul or fill tasks are available

            return;
        }
    }

    // if the creep is on a filling task, branch
    if (currentTask && currentTask.type === 'fill') {
        runFill(creep, context);

        return;
    }

    // if the creep is on a hauling task, branch
    if (currentTask && currentTask.type === 'haul') {
        runHaul(creep, context);

        return;
    }
}
