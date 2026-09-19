import { getTaskById, findTaskForCreep, releaseTask } from "utils/TaskManager";
import { RoomContext, GLOBAL_CONTEXT } from "utils/Context";

export function runMineralHarvester(creep: Creep, context: RoomContext, task: RoomTask): void {
    const mineral = Game.getObjectById(task.targetId) as Mineral | null;
    const mineralRoom = mineral?.pos.roomName || task.roomId;
    const onRoomBorder = creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49;

    // A task created by an older deployment may still contain the parent room.
    // Once the mineral is visible, its position is the authoritative room.
    if (mineral && task.roomId !== mineralRoom) {
        task.roomId = mineralRoom;
    }

    // A mineral can deplete before the creep is full. Return any partial load
    // instead of leaving it stranded at the extractor.
    if (creep.store.getFreeCapacity() === 0 || (mineral?.mineralAmount === 0 && creep.store.getUsedCapacity() > 0)) {
        const storage = context.storages[0];

        if (!storage) {
            creep.say('NO_STORAGE!');
            return;
        }

        if (creep.room.name === storage.pos.roomName && onRoomBorder) {
            delete creep.memory._trav;
            if (creep.fatigue === 0) {
                creep.move(creep.pos.getDirectionTo(new RoomPosition(25, 25, creep.room.name)));
            }
            return;
        }

        if (!creep.pos.isNearTo(storage)) {
            if (creep.fatigue === 0) creep.travelTo(storage);
            return;
        }

        // transfer all resources to the storage
        for (const resourceType in creep.store) {
            const transferResult = creep.transfer(storage, resourceType as ResourceConstant);
            if (transferResult === ERR_FULL) {
                creep.drop(resourceType as ResourceConstant); // Drop the resource if the storage is full
            }
        }

        return;
    }

    // Mineral tasks may target a remote room. Keep this travel decision inside
    // the mineral handler so a full creep can cross back to home storage.
    if (creep.room.name !== mineralRoom) {
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, mineralRoom));
        return;
    }

    // Room exits belong to both sides of an inter-room route. Clear Traveler's
    // cached route and step inward before selecting the in-room mineral path;
    // otherwise a cached exit step can send the creep straight back out.
    if (onRoomBorder) {
        delete creep.memory._trav;
        if (creep.fatigue === 0) {
            creep.move(creep.pos.getDirectionTo(new RoomPosition(25, 25, creep.room.name)));
        }
        return;
    }

    if (!mineral) {
        creep.say('NO_MINERAL!');
        releaseTask(creep);
        return;
    }

    if (mineral.mineralAmount === 0) {
        releaseTask(creep);
        return;
    }

    if (!creep.pos.isNearTo(mineral)) {
        if (creep.fatigue === 0) creep.travelTo(mineral);
        return;
    }

    // if the extractor is on cooldown, do not attempt to harvest the mineral
    const currentContext = GLOBAL_CONTEXT[creep.room.name];
    const extractor = currentContext?.structuresByType[STRUCTURE_EXTRACTOR]?.[0] as StructureExtractor | undefined;
    if (extractor?.cooldown && extractor.cooldown > 0) {
        return;
    }

    // harvest the mineral
    creep.harvest(mineral);
}

export function runHarvester(creep: Creep, context: RoomContext): void {
    if (!creep.memory.taskId) {
        // Assign a new task to the harvester if it doesn't have one
        const task = findTaskForCreep(creep, 'harvest');
        if (task) {
            creep.memory.taskId = task.id;
            creep.memory.taskStarted = Game.time; // Record the time when the task was started

            task.assigned = creep.name;
        }

        if (!task) {
            debugLog(`No available harvest tasks for creep ${creep.name}`);

            return;
        }
    }

    const task = getTaskById(creep.memory.room, creep.memory.taskId!);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        releaseTask(creep); // Clear the invalid task ID

        return;
    }

    // if the task is a mineral harvest task, handle it differently
    if (task.action === 'mineralHarvest') {
        runMineralHarvester(creep, context, task);

        return;
    }

    // if the creep is outside of the task room, go there
    if (creep.room.name !== task.roomId) {
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, task.roomId));

        return;
    }

    // Get the source object using the targetId from the task
    const source = Game.getObjectById(task.targetId) as Source | null;
    if (!source) {
        debugLog(`Source with ID ${task.targetId} not found for creep ${creep.name}`);
        releaseTask(creep); // Clear the invalid task ID
        return;
    }

    // if the room is just starting dump energy into the spawn
    if ((creep.store.getFreeCapacity() === 0 || creep.memory.focusedOn === 'bootstrapping') && GLOBAL_CONTEXT[creep.memory.room].room.controller && GLOBAL_CONTEXT[creep.memory.room].room.controller!.level < 2) {
        creep.memory.focusedOn = 'bootstrapping';

        const spawn = context.spawns[0];
        if (!spawn) {
            creep.say('NO_SPAWN!');
            return;
        }

        // if the spawn is full, lets go upgrade the controller instead
        if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (!creep.pos.isNearTo(spawn)) {
                if (creep.fatigue === 0) creep.travelTo(spawn);
                return;
            }

            creep.transfer(spawn, RESOURCE_ENERGY);
        } else {
            const controller = context.room.controller;
            if (!controller) {
                creep.say('NO_CONTROLLER!');
                return;
            }

            if (!creep.pos.isNearTo(controller)) {
                if (creep.fatigue === 0) creep.travelTo(controller);
                return;
            }

            creep.upgradeController(controller);
        }

        if (creep.store.getUsedCapacity() === 0) {
            delete creep.memory.focusedOn;
        }

        return;
    }

    // if creep is full check for nearby container or link, otherwise drop
    if (creep.store.getFreeCapacity() === 0) {
        const currentContext = GLOBAL_CONTEXT[creep.room.name];
        let nearbyLink: StructureLink | null = null;
        let closestRange = 5;

        for (const link of currentContext?.links || []) {
            if (link.store.getFreeCapacity(RESOURCE_ENERGY) === 0) continue;
            const range = creep.pos.getRangeTo(link);
            if (range < closestRange) {
                nearbyLink = link;
                closestRange = range;
            }
        }

        if (nearbyLink) {
            if (!creep.pos.isNearTo(nearbyLink)) {
                if (creep.fatigue === 0) creep.travelTo(nearbyLink);
                return;
            }

            if (creep.transfer(nearbyLink, RESOURCE_ENERGY) === ERR_FULL) {
                creep.drop(RESOURCE_ENERGY); // Drop energy if the link is full
            }

            return;
        }

        let nearbyContainer: StructureContainer | null = null;
        closestRange = 5;
        for (const container of currentContext?.containers || []) {
            if (container.store.getFreeCapacity(RESOURCE_ENERGY) === 0) continue;
            const range = creep.pos.getRangeTo(container);
            if (range < closestRange) {
                nearbyContainer = container;
                closestRange = range;
            }
        }

        if (nearbyContainer) {
            if (!creep.pos.isNearTo(nearbyContainer)) {
                if (creep.fatigue === 0) creep.travelTo(nearbyContainer);
                return;
            }

            if (creep.transfer(nearbyContainer, RESOURCE_ENERGY) === ERR_FULL) {
                creep.drop(RESOURCE_ENERGY); // Drop energy if the storage is full
            }

            return;
        }

        // if no nearby container or link, drop the energy on the ground
        creep.drop(RESOURCE_ENERGY);
        return;
    }

    if (!creep.pos.isNearTo(source)) {
        if (creep.fatigue === 0) creep.travelTo(source);
    } else {
        creep.harvest(source);
    }
}
