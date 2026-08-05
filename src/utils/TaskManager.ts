export function getTaskById(roomName: string, taskId: string): RoomTask | undefined {
    return Memory.rooms[roomName]?.tasks?.[taskId] || undefined;
}

export function findTaskForCreep(
    creep: Creep,
    taskType: string
): RoomTask | undefined {
    const tasks = Memory.rooms[creep.memory.room].tasks;

    if (creep.memory.taskId && tasks[creep.memory.taskId] && !tasks[creep.memory.taskId].completed && tasks[creep.memory.taskId].type === taskType) {
        return tasks[creep.memory.taskId];
    }

    // Find an unassigned task of the specified type
    const tasksFilter = Object.values(tasks).filter(task => task.type === taskType && !task.assigned && !task.completed);

    // Sort tasks by priority (lower number means higher priority)
    tasksFilter.sort((a, b) => a.priority - b.priority);

    return tasksFilter[0]; // Return the highest priority unassigned task
}

export function createTask(room: Room, type: string, targetId: string, priority: number, roomId?: string, action?: string, expires?: number, resourceType?: ResourceConstant): RoomTask {
    // make sure tasks object exists in room memory
    if (!room.memory.tasks) {
        room.memory.tasks = {};
    }

    const taskId = `${type}-${targetId}`;

    if (room.memory.tasks[taskId]) {
        debugLog(`Task ${taskId} already exists in room ${room.name}, resetting expires and priority.`);
        room.memory.tasks[taskId].expires = expires ? Game.time + expires : Game.time + 1000;
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
        expires: expires ? expires + Game.time : Game.time + 1000 // Example expiration time, adjust as needed
    };

    if (!room.memory.tasks) {
        room.memory.tasks = {};
    }

    room.memory.tasks[taskId] = task;
    return task;
}


export function assignTask(creep: Creep, taskId: string): void {
    const task = getTaskById(creep.memory.room, taskId);
    if (task) {
        task.assigned = creep.name;
        creep.memory.taskId = taskId;
    } else {
        debugLog(`Task with ID ${taskId} not found for assignment to creep ${creep.name}`);
    }
}

export function completeTask(creep: Creep): void {
    try {
        const taskId = creep.memory.taskId;
        creep.memory.taskId = undefined; // Clear the task ID from the creep's memory

        if (!taskId) return;

        const task = Memory.rooms[creep.memory.room]?.tasks?.[taskId];

        if (task) {
            delete Memory.rooms[creep.memory.room].tasks[taskId];
        }
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

    creep.memory.taskId = undefined; // Clear the task ID from the creep's memory
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