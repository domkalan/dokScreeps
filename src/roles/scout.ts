import { RoomContext } from 'utils/Context';
import { scanRoom } from '../hive';

export function runScout(creep: Creep, context: RoomContext): void {
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
        scanRoom(creep.room, creep);

        creep.memory.inRoom = creep.room.name;
    }

    // if screep is not in the scanned room, move to the assigned room
    const assignedRoomName : string = Memory.hive.scouts[creep.name].assigned!;

    if (creep.room.name !== assignedRoomName) {
        const exitDir = Game.map.findExit(creep.room.name, assignedRoomName) as any;

        if (exitDir !== ERR_NO_PATH) {
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
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