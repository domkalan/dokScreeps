import { goForEnergy } from './builder';

/**
 * This module defines the behavior of the queen role in the game.
 * The queen is responsible for filling extensions and spawns with energy once the room reaches RCL 2.
 * The queen does not run on the task system, but instead has its own logic for managing energy distribution.
 * 
 * The queen will prioritize filling extensions first, then spawns, and finally towers if they exist.
 */
export function runQueen(creep: Creep): void {
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep);
    } else {
        // the queen will also be responsible for ensuring the room controller does not downgrade
        if (creep.room.controller && creep.room.controller.ticksToDowngrade < 1000) {
            console.log(`Room ${creep.room.name} controller is about to downgrade. Prioritizing upgrading.`);
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
            return; // exit early to prioritize upgrading
        }

        // If the queen has energy, prioritize filling extensions first, then spawns, and finally towers if they exist
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (
                    (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_TOWER) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                );
            }
        });

        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
                }
            }
        } else {
            console.log(`Creep ${creep.name} has energy but no valid targets to transfer to.`);
        }
    }
}