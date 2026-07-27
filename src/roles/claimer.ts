import { RoomContext } from 'utils/Context';
import { findTaskForCreep, getTaskById, assignTask } from '../utils/TaskManager';

export function retireCreep(creep: Creep, context: RoomContext): void {
    const spawn = context.spawns[0];
    if (!spawn) {
        debugLog(`No spawn found in room ${creep.room.name} for creep ${creep.name} to retire.`);
        return;
    }

    const recycleResult = spawn.recycleCreep(creep);

    if (recycleResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ff0000' }, reusePath: 50 });
    }
}

export function runReserver(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        // Assign a new task to the claimer if it doesn't have one
        const task = findTaskForCreep(creep, 'reserve');
        if (task) {
            creep.memory.taskId = task.id;

            task.assigned = creep.name;
        } else {
            retireCreep(creep, context); // Fallback to retiring the creep if no reserve tasks are available

            return;
        }
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task || (task.type !== 'reserve')) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    // make sure we are in the correct room for the task
    if (creep.room.name !== task.roomId) {
        const exitDir = Game.map.findExit(creep.room.name, task.roomId || '') as any;
        if (exitDir !== ERR_NO_PATH) {
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        } else {
            debugLog(`No path found for creep ${creep.name} to room ${task.roomId}`);
        }
        return;
    }

    // now we are in the correct room, attempt to reserve the controller
    const controller = Game.rooms[task.roomId!]?.controller;
    if (!controller) {
        debugLog(`Controller not found in room ${task.roomId} for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
    } else {
        debugLog(`Creep ${creep.name} has reserved the controller in room ${task.roomId}`);
        delete creep.memory.taskId; // Clear the task ID after successful reserve
    }
}

export function runClaimer(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        // Assign a new task to the claimer if it doesn't have one
        const task = findTaskForCreep(creep, 'claim');
        if (task) {
            creep.memory.taskId = task.id;
            assignTask(creep.room, task.id, creep.name);
        } else {
            runReserver(creep, context); // Fallback to reserver role if no claim tasks are available

            return;
        }
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task || (task.type !== 'claim')) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    // make sure we are in the correct room for the task
    if (task.roomId && creep.room.name !== task.roomId) {
        const exitDir = Game.map.findExit(creep.room.name, task.roomId || '') as any;
        if (exitDir !== ERR_NO_PATH) {
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        } else {
            debugLog(`No path found for creep ${creep.name} to room ${task.roomId}`);
        }
        return;
    }

    // now we are in the correct room, attempt to claim the controller
    const controller = Game.rooms[task.roomId!]?.controller;
    if (!controller) {
        debugLog(`Controller not found in room ${task.roomId} for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    if (creep.claimController(controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
    } else {
        debugLog(`Creep ${creep.name} has claimed the controller in room ${task.roomId}`);
        delete creep.memory.taskId; // Clear the task ID after successful claim
    }
}