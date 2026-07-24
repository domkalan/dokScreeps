import { getOwnedRooms } from "rooms";

export function getTaskById(taskId: string): RoomTask | undefined {
    for (const room of getOwnedRooms()) {
        const task = room.memory.tasks[taskId];
        if (task) {
            return task;
        }
    }
    return undefined;
}

export function findTaskForCreep(creep: Creep, taskType: string): RoomTask | undefined {
    const room = creep.room;
    const tasks = room.memory.tasks;

    // Filter tasks by type and unassigned status
    const availableTasks = Object.entries(tasks)
        .filter(([_, task]) => task.type === taskType && !task.assigned)
        .map(([taskId, task]) => ({ ...task, id: taskId }));

    // Sort tasks by priority (lower number means higher priority)
    availableTasks.sort((a, b) => a.priority - b.priority);

    // Return the highest priority task, if any
    return availableTasks.length > 0 ? availableTasks[0] : undefined;
}