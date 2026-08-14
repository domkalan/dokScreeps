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
        creep.travelTo(new RoomPosition(25, 25, context.room.name));

        return;
    }

    // if there are hostiles, attack the closest one
    if (hostiles.length > 0) {
        // prioritize attacking the closest hostile creep
        const target = creep.pos.findClosestByRange(hostiles);
        if (target) {
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.travelTo(target);
            }
        }
    } else {
        // if there are no hostiles, move to a defensive position near the room controller or spawn
        const defensivePosition = creep.room.controller || context.structures.find(structure => structure.structureType === STRUCTURE_SPAWN)?.pos;

        if (defensivePosition && creep.pos.getRangeTo(defensivePosition) > 5) {
            creep.travelTo(defensivePosition);
        }
    }
}