import { GLOBAL_CONTEXT, RoomContext } from "utils/Context";

import { runHarvester } from "roles/harvester";
import { runBuilder } from "roles/builder";
import { runQueen } from "roles/queen";
import { runScout } from "roles/scout";
import { runHauler } from "roles/hauler";
import { runDefender } from "roles/defender";
import { runAttacker } from "roles/attacker";
import { runClaimer } from "roles/claimer";
import { completeTask } from "utils/TaskManager";
import { runHiveExpansionCreep } from "roles/hive/expansion";
import { runGoat } from "roles/goat";

export let CREEP_COUNTS: {
    [room: string]: { [role: string]: number } | undefined
} = {};
export let CREEP_COUNTS_GENERIC: {
    [role: string]: number
} = {};
export let CREEP_CPU_TOTAL: number = 0;
export let CREEP_CPU: { [creepName: string]: number } = {};

/**
 * Blocking style function that will take over the creeps logic to perform defensive maneuvers.
 * 
 * Returns true if the creep is in danger and is performing defensive maneuvers, false otherwise.
 * @param creep 
 * @param context 
 * @returns 
 */
export function runCreepDefenses(creep: Creep, context: RoomContext): boolean {
    // attempt to protect the creep by adding a in danger mode
    if (!creep.memory.lastHealth) {
        creep.memory.lastHealth = creep.hits;
    } else if (creep.hits < creep.memory.lastHealth) {
        debugLog(`Creep ${creep.name} took damage. Health: ${creep.hits}/${creep.hitsMax}`);
        creep.memory.lastHealth = creep.hits;
        creep.memory.lastDamageTime = Game.time;
        creep.memory.inDanger = true;
    } else if (creep.memory.inDanger && Game.time - (creep.memory.lastDamageTime || 0) > 100) {
        debugLog(`Creep ${creep.name} is no longer in danger.`);
        creep.memory.inDanger = false;
    } if (creep.hits > creep.memory.lastHealth) {
        creep.memory.lastHealth = creep.hits;
    }

    if (creep.memory.disableInDanger) {
        return false;
    }

    // if the creep is in danger and not an attacker or defender, move it back to the home room
    if (creep.memory.inDanger) {
        if (Game.time % 10 === 0) {
            creep.say(`😱`);
        }

        // Body-part scans walk the creep body. Cache them for this defense pass
        // instead of repeating getActiveBodyparts several times below.
        const attackParts = creep.getActiveBodyparts(ATTACK);
        const rangedAttackParts = creep.getActiveBodyparts(RANGED_ATTACK);

        if (attackParts > 0 || rangedAttackParts > 0) {
            // find the nearest hostile creep and attack it
            let nearestHostileId: string | null = null;
            let nearestHostileRange = Infinity;

            for (const hostile of context.hostiles) {
                const range = creep.pos.getRangeTo(hostile);
                if (range < nearestHostileRange) {
                    nearestHostileId = hostile.id;
                    nearestHostileRange = range;
                }
            }

            const nearestHostile = nearestHostileId ? Game.getObjectById(nearestHostileId) as Creep | null : null;

            if (nearestHostile) {
                const creepRange = creep.pos.getRangeTo(nearestHostile);

                // for ranged creeps, get near but not too close, for melee creeps, get as close as possible
                if (rangedAttackParts > 0) {
                    if (creepRange > 3) {
                        if (creep.fatigue === 0) creep.travelTo(nearestHostile);
                    } else if (creepRange < 2) {
                        // move away from the hostile
                        const fleePos = creep.pos.getDirectionTo(nearestHostile) + 4; // opposite direction
                        const newPos = new RoomPosition(creep.pos.x + Math.cos(fleePos * (Math.PI / 4)), creep.pos.y + Math.sin(fleePos * (Math.PI / 4)), creep.pos.roomName);

                        if (newPos) {
                            if (creep.fatigue === 0) creep.travelTo(newPos);
                        }
                    }

                    creep.rangedAttack(nearestHostile);
                } else {
                    if (creepRange > 1) {
                        if (creep.fatigue === 0) creep.travelTo(nearestHostile);
                    } else {
                        creep.attack(nearestHostile);
                    }
                }
            }
        } else {
            // if the creep is not in the home room, move it back to the home room
            if (creep.room.name !== creep.memory.room) {
                if (creep.fatigue === 0) creep.travelTo(new RoomPosition(25, 25, creep.memory.room)); // Move to the center of the home room
            } else {
                // if the creep is in the home room, move it to a safe position (e.g., near the spawn)
                const homeRoom = Game.rooms[creep.memory.room];
                if (homeRoom) {
                    const spawn = GLOBAL_CONTEXT[creep.memory.room]?.spawns[0];
                    if (spawn) {
                        if (creep.fatigue === 0) creep.travelTo(spawn.pos);
                    }
                }
            }

            return true;
        }

        return true;
    }

    return false;
}

