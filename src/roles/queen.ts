import { RoomContext } from 'utils/Context';
import { goForEnergy } from './builder';
import { purgeTaskById, assignTask } from 'utils/TaskManager';

// if no other work exists, haulers will go to the room controller and upgrade it
export function upgradeRoomController(creep: Creep, context: RoomContext): void {
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep, context);
        return;
    }

    // upgrade the controller if we have energy and are in range
    if (!creep.pos.inRangeTo(context.room.controller!, 3)) {
        creep.travelTo(context.room.controller!);
    } else {
        creep.upgradeController(context.room.controller!);
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
        let closestRange = Infinity;
        for (const receiver of context.spawnEnergyReceivers) {
            if (receiver.store.getFreeCapacity(RESOURCE_ENERGY) === 0) continue;
            const range = creep.pos.getRangeTo(receiver);
            if (range < closestRange) {
                target = receiver;
                closestRange = range;
            }
        }

        // if there are no extensions that need energy, the queen will go to the controller and upgrade it
        if (!target && creep.body.some(part => part.type === WORK)) {

            // if there are no extensions that need energy, the queen will go to the controller and upgrade it
            upgradeRoomController(creep, context);

            return;
        } else if (!target) {
            // if there are no extensions that need energy and the queen has no WORK parts, it will idle
            if (Game.time % 25 === 0) {
                creep.say('🛑 Idle');
            }

            return;
        }

        creep.memory.focusedOn = target!.id; // Store the target in memory
    }

    if (target && (target.structureType === STRUCTURE_EXTENSION || target.structureType === STRUCTURE_SPAWN)) {
        if (!creep.pos.isNearTo(target)) {
            creep.travelTo(target);
            return;
        }

        const transferCode = creep.transfer(target, RESOURCE_ENERGY);
        if (transferCode === OK) {
            // if the transfer was successful, manually purge any tasks associated with this target
            const taskId = `fill-${target.id}`;
            purgeTaskById(taskId, context.room.name);
        }
    } else {
        delete creep.memory.focusedOn; // Clear the invalid target from memory
    }
}
