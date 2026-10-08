import { RoomContext, GLOBAL_CONTEXT } from "utils/Context";
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
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, attackTask.roomId));

        return;
    }

    // validate the target is still valid
    const target = Game.getObjectById(attackTask.targetId) as Creep | Structure;
    if (!target) {
        debugLog(`Creep ${creep.name} has no valid target to attack.`);

        completeTask(creep); // Mark the task as complete if the target is invalid

        return;
    }

    // if structure is an invader core, handle it differently
    if (target instanceof Structure && target.structureType === STRUCTURE_INVADER_CORE) {
        // Handle invader core specific logic

        if (creep.pos.getRangeTo(target) > 12) {
            if (creep.fatigue === 0) {
                creep.travelTo(target);

                return;
            }

            // scan for creeps in this room within 18 range of the invader core
            const nearbyHostiles = GLOBAL_CONTEXT[creep.room.name].hostiles.filter(hostile => hostile.pos.getRangeTo(target) <= 8);

            if (nearbyHostiles.length > 0) {
                return;
            }

            // if we have ranged attack, attack the invader core from range
            if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
                const rangedAttackResult = creep.rangedAttack(nearbyHostiles[0]);

                if (rangedAttackResult === ERR_NOT_IN_RANGE) {
                    if (creep.fatigue === 0) creep.travelTo(nearbyHostiles[0]);
                }

                return;
            } else {
                // if we don't have ranged attack, move towards the invader core and attack
                const attackResult = creep.attack(nearbyHostiles[0]);

                if (attackResult === ERR_NOT_IN_RANGE) {
                    if (creep.fatigue === 0) creep.travelTo(nearbyHostiles[0]);
                }
            }
        }

        return;
    }

    if (!creep.pos.isNearTo(target)) {
        if (creep.fatigue === 0) creep.travelTo(target);
    } else {
        creep.attack(target);
    }
}
