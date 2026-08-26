import { RoomContext } from "./utils/Context";
import { createTask } from "./utils/TaskManager";

export function runTower(tower: StructureTower, context: RoomContext, room: Room, towerCount: number): void {
    // if the tower is empty, create a fill task for it
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        createTask(room, 'fill', tower.id, 2.5, tower.room.name);

        return;
    } else if (tower.store.getUsedCapacity(RESOURCE_ENERGY) <= tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
        // if the tower is not full, create a fill task for it
        createTask(room, 'fill', tower.id, 5, tower.room.name);
    } else {
        // create an ultra low priority fill task for the tower to ensure it is filled if no other tasks exist
        createTask(room, 'fill', tower.id, 100, tower.room.name);
    }

    // first check for hostiles in the room, and attack the closest one if any are found
    const hostiles = context.hostiles;

    if (hostiles.length > 0) {
        let closestHostile = hostiles[0];
        let closestRange = tower.pos.getRangeTo(closestHostile);
        for (let i = 1; i < hostiles.length; i++) {
            const range = tower.pos.getRangeTo(hostiles[i]);
            if (range < closestRange) {
                closestHostile = hostiles[i];
                closestRange = range;
            }
        }

        tower.attack(closestHostile);

        return;
    }

    // if tower is at least 50% full, heal any injured creeps in the room
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) / tower.store.getCapacity(RESOURCE_ENERGY) >= 0.5) {
        const injuredCreeps = context.injuredCreeps;

        if (injuredCreeps.length > 0) {
            let closestInjuredCreep = injuredCreeps[0];
            let closestRange = tower.pos.getRangeTo(closestInjuredCreep);
            for (let i = 1; i < injuredCreeps.length; i++) {
                const range = tower.pos.getRangeTo(injuredCreeps[i]);
                if (range < closestRange) {
                    closestInjuredCreep = injuredCreeps[i];
                    closestRange = range;
                }
            }

            tower.heal(closestInjuredCreep);

            return;
        }
    }

    // total room standby energy is the sum of all energy in storage and containers
    const totalRoomStandbyEnergy = context.storedEnergy;

    // skip repairing structures if the room has less than 1000 energy in storage and containers
    if (totalRoomStandbyEnergy < 50000) {
        debugLog(`Room ${context.room.name} has low standby energy: ${totalRoomStandbyEnergy}. Tower will not repair structures.`);

        return;
    }

    // if there are no hostiles and tower has at least 75% energy, repair any degraded structures in the room below 50% health
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) / tower.store.getCapacity(RESOURCE_ENERGY) >= 0.75) {
        if (context.towerRepairTargets.length > towerCount) {
            tower.repair(context.towerRepairTargets[towerCount]);

            return;
        }
    }
}
