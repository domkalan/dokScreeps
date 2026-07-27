import { RoomContext } from 'utils/Context';
import { completeTask, findTaskForCreep, getTaskById } from '../utils/TaskManager';
import { runQueen } from './queen';
import { goForEnergy } from './builder';

export function depositInventory(creep: Creep, context: RoomContext): void {
    let target: StructureStorage | StructureContainer | null = null;

    if (creep.memory.focusedOn) {
        debugLog(`Creep ${creep.name} is focused on ${creep.memory.focusedOn}`);

        target = Game.getObjectById(creep.memory.focusedOn) as StructureStorage | StructureContainer;
    }

    if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        // Find the closest storage or container with free capacity
        const possibleTargets = context.structures.filter(structure => {
            return (structure.structureType === STRUCTURE_STORAGE || structure.structureType === STRUCTURE_CONTAINER);
        }) as Array<StructureStorage | StructureContainer>;

        const targets = possibleTargets.filter(structure => {
            return (structure as StructureStorage | StructureContainer).store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }) as Array<StructureStorage | StructureContainer>;

        if (targets.length === 0) {
            debugLog(`No available storage or container to deposit energy for creep ${creep.name}`);

            // if no storage hauler will go near controller and drop energy
            if (!creep.pos.isNearTo(possibleTargets[0])) {
                creep.moveTo(possibleTargets[0], { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });

                return;
            }

            creep.drop(RESOURCE_ENERGY);

            return;
        }

        target = targets[0];
        creep.memory.focusedOn = target?.id; // Store the target in memory
    }

    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
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
        delete creep.memory.focusedOn; // Clear the focusedOn memory once energy is transferred
        debugLog(`Creep ${creep.name} successfully filled ${target.structureType} (${target.id}).`);

        completeTask(creep); // Mark the task as complete after successfully filling the target
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
        delete creep.memory.focusedOn; // Clear the focusedOn memory if the target is invalid or empty
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
            delete creep.memory.focusedOn; // Clear the focusedOn memory once energy is withdrawn
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
            delete creep.memory.focusedOn; // Clear the focusedOn memory once energy is picked up
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
        const task = findTaskForCreep(creep, 'haul') || findTaskForCreep(creep, 'fill');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.name;
            currentTask = task;
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
