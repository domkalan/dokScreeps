import { getTaskById, findTaskForCreep } from "utils/TaskManager";

export function runHarvester(creep: Creep): void {
    if (!creep.memory.taskId) {
        // Assign a new task to the harvester if it doesn't have one
        const task = findTaskForCreep(creep, 'harvest');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.id;
        } else {
            console.log(`No available harvest tasks for creep ${creep.name}`);
            return;
        }
    }

    const task = getTaskById(creep.memory.taskId);
    if (!task) {
        console.log(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    task.assigned = creep.id; // Ensure the task is marked as assigned to this creep

    const source = Game.getObjectById(task.targetId) as Source;
    if (!source) {
        console.log(`Source with ID ${task.targetId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }

    // if the creep is full, attempt to transfer to nearby storage (link or container) if available
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        const nearbyStorage = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (
                    structure.structureType === STRUCTURE_LINK ||
                    structure.structureType === STRUCTURE_CONTAINER
                ) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        console.log(`Creep ${creep.name} is full. Found ${nearbyStorage.length} nearby storage structures.`);

        if (nearbyStorage.length > 0) {
            const targetStorage = nearbyStorage[0];
            const transferResult = creep.transfer(targetStorage, RESOURCE_ENERGY);

            if (transferResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetStorage, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        } else {
            if (creep.room.controller && creep.room.controller.level < 2) {
                // if no nearby storage is available and room is in bootstrap mode, take the energy to the spawn or extension
                const spawnOrExtension = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    filter: (structure) => {
                        return (
                            (structure.structureType === STRUCTURE_SPAWN ||
                                structure.structureType === STRUCTURE_EXTENSION) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                        );
                    }
                });

                console.log(`Creep ${creep.name} is full. Found ${spawnOrExtension ? 1 : 0} nearby spawn or extension structures.`);

                if (spawnOrExtension) {
                    const transferResult = creep.transfer(spawnOrExtension, RESOURCE_ENERGY);

                    if (transferResult === ERR_NOT_IN_RANGE) {
                        creep.moveTo(spawnOrExtension, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
                    }
                } else {
                    creep.drop(RESOURCE_ENERGY);
                }
            } else {
                // if no nearby storage is available and room is not in bootstrap mode, drop the energy on the ground
                creep.drop(RESOURCE_ENERGY);
            }
        }
    } else {
        const harvestResult = creep.harvest(source);

        if (harvestResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });

            return;
        }
    }
}