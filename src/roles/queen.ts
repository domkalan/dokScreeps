import { RoomContext } from 'utils/Context';
import { goForEnergy } from './builder';

// if no other work exists, haulers will go to the room controller and upgrade it
export function upgradeRoomController(creep: Creep, context: RoomContext): void {
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep, context);
        return;
    }

    if (creep.upgradeController(context.room.controller!) === ERR_NOT_IN_RANGE) {
        creep.travelTo(context.room.controller!);
    }
}

// the queen is a basic task, but responsible for ensuring extensions are maintained
export function runQueen(creep: Creep, context: RoomContext): void {
    // the queen needs energy to run, so if it has no energy, it will go get some
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep, context);
        return;
    }

    if (context.room.controller && context.room.controller.my && (
        (context.room.controller.level <= 2 && context.room.controller.ticksToDowngrade < 5000) ||
        (context.room.controller.level > 2 && context.room.controller.ticksToDowngrade < 10000)
    )) {
        upgradeRoomController(creep, context);
        return;
    }

    // the focused target
    let target: StructureExtension | StructureSpawn | null = null;

    if (creep.memory.focusedOn) {
        target = Game.getObjectById(creep.memory.focusedOn) as StructureExtension | StructureSpawn | null;
    }

    if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        // get all the extensions in the room that are not full
        const extensions = context.structures.filter(structure => {
            return (structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_SPAWN) &&
                (structure as StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }) as Array<StructureExtension | StructureSpawn>;

        // if there are no extensions that need energy, the queen will go to the controller and upgrade it
        if (extensions.length === 0 && creep.body.some(part => part.type === WORK)) {
            upgradeRoomController(creep, context);

            return;
        } else if (extensions.length === 0) {
            // if there are no extensions that need energy and the queen has no WORK parts, it will idle
            creep.say('🛑 Idle');
            return;
        }

        // set the target to the closet extension that needs energy
        target = creep.pos.findClosestByRange(extensions);
        creep.memory.focusedOn = target!.id; // Store the target in memory
    }

    if (target && (target.structureType === STRUCTURE_EXTENSION || target.structureType === STRUCTURE_SPAWN)) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.travelTo(target);
        }
    } else {
        delete creep.memory.focusedOn; // Clear the invalid target from memory
    }
}