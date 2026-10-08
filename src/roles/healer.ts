import { RoomContext, GLOBAL_CONTEXT } from "utils/Context";
import { completeTask, findTaskForCreep, getTaskById } from '../utils/TaskManager';

export function runHealer(creep: Creep, context: RoomContext): void {
    // creep will always heal itself if it is damaged, regardless of tasks
    if (creep.hits < creep.hitsMax) {
        creep.heal(creep);

        return;
    }

    // does this creep have a task? if not, find one
    if (!creep.memory.taskId) {
        const healTask = findTaskForCreep(creep, 'heal');

        if (!healTask) {
            debugLog(`No heal task found for creep ${creep.name}.`);

            return;
        }

        creep.memory.taskId = healTask.id;
        creep.memory.taskStarted = Game.time; // Record the time when the task was started
    }

    // validate the task still exists and is valid
    const healTask = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!healTask) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}.`);

        creep.memory.taskId = undefined; // Clear the invalid task ID

        return;
    }

    // if the creep is outside of the task room, go there
    if (creep.room.name !== healTask.roomId && !healTask.action?.startsWith('follow')) {
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, healTask.roomId));

        return;
    } else if (healTask.action?.startsWith('follow')) {
        const targetCreep = Game.getObjectById(healTask.targetId) as Creep;

        if (targetCreep) {
            const healResult = creep.rangedHeal(targetCreep);

            if (healResult === ERR_NOT_IN_RANGE) {
                if (creep.fatigue === 0) creep.travelTo(targetCreep);
            }
        }
    }

    // validate the target is still valid
    const target = Game.getObjectById(healTask.targetId) as Creep | Structure;

    if (!target) {
        debugLog(`Creep ${creep.name} has no valid target to heal.`);

        return;
    }

    if (healTask.action === 'standby') {
        // station with 8 range of the invader core and heal any of our creeps in range
        const nearbyDamagedCreeps = GLOBAL_CONTEXT[creep.room.name].injuredCreeps.filter(damagedCreep => damagedCreep.pos.getRangeTo(target) <= 12);

        if (nearbyDamagedCreeps.length > 0) {
            const closestDamagedCreep = creep.pos.findClosestByRange(nearbyDamagedCreeps);

            if (closestDamagedCreep) {
                const healResult = creep.rangedHeal(closestDamagedCreep);

                if (healResult === ERR_NOT_IN_RANGE) {
                    if (creep.fatigue === 0) creep.travelTo(target);

                    return;
                }

                return;
            }
        }

        // if no creeps to heal, move to a position within 8 range of the invader core
        if (creep.pos.getRangeTo(target) > 12) {
            if (creep.fatigue === 0) creep.travelTo(target);
        }

        return;
    }

    // if the target is a creep, heal it
    if (target instanceof Creep) {
        const healResult = creep.rangedHeal(target);

        if (healResult === ERR_NOT_IN_RANGE) {
            if (creep.fatigue === 0) creep.travelTo(target);
        }
    }
}
