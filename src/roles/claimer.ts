import { RoomContext } from 'utils/Context';
import { findTaskForCreep, getTaskById, releaseTask, completeTask } from '../utils/TaskManager';

export function returnHome(creep: Creep, context: RoomContext): void {
    const homeRoomName = creep.memory.room;

    if (creep.room.name !== homeRoomName) {
        creep.travelTo(new RoomPosition(25, 25, homeRoomName));

        return;
    }

    // Once the creep is in its home room, we can clear its taskId to allow it to take on new tasks
    if (creep.memory.taskId) {
        const task = getTaskById(homeRoomName, creep.memory.taskId);
        if (task) {
            task.assigned = undefined; // Unassign the task
        }
        releaseTask(creep); // Clear the task ID from the creep's memory
    }
}

export function runReserver(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        const task = findTaskForCreep(creep, 'reserve');
        if (task) {
            creep.memory.taskId = task.id;
            creep.memory.taskStarted = Game.time; // Record the time when the task was started

            task.assigned = creep.name;
        } else {
            returnHome(creep, context); // If no reserve task is found, return home

            return;
        }
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);

        releaseTask(creep); // Clear the invalid task ID

        return;
    }

    if (creep.room.name !== task.roomId) {
        // Travel to the target room
        creep.travelTo(new RoomPosition(25, 25, task.roomId));

        return;
    }

    const target = Game.getObjectById(task.targetId) as StructureController | null;
    if (!target) {
        debugLog(`Target with ID ${task.targetId} not found for creep ${creep.name}`);

        completeTask(creep); // Mark the task as complete since the target is no longer valid

        return;
    }

    const reserveResult = creep.reserveController(target);
    if (reserveResult === ERR_NOT_IN_RANGE) {
        creep.travelTo(target);
    } else if (reserveResult === OK) {
        debugLog(`Creep ${creep.name} successfully reserved controller in room ${task.roomId}`);
        completeTask(creep); // Mark the task as complete
    } else {
        debugLog(`Creep ${creep.name} failed to reserve controller in room ${task.roomId} with error: ${reserveResult}`);
    }
}

export function runClaimer(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        const task = findTaskForCreep(creep, 'claim');
        if (task) {
            creep.memory.taskId = task.id;
            creep.memory.taskStarted = Game.time; // Record the time when the task was started

            task.assigned = creep.name;
        } else {
            runReserver(creep, context); // If no claim task is found, fallback to reserving the controller

            return;
        }
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);

        releaseTask(creep); // Clear the invalid task ID

        return;
    }

    if (creep.room.name !== task.roomId) {
        // Travel to the target room
        creep.travelTo(new RoomPosition(25, 25, task.roomId));

        return;
    }

    const target = Game.rooms[task.roomId]?.controller;

    if (!target) {
        debugLog(`Controller not found in room ${task.roomId} for creep ${creep.name}`);

        completeTask(creep); // Mark the task as complete since the target is no longer valid

        return;
    }

    const claimResult = creep.claimController(target);
    if (claimResult === ERR_NOT_IN_RANGE) {
        creep.travelTo(target);
    } else if (claimResult === OK) {
        debugLog(`Creep ${creep.name} successfully claimed controller in room ${task.roomId}`);
        completeTask(creep); // Mark the task as complete
    } else {
        debugLog(`Creep ${creep.name} failed to claim controller in room ${task.roomId} with error: ${claimResult}`);
    }
}