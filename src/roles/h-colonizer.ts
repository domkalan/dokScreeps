import { RoomContext } from '../utils/Context';

export function doHiveClaim(creep: Creep, context: RoomContext): void {
    if (Memory.hive.interShard.colonizePlan!.targetRoom !== creep.room.name) {
        creep.travelTo(new RoomPosition(25, 25, Memory.hive.interShard.colonizePlan!.targetRoom));

        return;
    }

    // find the controller in the room
    const controller = creep.room.controller;

    if (!controller) {
        creep.say('NO_CONTROLLER');

        return;
    }

    // move the creep to the controller
    if (!creep.pos.isNearTo(controller)) {
        creep.travelTo(controller);

        return;
    }

    const claimCode = creep.claimController(controller);

    if (claimCode === OK) {
        creep.say('CLAIMED');

        Memory.hive.interShard.colonizePlan!.phase = 'bootstrap';
        Memory.hive.interShard.colonizePlan!.lastUpdated = Game.time;
        Memory.hive.interShard.lastUpdated = Game.time;
        Memory.hive.lastScan = 0;

        Game.notify(`Hive colonization: Room ${creep.room.name} claimed by ${creep.name}.`);

        creep.suicide();
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

export function runHiveColonizer(creep: Creep, context: RoomContext): void {
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
        doHiveClaim(creep, context);

        return;
    }

    // logic to jump through the portal to the target shard
    moveToPortal(creep, context);
}