import { getTaskById, findTaskForCreep, createTask } from "utils/TaskManager";
import { GetSlots } from '../utils/Slots';
import { RoomContext } from "utils/Context";

export function scanRoomForHostiles(creep: Creep, room: Room): void {
    const hostiles = room.find(FIND_HOSTILE_CREEPS).filter(i => i.body.some(part => part.type === ATTACK || part.type === RANGED_ATTACK || part.type === HEAL));
    if (hostiles.length > 0) {
        debugLog(`Room ${room.name} has ${hostiles.length} hostiles.`);

        creep.say(`🚓`);

        for (const hostile of hostiles) {
            createTask(creep.room, 'attack', hostile.id, 1, room.name);
        }
    }
}

export function goToRoom(creep: Creep, roomName: string): void {
    const exitDir = Game.map.findExit(creep.room.name, roomName) as any;

    if (exitDir !== ERR_NO_PATH) {
        const exit = creep.pos.findClosestByRange(exitDir);
        if (exit) {
            creep.moveTo(exit);
            return;
        }
    }

    debugLog(`Creep ${creep.name} cannot find exit to room ${roomName}`);
    creep.say(`❌ ${roomName}`);
}

export function runHarvester(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        // Assign a new task to the harvester if it doesn't have one
        const task = findTaskForCreep(creep, 'harvest');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.name;
        } else {
            debugLog(`No available harvest tasks for creep ${creep.name}`);
            return;
        }
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    // check if harvest task is remote and if so, move to the room of the source
    if (task.roomId !== creep.room.name) {
        goToRoom(creep, task.roomId);
        return;
    }

    // Get the source object using the targetId from the task
    const source = Game.getObjectById(task.targetId) as Source | null;
    if (!source) {
        debugLog(`Source with ID ${task.targetId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    // if the creep is outside of its home room, run an occasional scan for hostiles in the room
    if (creep.room.name !== creep.memory.room && (creep.memory.lastAction || 0) < Game.time - 20) {
        creep.say(`🕵🏻‍♂️`);

        scanRoomForHostiles(creep, creep.room);

        creep.memory.lastAction = Game.time; // Update the last action time
    }

    const homeRoom = Game.rooms[creep.memory.room];

    // if creep is full check for nearby container or link, otherwise drop
    if (creep.store.getFreeCapacity() === 0) {
        const nearbyStorage = context.structures.find(structure => (structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_LINK) && structure.pos.isNearTo(creep.pos));
        if (nearbyStorage) {
            if (creep.transfer(nearbyStorage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(nearbyStorage);
            }

            // if not in home room, create a hauler task to pickup the energy from the container or link
            if (creep.room.name !== creep.memory.room) {
                createTask(homeRoom, 'haul', nearbyStorage.id, 1, creep.room.name, undefined, undefined, RESOURCE_ENERGY);

                creep.say(`📦`);
            }

            return;
        } else {
            // Drop energy on the ground if no nearby storage is found
            creep.drop(RESOURCE_ENERGY);

            // if not in home room, create a hauler task to pickup the dropped energy
            if (creep.room.name !== creep.memory.room) {
                const droppedResource = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, { filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 50 })[0];

                if (droppedResource) {
                    createTask(homeRoom, 'haul', droppedResource.id, 1, creep.room.name, undefined, undefined, RESOURCE_ENERGY);

                    creep.say(`📦`);
                }
            }

            return;
        }
    }

    // If the creep is not in range to harvest, move towards the source
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
    }
}