import { RoomContext, GLOBAL_CONTEXT } from "utils/Context";
import { HiveExpansionPlan } from "../../types/hive";

export function buildConstructionSite(creep: Creep): void {
    // check if we have any hostiles in the room and if we have an attack part
    if (GLOBAL_CONTEXT[creep.room.name].hostiles.length > 0 && (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0)) {
        let nearestHostile: Creep | null = null;
        let nearestHostileRange = Infinity;

        for (const hostile of GLOBAL_CONTEXT[creep.room.name].hostiles) {
            const range = creep.pos.getRangeTo(hostile);

            if (range < nearestHostileRange) {
                nearestHostileRange = range;
                nearestHostile = hostile;
            }
        }

        if (nearestHostile) {
            if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
                if (nearestHostileRange > 3) {
                    if (creep.fatigue === 0) creep.travelTo(nearestHostile);
                } else if (nearestHostileRange < 2) {
                    // move away from the hostile
                    const fleePos = creep.pos.getDirectionTo(nearestHostile) + 4; // opposite direction
                    const newPos = new RoomPosition(creep.pos.x + Math.cos(fleePos * (Math.PI / 4)), creep.pos.y + Math.sin(fleePos * (Math.PI / 4)), creep.pos.roomName);

                    creep.moveTo(newPos);
                }

                creep.rangedAttack(nearestHostile);
            } else {
                if (nearestHostileRange > 1) {
                    if (creep.fatigue === 0) creep.travelTo(nearestHostile);
                } else {
                    creep.attack(nearestHostile);
                }
            }

            return;
        }

        return;
    }

    // if the creep has no energy, go get some
    if (creep.store[RESOURCE_ENERGY] === 0 || creep.memory.focusedOn === 'energy') {
        creep.memory.focusedOn = 'energy';

        // go get energy from the closest energy source
        let closestEnergySource: string | null = null;
        let closestRange = Infinity;

        for (const energyReceiver of GLOBAL_CONTEXT[creep.room.name].sources) {
            const range = creep.pos.getRangeTo(energyReceiver);
            if (range < closestRange) {
                closestRange = range;
                closestEnergySource = energyReceiver.id;
            }
        }

        if (!closestEnergySource) {
            creep.say('NO_ENERGY!');
            return;
        }

        const energySource = Game.getObjectById(closestEnergySource) as Source | null;

        if (!energySource) {
            creep.say('NO_ENERGY_OBJ!');
            return;
        }

        if (creep.pos.getRangeTo(energySource) > 1) {
            if (creep.fatigue === 0) creep.travelTo(energySource);
            return;
        }

        creep.harvest(energySource);

        if (creep.store.getFreeCapacity() === 0) {
            delete creep.memory.focusedOn;
        }

        return;
    }

    // check if the controller is at risk of downgrading, if so, go upgrade it
    const controller = GLOBAL_CONTEXT[creep.room.name].room.controller;

    if (controller && controller.my && controller.ticksToDowngrade < 5000) {
        if (creep.pos.getRangeTo(controller) > 3) {
            if (creep.fatigue === 0) creep.travelTo(controller);
            return;
        }

        creep.upgradeController(controller);
        return;
    }

    // if the creep has energy, go build
    const constructionSites = GLOBAL_CONTEXT[creep.room.name].constructionSites;

    if (constructionSites.length === 0) {
        creep.say('NO_SITES!');
        return;
    }

    // find the closest construction site
    let closestConstructionSite: ConstructionSite | null = null;
    let spawnConstructionSite: ConstructionSite | null = null;
    let closestRange = Infinity;

    for (const site of constructionSites) {
        const range = creep.pos.getRangeTo(site);

        if (site.structureType === STRUCTURE_SPAWN) {
            spawnConstructionSite = site;
        }

        if (range < closestRange) {
            closestRange = range;
            closestConstructionSite = site;
        }
    }

    if (spawnConstructionSite) {
        closestConstructionSite = spawnConstructionSite;
    }

    // validate that we have a construction site to build
    if (!closestConstructionSite) {
        creep.say('NO_SITES!');
        return;
    }

    if (creep.pos.getRangeTo(closestConstructionSite) > 1) {
        if (creep.fatigue === 0) creep.travelTo(closestConstructionSite);
        return;
    }

    creep.build(closestConstructionSite);
}

