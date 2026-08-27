import { LOCAL_PLAYER } from 'config';
import { RoomContext } from '../utils/Context';

export function doHiveConstruction(creep: Creep, context: RoomContext): void {
    if (Memory.hive.interShard.colonizePlan!.targetRoom !== creep.room.name) {
        creep.travelTo(new RoomPosition(25, 25, Memory.hive.interShard.colonizePlan!.targetRoom));

        return;
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 || creep.memory.focusedOn === 'energy') {
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            delete creep.memory.focusedOn;

            return;
        }

        creep.memory.focusedOn = 'energy';

        // find the closest energy source
        const energySource = creep.pos.findClosestByPath(FIND_SOURCES);

        if (energySource) {
            const harvestResult = creep.harvest(energySource);

            if (harvestResult === ERR_NOT_IN_RANGE) {
                creep.travelTo(energySource);
            }
        }
    }

    // find all construction sites in the room
    const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);

    if (constructionSites.length === 0) {
        creep.say('NO_SITES');

        Memory.hive.interShard.colonizePlan!.phase = 'finished';
        Memory.hive.interShard.colonizePlan!.lastUpdated = Game.time;
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

export function moveToPortal(creep: Creep, context: RoomContext): void {
    // check if the creep knows what portal it is going to jump through
    if (!creep.memory.kv!.portalId || creep.memory.kv!.portalRoom) {
        const portals = Memory.hive.interShard.colonizePlan!.portals;

        for (const [shardId, roomId, portalId] of portals) {
            if (shardId !== Game.shard.name) {
                continue;
            }

            creep.memory.kv!.portalId = portalId;
            creep.memory.kv!.portalRoom = roomId;

            break;
        }
    }

    // move the creep into the right room
    if (creep.room.name !== creep.memory.kv!.portalRoom) {
        creep.travelTo(new RoomPosition(25, 25, creep.memory.kv!.portalRoom));

        return;
    }

    // find the portal in the room
    const portal = Game.getObjectById(creep.memory.kv!.portalId) as StructurePortal | null;

    if (!portal) {
        creep.say('NO_PORTAL');

        return;
    }

    // move the creep to the portal
    if (creep.pos.getRangeTo(portal) > 0) {
        creep.travelTo(portal);

        return;
    }

    creep.say('???');
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