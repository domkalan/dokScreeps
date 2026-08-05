import { RoomContext } from 'utils/Context';
import { scanRoom } from '../hive';

export const scoutPhrases: string[] = [
    "NO SHOES, NO SHIRT, NO SERVICE.",
    "NOTHING TO SEE HERE.",
    "I COME IN PEACE.",
    "SCOUTING IS A PERFECTLY NORMAL HOBBY.",
    "DO YOU HAVE A MOMENT TO TALK ABOUT EXPANSION?",
    "NICE ROOM. WOULD BE A SHAME IF SOMEONE SCOUTED IT.",
    "I HAVE SEEN ENOUGH.",
    "CARRY ON.",
    "YOUR TERRAIN HAS BEEN NOTED.",
    "THIS VISIT NEVER HAPPENED.",
    "HELLO, NEIGHBOR.",
    "PLEASE IGNORE ME.",
    "I AM DEFINITELY NOT SPYING.",
    "SECURITY AUDIT COMPLETE.",
    "YOU LEFT YOUR DOOR UNLOCKED",
    "THIS IS A ROUTINE CHECK.",
    "I AM JUST PASSING THROUGH.",
    "I LIKE YOUR ROOM.",
    "I AM A FRIENDLY SCOUT.",
    "I AM NOT A THREAT.",
    "I AM A TOURIST.",
    "NEW ROOM, WHO DIS?",
    "JUST CHECKING THE EXITS.",
    "VIBE CHECK COMPLETE.",
    "INTERESTING ROCK COLLECTION.",
    "DO NOT MIND ME.",
    "I TOOK A WRONG TURN AT E0N0.",
    "PLEASE REMAIN CALM.",
    "THE SCOUT HAS ENTERED THE CHAT.",
    "HELLO FROM THE OTHER SIDE.",
    "I AM SPEED.",
    "OBSERVATION COMPLETE.",
    "THANKS FOR THE TOUR.",
    "VOTE FOR PEDRO.",
    "ONE DOES NOT SIMPLY ENTER THIS ROOM.",
    "ROAD? WHERE WE'RE GOING, WE DON'T NEED ROADS.",
    "PEANUT BUTTER JELLY TIME.",
    "WASD INTO THE WRONG ROOM.",
    "PLEASE WAIT, BUFFERING...",
    "DUDE, WHERE'S MY SPAWN?",
    "F",
    "OK BOOMER",
    "DID YOU KNOW? THEY DID SURGERY ON A GRAPE.",
    "SOMEBODY TOUCHA MY SPAGHET!",
    "ALLOW ME TO INTRODUCE MYSELF.",
    "I AM ONCE AGAIN ASKING FOR ENERGY.",
    "CASH ME OUTSIDE HOW BOUT DAT?",
    "DJ KHALED: ANOTHER ONE.",
    "THIS AINT IT CHIEF.",
    "SIR, THIS IS WENDYS.",
    "GOT ANY GAMES?",
    "REMEMBER THE ALIEN 51 RAID? YEAH...",
    "THE FLOOR IS LAVA!",
    "NEW PHONE, WHO DIS?",
    "THANK YOU FOR YOUR HOSPITALITY.",
    "A CAR WOULD BE NICE RIGHT NOW.",
    "AND YOU MAY ASK YOURSELF, WELL HOW DID I GET HERE?",
];

export function runScout(creep: Creep, context: RoomContext): void {
    // get a random phrase from the scoutPhrases array and assign it to the creep's memory if it doesn't have one
    if (!creep.memory.focusedOn) {
        // Assign a random phrase to the scout if it doesn't have one
        const randomPhrase = scoutPhrases[Math.floor(Math.random() * scoutPhrases.length)];
        creep.memory.focusedOn = randomPhrase;
    }

    const splitPhrase = creep.memory.focusedOn.split(' ');
    if (splitPhrase.length >= 1) {
        const firstWord = splitPhrase.shift();
        creep.say(firstWord || '...', false);
        creep.memory.focusedOn = splitPhrase.join(' ');
    }

    if (!Memory.hive.scouts[creep.name].assigned) {
        debugLog(`Scout ${creep.name} has no assigned room. Assigning a new task.`);

        const pendingRooms = Object.values(Memory.hive.scouts).map(scout => scout.assigned);

        const unscannedRooms = Object.entries(Memory.hive.rooms).filter(([roomName, roomData]) => {
            return Game.time - roomData.lastScan > 100000 && !pendingRooms.includes(roomName);
        });

        if (unscannedRooms.length > 0) {
            const [roomName] = unscannedRooms[0];
            Memory.hive.scouts[creep.name].assigned = roomName;
            debugLog(`Scout ${creep.name} assigned to scan room ${roomName}`);
        } else {
            debugLog(`No unscanned rooms available for scout ${creep.name}`);
            return;
        }
    }

    if (!creep.memory.inRoom || creep.memory.inRoom !== creep.room.name) {
        // scan the room
        scanRoom(creep.room, creep);

        // update the scan target
        creep.memory.inRoom = creep.room.name;
    }

    // if screep is not in the scanned room, move to the assigned room
    const assignedRoomName: string = Memory.hive.scouts[creep.name].assigned!;

    if (creep.room.name !== assignedRoomName) {
        const exitDir = Game.map.findExit(creep.room.name, assignedRoomName) as any;

        if (exitDir !== ERR_NO_PATH) {
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) {
                creep.travelTo(exit);
            }
        } else {
            debugLog(`No path found for scout ${creep.name} to room ${assignedRoomName}`);
        }
    } else if (creep.room.name === assignedRoomName) {
        scanRoom(creep.room, creep);

        debugLog(`Scout ${creep.name} has scanned room ${assignedRoomName}`);

        // After scanning, clear the assigned room so the scout can be reassigned
        Memory.hive.scouts[creep.name].assigned = undefined;
    }
}