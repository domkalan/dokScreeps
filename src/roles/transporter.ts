import { RoomContext } from "../utils/Context";

export function runTransporter(creep: Creep, context: RoomContext): void {
    // check if the creep has a task assigned
    if (!creep.memory.taskId) {
        // check if there are any unassigned scout tasks in the hive memory
        for (const taskId in Memory.hive.tasks) {
            const task = Memory.hive.tasks[taskId];
            if (task.type === 'transport' && !task.assigned && !task.completed) {
                // assign the task to this scout
                // task.assigned = creep.name;
                creep.memory.taskId = taskId;

                break;
            }
        }
    }

    if (creep.memory.taskId) {
        const task = Memory.hive.tasks[creep.memory.taskId];

        // check if the task is still valid
        if (!task || task.completed) {
            // the task is no longer valid, so clear the task from memory
            creep.memory.taskId = undefined;

            return;
        }

        if (creep.store.getFreeCapacity() > 0) {
            // move to the target room
            if (task.roomId !== creep.room.name) {
                creep.travelTo(new RoomPosition(25, 25, task.roomId));

                return;
            }

            const storageObject = Game.getObjectById(task.targetId) as StructureStorage | StructureContainer | null;

            if (storageObject) {
                // move to the storage object
                if (!creep.pos.isNearTo(storageObject)) {
                    creep.travelTo(storageObject);

                    return;
                }

                // withdraw resources from the storage object
                const withdrawResult = creep.withdraw(storageObject, task.resourceType || RESOURCE_ENERGY);

                if (withdrawResult === ERR_NOT_ENOUGH_RESOURCES) {
                    // mark the task as completed
                    task.completed = true;
                    creep.memory.taskId = undefined;
                }
            }
        }

        // move to the target room
        if (task.kv && task.kv.destRoom !== creep.room.name) {
            creep.travelTo(new RoomPosition(25, 25, task.kv.destRoom));

            return;
        }

        // move to the target storage object
        let destStorageObject: StructureStorage | StructureContainer | undefined;

        if (task.kv && task.kv.destStorageId) {
            destStorageObject = Game.getObjectById(task.kv.destStorageId) as StructureStorage | StructureContainer | undefined;
        } else {
            // find the nearest storage object in the destination room
            const storageObjects = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.structureType === STRUCTURE_STORAGE || structure.structureType === STRUCTURE_CONTAINER,
            }) as (StructureStorage | StructureContainer)[];

            if (storageObjects.length > 0) {
                destStorageObject = storageObjects[0];
                task.kv.destStorageId = destStorageObject.id;
            }
        }

        if (destStorageObject) {
            if (!creep.pos.isNearTo(destStorageObject)) {
                creep.travelTo(destStorageObject);

                return;
            }

            const carryAmount = creep.store.getUsedCapacity(task.resourceType || RESOURCE_ENERGY);

            // transfer resources to the destination storage object
            const transferResult = creep.transfer(destStorageObject, task.resourceType || RESOURCE_ENERGY);

            if (transferResult === OK) {
                if (task.kv && task.kv.transferAmount && task.kv.transferTotal) {
                    task.kv.transferTotal += carryAmount;

                    if (task.kv.transferTotal >= task.kv.transferAmount) {
                        // mark the task as completed
                        task.completed = true;
                        creep.memory.taskId = undefined;
                    }
                } else {
                    // mark the task as completed
                    task.completed = true;
                    creep.memory.taskId = undefined;
                }

            }
        } else {
            const roomCenter = new RoomPosition(25, 25, task.kv?.destRoom || task.roomId);

            if (!creep.pos.isNearTo(roomCenter)) {
                creep.travelTo(roomCenter);

                return;
            }

            creep.drop(task.resourceType || RESOURCE_ENERGY);
        }
    }
}