export function runHiveCreep(creep: Creep, context: RoomContext): void {
    try {
        // expansion creeps operate under different logic, so we will handle them separately
        if (creep.name.startsWith('hive-expansion')) {
            runHiveExpansionCreep(creep, context);
        }
    } catch (error) {
        console.error('[CREEP] Error running on hive creep:', error);

        creep.say(`H_ERR`);
    }
}

export function runCreeps(): void {
    // get cpu usage at the start of the tick
    const cpuStart = Game.cpu.getUsed();
    // reset the creep cpu usage for this tick
    CREEP_CPU = {};
    const trackIndividualCpu = Memory.perfMode || !!Memory.debugDisplay;

    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        const context = GLOBAL_CONTEXT[creep.memory.room];

        const creepCpuStart = trackIndividualCpu ? Game.cpu.getUsed() : 0;

        // hive creeps operate on a different set of logic
        if (creep.name.startsWith('hive-')) {
            runHiveCreep(creep, context);

            if (trackIndividualCpu) {
                CREEP_CPU[creepName] = Game.cpu.getUsed() - creepCpuStart;
            }

            continue;
        }

        try {
            if (runCreepDefenses(creep, context)) {
                // if the creep is in danger and is performing defensive maneuvers, skip the rest of its logic
                if (trackIndividualCpu) {
                    CREEP_CPU[creepName] = Game.cpu.getUsed() - creepCpuStart;
                }
                continue;
            }

            // run the appropriate role logic for the creep
            switch (creep.memory.role) {
                case 'harvester':
                    runHarvester(creep, context);
                    break;
                case 'builder':
                    runBuilder(creep, context);
                    break;
                case 'queen':
                    runQueen(creep, context);
                    break;
                case 'scout':
                    runScout(creep, context);
                    break;
                case 'filler':
                case 'hauler':
                    runHauler(creep, context);
                    break;
                case 'defender':
                    runDefender(creep, context);
                    break;
                case 'attacker':
                    runAttacker(creep, context);
                    break;
                case 'claimer':
                    runClaimer(creep, context);
                    break;
                case 'goat':
                    runGoat(creep, context);
                    break;
                default:
                    if (Game.time % 25 === 0) {
                        creep.say(`❓`);
                    }
                    debugLog(`Creep ${creep.name} has an unknown role: ${creep.memory.role}`);
            }
        } catch (error) {
            console.error(`[CREEP] Error running creep ${creep.name}:`, error);

            completeTask(creep); // Clear the task if there's an error

            delete creep.memory.taskId; // Clear the task from memory
            delete creep.memory.taskStarted; // Clear the taskStarted from memory
            delete creep.memory.focusedOn; // Clear the focusedOn from memory

            creep.say(`ERR`);
        }

        if (trackIndividualCpu) {
            CREEP_CPU[creepName] = Game.cpu.getUsed() - creepCpuStart;
        }
    }

    CREEP_CPU_TOTAL = Game.cpu.getUsed() - cpuStart;
}

export function indexCreeps() {
    // reset the creep counts for this tick
    CREEP_COUNTS = {};
    CREEP_COUNTS_GENERIC = {};

    // create room entries for all rooms
    for (const roomName in Game.rooms) {
        CREEP_COUNTS[roomName] = {};
    }

    // index all creeps by room and role
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];

        // build a count of creeps by role for the room
        try {
            // update count for the room and role
            if (!CREEP_COUNTS[creep.memory.room]) {
                CREEP_COUNTS[creep.memory.room] = {};
            }

            if (!CREEP_COUNTS[creep.memory.room]![creep.memory.role]) {
                CREEP_COUNTS[creep.memory.room]![creep.memory.role] = 0;
            }

            CREEP_COUNTS[creep.memory.room]![creep.memory.role]!++;

            // update count for the role across all rooms
            if (!CREEP_COUNTS_GENERIC[creep.memory.role]) {
                CREEP_COUNTS_GENERIC[creep.memory.role] = 0;
            }

            CREEP_COUNTS_GENERIC[creep.memory.role]!++;
        } catch (error) {
            debugLog(`Error counting creep ${creep.name}: ${error}`);
        }
    }
}
