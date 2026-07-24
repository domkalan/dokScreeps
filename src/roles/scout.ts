import { scanRoom } from '../hive';

export function runScout(creep: Creep): void {
    if (!Memory.hive.scouts[creep.name].assigned) {
        console.log(`Scout ${creep.name} has no assigned room. Assigning a new task.`);

        const pendingRooms = Object.values(Memory.hive.scouts).map(scout => scout.assigned);

        const unscannedRooms = Object.entries(Memory.hive.rooms).filter(([roomName, roomData]) => {
            return Game.time - roomData.lastScan > 100000 && !pendingRooms.includes(roomName);
        });

        if (unscannedRooms.length > 0) {
            const [roomName] = unscannedRooms[0];
            Memory.hive.scouts[creep.name].assigned = roomName;
            console.log(`Scout ${creep.name} assigned to scan room ${roomName}`);
        } else {
            console.log(`No unscanned rooms available for scout ${creep.name}`);
            return;
        }
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
            console.log(`No path found for scout ${creep.name} to room ${assignedRoomName}`);
        }
    } else {
        scanRoom(creep.room);

        console.log(`Scout ${creep.name} has scanned room ${assignedRoomName}`);

        // After scanning, clear the assigned room so the scout can be reassigned
        Memory.hive.scouts[creep.name].assigned = undefined;
    }
}