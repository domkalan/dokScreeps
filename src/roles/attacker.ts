import { RoomContext } from "utils/Context";
import { completeTask, findTaskForCreep, getTaskById } from '../utils/TaskManager';
import { runDefender } from './defender';
import { goToRoom } from './harvester';

export function runAttacker(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        const attackTask = findTaskForCreep(creep, 'attack');

        if (!attackTask) {
            runDefender(creep, context); // If no attack task is found, run the defender logic

            return;
        }

        creep.memory.taskId = attackTask.id;
    }

    const attackTask = getTaskById(creep.memory.room, creep.memory.taskId);

    if (!attackTask) {
        creep.memory.focusedOn = undefined; // Clear the focusedOn memory if no attack task is found

        return;
    }

    if (attackTask.roomId !== creep.room.name) {
        goToRoom(creep, attackTask.roomId); // Move to the room of the attack task if not already there

        return;
    }

    const target = Game.getObjectById(attackTask.targetId) as Creep | Structure;

    if (!target) {
        debugLog(`Creep ${creep.name} has no valid target to attack.`);

        completeTask(creep); // Mark the task as complete if the target is invalid

        return;
    }

    if (creep.attack(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' }, reusePath: 50 });
    }
}