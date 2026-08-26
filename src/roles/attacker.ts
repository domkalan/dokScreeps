import { RoomContext } from "utils/Context";
import { completeTask, findTaskForCreep, getTaskById } from '../utils/TaskManager';
import { runDefender } from './defender';

export function runAttacker(creep: Creep, context: RoomContext): void {
    // does this creep have a task? if not, find one
    if (!creep.memory.taskId) {
        const attackTask = findTaskForCreep(creep, 'attack');

        if (!attackTask) {
            runDefender(creep, context); // If no attack task is found, run the defender logic

            return;
        }

        creep.memory.taskId = attackTask.id;
        creep.memory.taskStarted = Game.time; // Record the time when the task was started
    }

    // validate the task still exists and is valid
    const attackTask = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!attackTask) {

        creep.memory.taskId = undefined; // Clear the invalid task ID

        return;
    }

    // if the creep is outside of the task room, go there
    if (creep.room.name !== attackTask.roomId) {
        creep.travelTo(new RoomPosition(25, 25, attackTask.roomId));

        return;
    }

    // validate the target is still valid
    const target = Game.getObjectById(attackTask.targetId) as Creep | Structure;
    if (!target) {
        debugLog(`Creep ${creep.name} has no valid target to attack.`);

        completeTask(creep); // Mark the task as complete if the target is invalid

        return;
    }

    if (!creep.pos.isNearTo(target)) {
        creep.travelTo(target);
    } else {
        creep.attack(target);
    }
}
