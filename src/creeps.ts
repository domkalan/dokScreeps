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

export function runCreeps(): void {
    CREEP_COUNTS = {}; // reset the creep counts at the start of each tick

    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        const context = GLOBAL_CONTEXT[creep.memory.room];

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
    }
}

export function indexCreeps() {
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