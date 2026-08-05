/**
 * Draws on screen debug information for the colony.
 */

export function drawDebugInfo() {
    for (const roomName in Game.rooms) {
        let textOffset = 0;

        const room = Game.rooms[roomName];

        // display the cpu bucket and cpu usage
        room.visual.text(`CPU: ${Game.cpu.getUsed().toFixed(2)}/${Game.cpu.limit}/${Game.cpu.bucket}`, 0, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;

        const hiveScan = (Game.time - Memory.hive.lastScan) - 100;

        // draw the next time the hive will scan
        room.visual.text(`Hive (next scan t${hiveScan})`, 0, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;

        // display all active rooms and their last scan time
        for (const activeRoom in Game.rooms) {
            const scanAge = (Game.time - Game.rooms[activeRoom].memory.lastScan) - 100;
            room.visual.text(`${activeRoom} (next scan t${scanAge})`, 0.25, textOffset, { align: 'left', font: 0.25, color: '#dbdbdb' });
            textOffset += 0.25;
        }
        textOffset += 0.5;

        const roomScan = (Game.time - room.memory.lastScan) - 100;

        // draw the room name at the top of the room
        room.visual.text(`Colony ${room.name} (next scan t${roomScan})`, 0, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;

        if (room.memory.defenseMode) {
            const defenseModeActivatedAt = room.memory.defenseModeActivatedAt || 0;
            const defenseModeDuration = Game.time - defenseModeActivatedAt;

            room.visual.text(`Defense Mode - (t+${defenseModeDuration})`, 25, 5.5, { align: 'center', font: 2.5, color: '#ff0000' });
        }

        // draw the number of creeps in the room
        const creepsInRoom = Object.values(Game.creeps).filter(creep => creep.memory.room === room.name);
        room.visual.text(`Creeps: ${creepsInRoom.length}`, 0, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;

        for (const creep of creepsInRoom) {
            room.visual.text(`Creep: ${creep.name} - role:${creep.memory.role} - task:${creep.memory.taskId || 'none'} - ttl:${creep.ticksToLive || 'none'} - loc:${creep.room.name || 'none'},x:${creep.pos.x},y:${creep.pos.y}`, 0.25, textOffset, { align: 'left', font: 0.25, color: '#dbdbdb' });
            textOffset += 0.25;
        }
        textOffset += 0.5;

        // get task queue for the room
        const tasksForRoom = room.memory.tasks ? Object.values(room.memory.tasks) : [];
        room.visual.text(`Tasks: ${tasksForRoom.length}`, 0, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;

        // display each task in the room
        for (const task of tasksForRoom) {
            room.visual.text(`Task: ${task.type} - ${task.id} - pri:${task.priority} - assi:${task.assigned || 'none'} - exp:${Game.time - task.expires} - c:${task.completed ? 'true' : 'false'}`, 0.25, textOffset, { align: 'left', font: 0.25, color: '#dbdbdb' });
            textOffset += 0.25;
        }
        textOffset += 0.5;

        // get spawn queue for the room
        const spawnQueue = room.memory.spawnQueue || [];
        room.visual.text(`Spawn Queue: ${spawnQueue.length}`, 0, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;

        // log room energy
        room.visual.text(`Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`, 0.25, textOffset, { align: 'left', font: 0.25, color: '#dbdbdb' });
        textOffset += 0.25;

        for (const spawn of spawnQueue) {
            room.visual.text(`Spawn: ${spawn.role} - pri:${spawn.priority}`, 0.25, textOffset, { align: 'left', font: 0.25, color: '#dbdbdb' });
            textOffset += 0.25;
        }
        textOffset += 0.5;
    }

    const scoutedRooms = Object.entries(Memory.hive.rooms);

    debugLog(`Scouted Rooms: ${scoutedRooms.length}`);

    for (const [roomName, roomData] of scoutedRooms) {
        const scanAge = Game.time - roomData.lastScan;

        if (roomData.lastScan > 0 && scanAge < 10000 && !roomData.hostile) {
            Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, { fill: '#00ff00', stroke: '#00ff00', opacity: 0.5, lineStyle: 'dashed' });
        } else if (roomData.lastScan > 0 && scanAge < 10000 && roomData.hostile) {
            Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, { fill: '#ffff00', stroke: '#ffff00', opacity: 0.5, lineStyle: 'dashed' });
        } else if (roomData.lastScan > 0 && scanAge > 10000) {
            Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, { fill: '#ff7300', stroke: '#ff7300', opacity: 0.5, lineStyle: 'dashed' });
        } else {
            Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, { fill: '#ff0000', stroke: '#ff0000', opacity: 0.5, lineStyle: 'dashed' });
        }
    }
}