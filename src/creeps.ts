import { GLOBAL_CONTEXT } from "utils/Context";
import * as perfTracking from "utils/PerformanceTracking";

import { runHarvester } from "roles/harvester";
import { runBuilder } from "roles/builder";
import { runQueen } from "roles/queen";
import { runScout } from "roles/scout";
import { runHauler } from "roles/hauler";
import { runDefender } from "roles/defender";
import { runAttacker } from "roles/attacker";
import { runClaimer } from "roles/claimer";
import { completeTask } from "utils/TaskManager";
import { runHiveColonizer } from "roles/h-colonizer";
import { runHiveBuilder } from "roles/h-builder";

export let CREEP_COUNTS: {
    [room: string]: { [role: string]: number } | undefined
} = {};
export let CREEP_COUNTS_GENERIC: {
    [role: string]: number
} = {};
export let CREEP_CPU_TOTAL: number = 0;
export let CREEP_CPU: { [creepName: string]: number } = {};

export function runCreeps(): void {
    // get cpu usage at the start of the tick
    const cpuStart = Game.cpu.getUsed();
    // reset the creep cpu usage for this tick
    CREEP_CPU = {};
    const trackIndividualCpu = Memory.perfMode || typeof Memory.debugDisplay !== 'undefined';

    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        const context = GLOBAL_CONTEXT[creep.memory.room];

        const creepCpuStart = trackIndividualCpu ? Game.cpu.getUsed() : 0;

        try {
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

            // if the creep is in danger and not an attacker or defender, move it back to the home room
            if (creep.memory.inDanger && creep.memory.role !== 'attacker' && creep.memory.role !== 'defender') {
                if (Game.time % 10 === 0) {
                    creep.say(`😱`);
                }

                // if the creep is not in the home room, move it back to the home room
                if (creep.room.name !== creep.memory.room) {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.room)); // Move to the center of the home room
                } else {
                    // if the creep is in the home room, move it to a safe position (e.g., near the spawn)
                    const homeRoom = Game.rooms[creep.memory.room];
                    if (homeRoom) {
                        const spawn = GLOBAL_CONTEXT[creep.memory.room]?.spawns[0];
                        if (spawn) {
                            creep.travelTo(spawn.pos);
                        }
                    }
                }

                continue; // skip the rest of the logic for this creep
            }

            if (creep.name.startsWith('hive-colonizer-')) {
                runHiveColonizer(creep, context);
            } else if (creep.name.startsWith('hive-builder-')) {
                runHiveBuilder(creep, context);
            } else {
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
                    default:
                        if (Game.time % 25 === 0) {
                            creep.say(`❓`);
                        }
                        debugLog(`Creep ${creep.name} has an unknown role: ${creep.memory.role}`);
                }
            }
        } catch (error) {
            debugLog(`Error running creep ${creep.name}: ${error}`);

            completeTask(creep); // Clear the task if there's an error

            delete creep.memory.taskId; // Clear the task from memory
            delete creep.memory.taskStarted; // Clear the taskStarted from memory
            delete creep.memory.focusedOn; // Clear the focusedOn from memory

            creep.say(`ERR`);
        }

        if (trackIndividualCpu) {
            CREEP_CPU[creepName] = Game.cpu.getUsed() - creepCpuStart;

            // signal to perfTracking that this creep has finished its tick
            perfTracking.onCreepTick(creepName, CREEP_CPU[creepName]);
        }
    }

    CREEP_CPU_TOTAL = Game.cpu.getUsed() - cpuStart;

    // signal to perfTracking that all creeps have finished their ticks
    perfTracking.onCreepsTicked(CREEP_CPU_TOTAL);
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

    // signal to perfTracking that all creeps have been counted
    perfTracking.onCreepsCounted(CREEP_COUNTS_GENERIC);
}
