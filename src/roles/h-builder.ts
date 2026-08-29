import { LOCAL_PLAYER } from 'config';
import { RoomContext } from '../utils/Context';
import { moveToPortal } from './h-colonizer';
import { GLOBAL_CONTEXT } from '../utils/Context';

export function doHiveConstruction(creep: Creep, context: RoomContext): void {
    if (Memory.hive.interShard.colonizePlan!.targetRoom !== creep.room.name) {
        creep.travelTo(new RoomPosition(25, 25, Memory.hive.interShard.colonizePlan!.targetRoom));

        return;
    }

    if (creep.store.energy === 0 || creep.memory.focusedOn === 'energy') {
        creep.memory.focusedOn = 'energy';

        // find the closest energy source
        const energySource = creep.pos.findClosestByPath(FIND_SOURCES);

        if (energySource) {
            const harvestResult = creep.harvest(energySource);

            if (harvestResult === ERR_NOT_IN_RANGE) {
                creep.travelTo(energySource);
            }

            if (creep.store.getFreeCapacity() === 0) {
                creep.memory.focusedOn = 'construction';
            }
        }

        return;
    }

    // find the controller in the room, if under 2000 ticks to downgrade, prioritize upgrading the controller
    const controller = creep.room.controller;

    if (controller && controller.ticksToDowngrade < 2000) {
        const upgradeResult = creep.upgradeController(controller);

        if (upgradeResult === ERR_NOT_IN_RANGE) {
            creep.travelTo(controller);
        }
    }

    // find all construction sites in the room
    const constructionSites = GLOBAL_CONTEXT[creep.room.name].constructionSites;

    if (constructionSites.length === 0) {
        creep.say('NO_SITES');

        delete creep.memory.focusedOn;

        Memory.hive.interShard.colonizePlan!.phase = 'finished';
        Memory.hive.interShard.lastUpdated = Game.time;
        Memory.hive.lastScan = 0;

        creep.suicide();

        return;
    }

    // find hostile construction sites, stand on them to remove
    for (const site of constructionSites) {
        if (site.owner && site.owner.username !== LOCAL_PLAYER) {
            creep.travelTo(site);

            return;
        }
    }

    // begin building our construction sites
    for (const site of constructionSites) {
        if (site.owner && site.owner.username === LOCAL_PLAYER) {
            const constructResult = creep.build(site);

            if (constructResult === ERR_NOT_IN_RANGE) {
                creep.travelTo(site);
            }

            return;
        }
    }
}

export function runHiveBuilder(creep: Creep, context: RoomContext): void {
    // make sure creep has a kv object in memory
    if (typeof creep.memory.kv === 'undefined') {
        creep.memory.kv = {};
    }

    // check if there is a valid colonize plan
    if (!Memory.hive.interShard.colonizePlan) {
        creep.say('NO_PLAN');

        return;
    }

    if (Memory.hive.interShard.colonizePlan.targetShard === Game.shard.name) {
        doHiveConstruction(creep, context);

        return;
    }

    // logic to jump through the portal to the target shard
    moveToPortal(creep, context);
}