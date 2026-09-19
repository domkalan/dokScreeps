interface TaskIndexEntry {
    tick: number;
    byType: { [type: string]: RoomTask[] };
    counts: { [role: string]: number };
}

// Heap-only, per-tick task index. This avoids every idle creep walking the full
// RoomMemory.tasks object independently. References point at the live Memory
// task objects, so assignment/completion changes are visible immediately.
const TASK_INDEX: { [roomName: string]: TaskIndexEntry } = {};

function invalidateTaskIndex(roomName: string): void {
    delete TASK_INDEX[roomName];
}

function buildTaskIndex(roomName: string): TaskIndexEntry {
    const cached = TASK_INDEX[roomName];
    if (cached && cached.tick === Game.time) return cached;

    const byType: { [type: string]: RoomTask[] } = {};
    const counts: { [role: string]: number } = {};
    const tasks = Memory.rooms[roomName]?.tasks || {};

    for (const taskId in tasks) {
        const task = tasks[taskId];
        if (task.completed || task.expires <= Game.time) continue;

        if (!byType[task.type]) byType[task.type] = [];
        byType[task.type].push(task);

        switch (task.type) {
            case 'harvest': counts.harvester = (counts.harvester || 0) + 1; break;
            case 'haul': counts.hauler = (counts.hauler || 0) + 1; break;
            case 'fill': counts.filler = (counts.filler || 0) + 1; break;
            case 'build': counts.builder = (counts.builder || 0) + 1; break;
            case 'attack': counts.attacker = (counts.attacker || 0) + 1; break;
            case 'claim':
            case 'reserve':
                counts.claimer = (counts.claimer || 0) + 1;
                if (task.priority === 1) counts.claimer++;
                break;
        }
    }

    // Priority is stable for the rest of the tick in normal operation. Sorting
    // once makes assignment O(number of tasks of this type) with an early exit,
    // rather than O(all room tasks) per creep.
    for (const type in byType) {
        byType[type].sort((a, b) => a.priority - b.priority);
    }

    return TASK_INDEX[roomName] = { tick: Game.time, byType, counts };
}

export function getTaskById(roomName: string, taskId: string): RoomTask | undefined {
    return Memory.rooms[roomName]?.tasks?.[taskId] || undefined;
}

export function findTaskForCreep(creep: Creep, taskType: string): RoomTask | undefined {
    const tasks = Memory.rooms[creep.memory.room]?.tasks;
    if (!tasks) return undefined;

    if (creep.memory.taskId) {
        const current = tasks[creep.memory.taskId];
        if (current && !current.completed && current.type === taskType) return current;
    }

    const candidates = buildTaskIndex(creep.memory.room).byType[taskType];
    if (!candidates) return undefined;

    for (const task of candidates) {
        if (!task.assigned && !task.completed) return task;
    }

    return undefined;
}

export function createTask(room: Room, type: string, targetId: string, priority: number, roomId?: string, action?: string, expires?: number, resourceType?: ResourceConstant, resourceAmount?: number): RoomTask {
    if (!room.memory.tasks) room.memory.tasks = {};

    const taskId = `${type}-${targetId}`;
    const expiresAt = expires ? Game.time + expires : Game.time + 1000;
    const existing = room.memory.tasks[taskId];

    if (existing) {
        // Avoid repeatedly dirtying Memory when scanners rediscover an identical
        // task. Expiration is only refreshed near expiry instead of every scan.
        let changed = false;
        if (existing.priority !== priority) { existing.priority = priority; changed = true; }
        if (existing.resourceType !== resourceType) { existing.resourceType = resourceType; changed = true; }
        if (existing.resourceAmount !== resourceAmount) { existing.resourceAmount = resourceAmount; changed = true; }
        if (existing.roomId !== (roomId || room.name)) { existing.roomId = roomId || room.name; changed = true; }
        if (existing.action !== action) { existing.action = action; changed = true; }
        if (existing.expires - Game.time < 50) { existing.expires = expiresAt; changed = true; }
        if (changed) invalidateTaskIndex(room.name);
        return existing;
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
        resourceAmount: resourceAmount || Infinity,
        created: Game.time,
        expires: expiresAt
    };

    room.memory.tasks[taskId] = task;
    invalidateTaskIndex(room.name);
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
        delete creep.memory.taskId;

        if (!creep.memory.completedTasks) creep.memory.completedTasks = 0;
        if (taskId) creep.memory.completedTasks++;
        if (!taskId) return;

        const tasks = Memory.rooms[creep.memory.room]?.tasks;
        if (tasks?.[taskId]) {
            delete tasks[taskId];
            invalidateTaskIndex(creep.memory.room);
        }
    } catch (error) {
        debugLog(`Error setting a task completed for creep ${creep.name}: ${error}`);
    }
}

export function releaseTask(creep: Creep): void {
    if (!creep.memory.taskId) return;
    const task = Memory.rooms[creep.memory.room]?.tasks?.[creep.memory.taskId];
    if (task) delete task.assigned;
    else debugLog(`Task with ID ${creep.memory.taskId} not found in home room ${creep.memory.room}`);
    delete creep.memory.taskId;
}

export function deleteTask(creep: Creep): void {
    if (!creep.memory.taskId) return;
    const tasks = Memory.rooms[creep.memory.room]?.tasks;
    const taskId = creep.memory.taskId;
    if (tasks?.[taskId]) {
        delete tasks[taskId];
        invalidateTaskIndex(creep.memory.room);
    } else {
        debugLog(`Task with ID ${taskId} not found in home room ${creep.memory.room}`);
    }
    delete creep.memory.taskId;
}

export function monitorTasks(room: Room): void {
    const tasks = room.memory.tasks || {};
    const now = Game.time;
    let changed = false;

    for (const taskId in tasks) {
        const task = tasks[taskId];
        if (task.expires <= now) {
            delete tasks[taskId];
            changed = true;
            continue;
        }

        if (task.assigned) {
            const assignedCreep = Game.creeps[task.assigned];
            if (!assignedCreep || assignedCreep.memory.taskId !== taskId) delete task.assigned;
        }
    }

    if (changed) invalidateTaskIndex(room.name);
}

export function getTaskCounts(room: Room): { [role: string]: number } {
    return buildTaskIndex(room.name).counts;
}

export function purgeTaskById(taskId: string, roomName: string): void {
    const room = Game.rooms[roomName];
    if (!room) {
        debugLog(`Room ${roomName} not found while trying to purge task ${taskId}`);
        return;
    }

    if (room.memory.tasks?.[taskId]) {
        delete room.memory.tasks[taskId];
        invalidateTaskIndex(roomName);
        debugLog(`Purged task ${taskId} from room ${roomName}`);
    } else {
        debugLog(`Task ${taskId} not found in room ${roomName} while trying to purge`);
    }
}

export function watchForStuckTask(creep: Creep): boolean {
    if (!creep.memory.taskId) return false;
    const task = getTaskById(creep.memory.room, creep.memory.taskId);

    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        releaseTask(creep);
        return false;
    }

    if (task.expires <= Game.time || (creep.memory.taskStarted && Game.time - creep.memory.taskStarted > 200)) {
        debugLog(`Task with ID ${creep.memory.taskId} has expired for creep ${creep.name}`);
        releaseTask(creep);
        creep.say(`🛑 T_EXP`);
        return true;
    }

    return false;
}
