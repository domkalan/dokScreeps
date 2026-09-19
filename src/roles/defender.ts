import { RoomContext } from "utils/Context";

/**
 * The defender is tasked with protecting the room from hostile creeps. 
 * It will prioritize attacking hostile creeps that are in the room, and will also assist in defending structures if necessary.
 * 
 * The defender does not use the task system, but instead has its own logic for managing combat.
 */
export function runDefender(creep: Creep, context: RoomContext): void {
    // find hostile creeps in the room
    const hostiles = context.hostiles;

    // make sure defenders only operate in their assigned room
    if (creep.room.name !== context.room.name) {
        // if the creep is not in the room, move to the center of the room
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, context.room.name));

        return;
    }

    // if there are hostiles, attack the closest one
    if (hostiles.length > 0) {
        let target: Creep | null = null;
        let closestRange = Infinity;
        for (const hostile of hostiles) {
            const range = creep.pos.getRangeTo(hostile);
            if (range < closestRange) {
                target = hostile;
                closestRange = range;
            }
        }
        if (target) {
            if (!creep.pos.isNearTo(target)) {
                if (creep.fatigue === 0) creep.travelTo(target);
            } else {
                creep.attack(target);
            }
        }
    } else {
        if (!creep.memory.kv) {
            creep.memory.kv = {};
        }

        if (!creep.memory.kv.defenderIdle || creep.memory.kv.defenderIdle < 100) {
            creep.memory.kv.defenderIdle = (creep.memory.kv.defenderIdle || 0) + 1;

            return;
        }

        // if there are no hostiles, move to a defensive position near the room controller or spawn
        const defensivePosition = creep.room.controller || context.spawns[0]?.pos;

        if (defensivePosition && creep.pos.getRangeTo(defensivePosition) > 5) {
            if (creep.fatigue === 0) creep.travelTo(defensivePosition);
        } else {
            creep.memory.kv.defenderIdle = 0;
        }
    }
}
