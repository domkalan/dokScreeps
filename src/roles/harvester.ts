import { getTaskById, findTaskForCreep, createTask } from "utils/TaskManager";
import { GetSlots } from '../utils/Slots';
import { RoomContext } from "utils/Context";

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

    // if creep is full, attempt to build a container near the source
    if (creep.store.getFreeCapacity() === 0 || creep.memory.focusedOn === 'building') {
        const container = source.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER
        })[0] as StructureContainer | undefined;

        if (!container) {
            // Attempt to build a container if one doesn't exist
            debugLog('No container found, attempting to build one.');
            const constructionSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 3, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            })[0] as ConstructionSite | undefined;

            if (!constructionSite) {
                const bestSlot = GetSlots(creep.room, source, 3, 0, ['wall', 'swamp']).find(slot => slot.code === 1);

                if (!bestSlot) {
                    debugLog(`No suitable slot found for container near source ${source.id}`);
                    return;
                }

                creep.room.createConstructionSite(bestSlot.pos.x, bestSlot.pos.y, STRUCTURE_CONTAINER);
                debugLog(`Creep ${creep.name} is building a container at source ${source.id}`);

                return;
            }

            const buildResult = creep.build(constructionSite);

            // If a construction site exists, move to it and build
            if (buildResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSite);
            } else if (buildResult === OK) {
                creep.memory.focusedOn = 'building'; // Mark that the creep is focused on building
            } else if (buildResult === ERR_NOT_ENOUGH_RESOURCES) {
                delete creep.memory.focusedOn; // Clear the focusedOn memory if not enough resources
            }
            return;
        }

        // ensure the container remains at a healthy hit level
        if (container.hits < container.hitsMax * 0.5) {
            const repairResult = creep.repair(container);

            creep.memory.focusedOn = 'building'; // Mark that the creep is focused on repairing

            if (repairResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(container);

                return;
            } else if (repairResult === ERR_NOT_ENOUGH_RESOURCES) {
                delete creep.memory.focusedOn; // Clear the focusedOn memory if not enough resources
            }
        }

        // get the room room reference for the creep's home room
        const homeRoom = Game.rooms[creep.memory.room];

        // Attempt to transfer energy to the container
        const transferResult = creep.transfer(container, RESOURCE_ENERGY);

        // If a container exists, transfer energy to it
        if (transferResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(container);

            return;
        } else if (transferResult === ERR_FULL) {
            creep.drop(RESOURCE_ENERGY); // Drop energy if the container is full

            // add a hauler task to the home room if the creep is not in the home room
            // or if the creep is in a room with larger storage
            if (homeRoom && creep.memory.room !== creep.room.name || creep.room.storage) {
                // also add a task for the filled container
                createTask(homeRoom, 'haul', container.id, 1, creep.room.name);

                // do a one time scan to see if we have dropped resources for the id
                const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
                    filter: (r) => r.resourceType === RESOURCE_ENERGY && r.pos.isNearTo(container)
                });

                if (droppedResources.length > 0 && droppedResources[0].amount > 50) {
                    // Add a hauler task to the home room
                    createTask(homeRoom, 'haul', droppedResources[0].id, 0, creep.room.name);

                    creep.say(`🛻 ⚡ 🗑️`);
                }
            }

            return;
        }

        // get the amount of energy stored in the container
        const containerStored = container.store.getUsedCapacity(RESOURCE_ENERGY);

        // If the container is 25% full, we can consider it full enough for now to add a hauler task
        if (containerStored >= container.store.getCapacity(RESOURCE_ENERGY) * 0.25) {
            debugLog(`Container at source ${source.id} is at or above 25% full.`);

            if (homeRoom && creep.memory.room !== creep.room.name) {
                // Add a hauler task to the home room

                createTask(homeRoom, 'haul', container.id, 1, creep.room.name);

                creep.say(`🛻 ⚡`);
            }
        }
    }

    // If the creep is not in range to harvest, move towards the source
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
    }
}