import { RoomContext } from "./utils/Context";
import { createTask } from "./utils/TaskManager";

export function runTower(tower: StructureTower, context: RoomContext, room: Room) {
    // if the tower is empty, create a fill task for it
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        createTask(room, 'fill', tower.id, 2.5, tower.room.name);

        return;
    } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) <= tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
        // if the tower is not full, create a fill task for it
        createTask(room, 'fill', tower.id, 5, tower.room.name);
    } else {
        // create an ultra low priority fill task for the tower to ensure it is filled if no other tasks exist
        //createTask(room, 'fill', tower.id, 100, tower.room.name);
    }

    // first check for hostiles in the room, and attack the closest one if any are found
    const hostiles = context.hostiles;

    if (hostiles.length > 0) {
        const closestHostile = hostiles.reduce((prev, curr) => {
            return prev.pos.getRangeTo(tower.pos) < curr.pos.getRangeTo(tower.pos) ? prev : curr;
        });

        tower.attack(closestHostile);

        return;
    }

    // if tower is at least 50% full, heal any injured creeps in the room
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) / tower.store.getCapacity(RESOURCE_ENERGY) >= 0.5) {
        const injuredCreeps = context.myCreeps.filter(creep => creep.hits < creep.hitsMax);

        if (injuredCreeps.length > 0) {
            const closestInjuredCreep = injuredCreeps.reduce((prev, curr) => {
                return prev.pos.getRangeTo(tower.pos) < curr.pos.getRangeTo(tower.pos) ? prev : curr;
            });

            tower.heal(closestInjuredCreep);

            return;
        }
    }

    /*// total room standby energy is the sum of all energy in storage and containers
    const totalRoomStandbyEnergy = context.structures.reduce((acc, structure) => {
        if (structure instanceof StructureStorage || structure instanceof StructureContainer) {
            return acc + structure.store.getUsedCapacity(RESOURCE_ENERGY);
        }
        return acc;
    }, 0);

    // skip repairing structures if the room has less than 1000 energy in storage and containers
    if (totalRoomStandbyEnergy < 1000) {
        debugLog(`Room ${context.room.name} has low standby energy: ${totalRoomStandbyEnergy}. Tower will not repair structures.`);

        visual.text(`🧊`, tower.pos.x, tower.pos.y + 0.25, { color: 'red', font: 0.5 });

        return;
    }*/

    // if there are no hostiles and tower has at least 75% energy, repair any degraded structures in the room below 50% health
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) / tower.store.getCapacity(RESOURCE_ENERGY) >= 0.75) {
        const damagedRegularStructures = context.structures.filter(structure => structure.hits < structure.hitsMax * 0.5 && structure.structureType !== STRUCTURE_WALL && structure.structureType !== STRUCTURE_RAMPART && structure.structureType !== STRUCTURE_ROAD);
        const damagedDefenseStructures = context.structures.filter(structure => structure.hits < structure.hitsMax * 0.25 && (structure.structureType === STRUCTURE_RAMPART || structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_ROAD));

        const damagedStructures = [...damagedRegularStructures, ...damagedDefenseStructures].sort((a, b) => a.hits - b.hits); // sort by hits descending (most damaged first)

        if (damagedStructures.length > 0) {
            tower.repair(damagedStructures[0]);

            return;
        }
    }
}