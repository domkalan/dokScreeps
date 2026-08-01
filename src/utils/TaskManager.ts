export function getTaskById(roomName: string, taskId: string): RoomTask | undefined {
    return Memory.rooms[roomName]?.tasks?.[taskId] || undefined;
}

export function findTaskForCreep(
    creep: Creep,
    taskType: string
): RoomTask | undefined {
    const tasks = Memory.rooms[creep.memory.room].tasks;
    let best: RoomTask | undefined;

    for (const taskId in tasks) {
        const task = tasks[taskId];

        if (task.type !== taskType || task.assigned || task.completed) continue;

        if (!best || task.priority < best.priority) {
            best = task;
        }
    }

    return best;
}

export function createTask(room: Room, type: string, targetId: string, priority: number, roomId?: string, action?: string, expires?: number, resourceType?: ResourceConstant): RoomTask {
    // make sure tasks object exists in room memory
    if (!room.memory.tasks) {
        room.memory.tasks = {};
    }

    const taskId = `${type}-${targetId}`;

    if (room.memory.tasks[taskId]) {
        debugLog(`Task ${taskId} already exists in room ${room.name}, resetting expires and priority.`);
        room.memory.tasks[taskId].expires = expires !== undefined ? expires : Game.time + 1000;
        room.memory.tasks[taskId].priority = priority;
        room.memory.tasks[taskId].resourceType = resourceType;

        return room.memory.tasks[taskId];
    }

    const task: RoomTask = {
        id: taskId,
        type,
        completed: false,
        priority,
        targetId,
        roomId: roomId || room.name,
        action,
        resourceType,
        created: Game.time,
        expires: expires !== undefined ? expires : Game.time + 1000 // Example expiration time, adjust as needed
    };

    if (!room.memory.tasks) {
        room.memory.tasks = {};
    }

    room.memory.tasks[taskId] = task;
    return task;
}


export function assignTask(room: Room, taskId: string, creepName: string): void {
    const task = room.memory.tasks[taskId];
    if (task) {
        task.assigned = creepName;
    } else {
        debugLog(`Task with ID ${taskId} not found in room ${room.name}`);
    }
}

export function completeTask(creep: Creep): void {
    try {
        const taskId = creep.memory.taskId;
        if (!taskId) return;

        const task = Memory.rooms[creep.memory.room]?.tasks?.[taskId];

        if (task) {
            delete Memory.rooms[creep.memory.room].tasks[taskId];
        }

        delete creep.memory.taskId;
    } catch (error) {
        debugLog(`Error setting a task completed for creep ${creep.name}: ${error}`);
    }
}

export function releaseTask(creep: Creep): void {
    if (!creep.memory.taskId) return;

    const task = creep.room.memory.tasks[creep.memory.taskId];

    if (task) {
        task.assigned = undefined; // Unassign the task
    } else {
        debugLog(`Task with ID ${creep.memory.taskId} not found in room ${creep.room.name}`);
    }
}

export function deleteTask(creep: Creep): void {
    if (!creep.memory.taskId) return;

    const task = creep.room.memory.tasks[creep.memory.taskId];

    if (task) {
        delete creep.room.memory.tasks[creep.memory.taskId];
    } else {
        debugLog(`Task with ID ${creep.memory.taskId} not found in room ${creep.room.name}`);
    }

    delete creep.memory.taskId; // Clear the task ID from the creep's memory
}

export function monitorTasks(room: Room): void {
    const now = Game.time;
    for (const taskId in room.memory.tasks) {
        const task = room.memory.tasks[taskId];
        if (task.expires <= now) {
            debugLog(`Task ${taskId} has expired and will be deleted.`);
            delete room.memory.tasks[taskId];
        }
    }

    // Remove invalid tasks from the room's memory and check if assigned creep still exists
    for (const taskId in room.memory.tasks) {
        const task = room.memory.tasks[taskId];

        if (task.assigned && Game.creeps[task.assigned] === undefined) {
            debugLog(`Task ${taskId} was assigned to a non-existent creep ${task.assigned}. Unassigning.`);
            delete task.assigned;
        }
    }
}