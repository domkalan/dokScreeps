import { GLOBAL_CONTEXT } from "utils/Context";

import { runHarvester } from "roles/harvester";
import { runBuilder } from "roles/builder";
import { runQueen } from "roles/queen";
import { runScout } from "roles/scout";
import { runHauler } from "roles/hauler";
import { runDefender } from "roles/defender";
import { runAttacker } from "roles/attacker";
import { runClaimer } from "roles/claimer";

export let CREEP_COUNTS: {
    [room: string]: { [role: string]: number } | undefined
} = {};

export let CREEP_CPU_TOTAL: number = 0;
export let CREEP_CPU: { [creepName: string]: number } = {};

export function runCreeps(): void {
    // get cpu usage at the start of the tick
    const cpuStart = Game.cpu.getUsed();
    // reset the creep cpu usage for this tick
    CREEP_CPU = {};

    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        const context = GLOBAL_CONTEXT[creep.memory.room];

        const creepCpuStart = Game.cpu.getUsed();

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
            }

            // if the creep is in danger and not an attacker or defender, move it back to the home room
            if (creep.memory.inDanger && creep.memory.role !== 'attacker' && creep.memory.role !== 'defender') {
                creep.say(`😱`);

                // if the creep is not in the home room, move it back to the home room
                if (creep.room.name !== creep.memory.room) {
                    creep.travelTo(new RoomPosition(25, 25, creep.memory.room)); // Move to the center of the home room
                }

                continue; // skip the rest of the logic for this creep
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
                default:
                    creep.say(`❓`);
                    debugLog(`Creep ${creep.name} has an unknown role: ${creep.memory.role}`);
            }
        } catch (error) {
            debugLog(`Error running creep ${creep.name}: ${error}`);
        }

        CREEP_CPU[creepName] = Game.cpu.getUsed() - creepCpuStart;
    }

    CREEP_CPU_TOTAL = Game.cpu.getUsed() - cpuStart;
}

export function indexCreeps() {
    // reset the creep counts for this tick
    CREEP_COUNTS = {};

    // index all creeps by room and role
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];

        // build a count of creeps by role for the room
        try {
            if (!CREEP_COUNTS[creep.memory.room]) {
                CREEP_COUNTS[creep.memory.room] = {};
            }

            if (!CREEP_COUNTS[creep.memory.room]![creep.memory.role]) {
                CREEP_COUNTS[creep.memory.room]![creep.memory.role] = 0;
            }

            CREEP_COUNTS[creep.memory.room]![creep.memory.role]!++;
        } catch (error) {
            debugLog(`Error counting creep ${creep.name}: ${error}`);
        }
    }
}