export function claimController(creep: Creep, context: RoomContext, plan: HiveExpansionPlan): void {
    // make sure that we are in the target room before we attempt to claim the controller
    if (plan.target.room !== creep.room.name) {
        // if we are not in the target room, move to it
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, plan.target.room));

        return;
    }

    // get the controller in the room
    const controller = GLOBAL_CONTEXT[creep.room.name].room.controller;

    if (!controller) {
        creep.say('NO_CONTROLLER!');
        return;
    }

    // attempt to claim the controller if we are in range
    if (creep.pos.getRangeTo(controller) > 1) {
        if (creep.fatigue === 0) creep.travelTo(controller);
        return;
    }

    // if we are in range, claim the controller
    const claimResult = creep.claimController(controller);

    if (claimResult === OK) {
        creep.say('CLAIMED!');

        // update the hive memory to reflect that we have claimed the room
        Memory.hive.interShard.expansionPlan!.phase = 'build';
        Memory.hive.interShard.lastUpdated = Date.now();

        // Create a stub object in room memory that this is our room
        Memory.rooms[creep.room.name] = {
            lastScan: 0,
            energySources: [],
            type: 'home',
            tasks: {},
            spawnQueue: [],
            defenseMode: false
        };
    }
}

export function jumpNextPortal(creep: Creep, plan: HiveExpansionPlan) {
    let targetedPortal: string | null = null;
    let targetedPortalRoom: string | null = null;

    for (const portal of plan.portals) {
        // break the portal tuple into its components
        const [portalShard, portalRoom, portalId] = portal;

        // if the portal is not on the current shard, skip it
        if (portalShard !== Game.shard.name) {
            continue;
        }

        // if we have already jumped through this portal, skip it
        if (Memory.hive.interShard.portalsJumped![creep.name].includes(portalId)) {
            continue;
        }

        // if we have not jumped through this portal, target it
        targetedPortal = portalId;
        targetedPortalRoom = portalRoom;
        break;
    }

    if (!targetedPortal || !targetedPortalRoom) {
        creep.say('NO_PORTAL!');

        return;
    }

    // if we are not in the room with the portal, move to it
    if (creep.pos.roomName !== targetedPortalRoom) {
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, targetedPortalRoom));
        return;
    }

    // find the portal object in the room
    const portal = Game.getObjectById(targetedPortal) as StructurePortal | null;

    if (!portal) {
        creep.say('NO_PORTAL_OBJ!');
        return;
    }

    if (creep.pos.getRangeTo(portal) > 0) {
        if (creep.fatigue === 0) creep.travelTo(portal);

        return;
    }

    creep.say('???');
}

export function runHiveExpansionCreep(creep: Creep, contextRaw: RoomContext) {
    const context = GLOBAL_CONTEXT[creep.room.name];

    if (!Memory.hive.interShard.expansionPlan) {
        // if we don't have an expansion plan, the creep will idle in the room
        if (creep.pos.roomName !== context.room.name) {
            if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, context.room.name));
        }

        creep.say('NO_PLAN!');

        return;
    }

    // ensure that the hive memory knows of this creeps portal jumps
    if (!Memory.hive.interShard.portalsJumped) {
        Memory.hive.interShard.portalsJumped = {};
    }

    if (!Memory.hive.interShard.portalsJumped[creep.name]) {
        Memory.hive.interShard.portalsJumped[creep.name] = [];
    }

    // find the next portal we need to jump through
    const plan = Memory.hive.interShard.expansionPlan;

    // if we are not on the target shard, we need to jump through the next portal
    if (plan.target.shard !== Game.shard.name) {
        jumpNextPortal(creep, plan);

        return;
    }

    if (plan.target.room !== creep.room.name) {
        if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, plan.target.room));
        return;
    }

    // if we are in the clean resume normal operations, starting with claiming
    if (plan.phase === 'settle' && creep.getActiveBodyparts(CLAIM) > 0) {
        claimController(creep, context, plan);

        return;
    }

    // build any construction sites if we are in the build phase and have WORK parts
    if (plan.phase === 'build' && creep.getActiveBodyparts(WORK) > 0) {
        buildConstructionSite(creep);

        return;
    }

    // attempt to fallback on working
    if (creep.getActiveBodyparts(WORK) > 0) {
        buildConstructionSite(creep);

        return;
    }

    creep.say('USELESS!')
}