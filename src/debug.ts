import { ROOM_CPU, ROOM_TOTAL_CPU, getStoredEnergy } from './rooms';
import { CREEP_CPU, CREEP_CPU_TOTAL, CREEP_COUNTS } from './creeps';
import { GLOBAL_CONTEXT } from './utils/Context';

/**
 * Draws on screen debug information for the colony.
 */

export function drawDebugInfo() {
    try {
        // draw room debug info for the room we are displaying
        drawRoomDebugInfo();

        // draw hive debug info for all rooms we know about
        drawHiveDebugInfo();

        // branch to the cpu debug if that mode is enabled
        drawCpuDebugInfo();
    } catch (error) {
        console.log(`Error drawing debug info: ${error}`);
    }
}

export function drawRoomDebugInfo() {
    if (!Memory.debugDisplay) {
        return;
    }

    const roomDisplay = Memory.debugDisplay || Object.keys(Game.rooms)[0];
    const roomMemory = Memory.rooms[roomDisplay];

    if (!roomMemory) {
        return;
    }

    // draw the room's tasks on the screen
    let textOffset = 0;
    for (const taskId in roomMemory.tasks) {
        const task = roomMemory.tasks[taskId];
        Game.rooms[roomDisplay].visual.text(`Task: ${task.type} ${task.completed ? '✅' : '❌'} - pri=${task.priority}, ttl=${Game.time - task.expires}`, 0.5, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;
    }

    // display counts for each task type across all rooms
    const taskCounts: { [taskType: string]: number } = {};
    for (const roomName in Memory.rooms) {
        const roomMemory = Memory.rooms[roomName];
        for (const taskId in roomMemory.tasks) {
            const task = roomMemory.tasks[taskId];
            if (!taskCounts[task.type]) {
                taskCounts[task.type] = 0;
            }
            taskCounts[task.type]++;
        }
    }

    let taskCountText = `Task Counts: `;
    for (const taskType in taskCounts) {
        taskCountText += `${taskType}: ${taskCounts[taskType]} | `;
    }
    Game.rooms[roomDisplay].visual.text(taskCountText.slice(0, -3), 0.5, textOffset, { align: 'left', font: 0.5 });
    textOffset += 1;

    // draw all creeps that belong to this room and their roles
    let creepsInRoom = 0;
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.memory.room === roomDisplay) {
            Game.rooms[roomDisplay].visual.text(`Creep: ${creep.name} (${creep.memory.role}), ttl=${creep.ticksToLive}, room=${creep.room.name}`, 0.5, textOffset, { align: 'left', font: 0.5 });
            textOffset += 0.5;
            creepsInRoom++;
        }
    }

    Game.rooms[roomDisplay].visual.text(`Creep Counts: ${creepsInRoom}/${Object.keys(Game.creeps).length}`, 0.5, textOffset, { align: 'left', font: 0.5 });
    textOffset += 0.5;

    // display counts for each role of creep across all rooms
    const roleCounts: { [role: string]: number } = {};
    for (const roomName in CREEP_COUNTS) {
        const roomCounts = CREEP_COUNTS[roomName];
        for (const role in roomCounts) {
            if (!roleCounts[role]) {
                roleCounts[role] = 0;
            }
            roleCounts[role] += roomCounts[role] || 0;
        }
    }

    let roleCountText = `Creep Counts: `;
    for (const role in roleCounts) {
        roleCountText += `${role}: ${roleCounts[role]} | `;
    }
    Game.rooms[roomDisplay].visual.text(roleCountText.slice(0, -3), 0.5, textOffset, { align: 'left', font: 0.5 });
    textOffset += 0.5;

    // draw the spawn queue for this room
    for (const spawnTask of roomMemory.spawnQueue || []) {
        Game.rooms[roomDisplay].visual.text(`Spawn: ${spawnTask.role} - ${spawnTask.priority}`, 0.5, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;
    }
    textOffset += 0.5;

    // draw how much energy is stored in the room
    const storedEnergy = getStoredEnergy(GLOBAL_CONTEXT[roomDisplay]);
    Game.rooms[roomDisplay].visual.text(`Stored Energy: ${storedEnergy}`, 0.5, textOffset, { align: 'left', font: 0.5 });
    textOffset += 0.5;

    // draw how much energy is on standby in the room for spawning
    const standbyEnergy = Game.rooms[roomDisplay].energyAvailable;
    Game.rooms[roomDisplay].visual.text(`Spawn Energy: ${standbyEnergy}`, 0.5, textOffset, { align: 'left', font: 0.5 });
    textOffset += 0.5;

    // display if the room is in defense mode
    Game.rooms[roomDisplay].visual.text(`Defense Mode: ${roomMemory.defenseMode ? 'ON' : 'OFF'}`, 0.5, textOffset, { align: 'left', font: 0.5, color: roomMemory.defenseMode ? 'red' : undefined });
    textOffset += 1;

    // draw when the next hive scan is
    Game.rooms[roomDisplay].visual.text(`Hive: ${Memory.hive.lastScan + 100 - Game.time}`, 0.5, textOffset, { align: 'left', font: 0.5 });
    textOffset += 0.5;
    // draw how many hive tasks are queued
    Game.rooms[roomDisplay].visual.text(`Hive Tasks: ${Object.keys(Memory.hive.tasks).length}`, 0.5, textOffset, { align: 'left', font: 0.5 });
    textOffset += 0.5;

    // draw what room the scout is in if we have a scout
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.name.startsWith('hive-')) {
            Game.rooms[roomDisplay].visual.text(`Hive Creep: ${creep.name} - (${creep.room.name}, ${creep.pos.x}, ${creep.pos.y}) - pocket=${creep.store.getUsedCapacity() || 0}/${creep.store.getCapacity() || 0}`, 0.5, textOffset, { align: 'left', font: 0.5 });
            textOffset += 0.5;
        }
    }
}

// cpu debug draws to the right side of the room screen
export function drawCpuDebugInfo() {
    const roomDisplay = Memory.debugDisplay || Object.keys(Game.rooms)[0];

    let textOffset = 0;

    for (const roomName in ROOM_CPU) {
        Game.rooms[roomDisplay].visual.text(`Room CPU: ${roomName} - ${ROOM_CPU[roomName].toFixed(2)}`, 48.75, textOffset, { align: 'right', font: 0.5 });
        textOffset += 0.5;
    }

    // display total cpu usage for all rooms
    Game.rooms[roomDisplay].visual.text(`Total Room CPU: ${ROOM_TOTAL_CPU.toFixed(2)}`, 49, textOffset, { align: 'right', font: 0.5 });
    textOffset += 1.0;

    // display cpu usage for each creep
    for (const creepName in CREEP_CPU) {
        Game.rooms[roomDisplay].visual.text(`Creep CPU: ${creepName} - ${CREEP_CPU[creepName].toFixed(2)}`, 48.75, textOffset, { align: 'right', font: 0.5 });
        textOffset += 0.5;
    }

    // display total cpu usage for all creeps
    Game.rooms[roomDisplay].visual.text(`Total Creep CPU: ${CREEP_CPU_TOTAL.toFixed(2)}`, 49, textOffset, { align: 'right', font: 0.5 });
    textOffset += 1.0;

    // total CPU usage for the tick
    Game.rooms[roomDisplay].visual.text(`Total CPU: ${Game.cpu.getUsed().toFixed(2)}/${Game.cpu.limit}/${Game.cpu.bucket}`, 49, textOffset, { align: 'right', font: 0.5 });
    textOffset += 0.5;

    // tally up cpu usage by role for all creeps and display it
    const roleCpuUsage: { [role: string]: number } = {};
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (!roleCpuUsage[creep.memory.role]) {
            roleCpuUsage[creep.memory.role] = 0;
        }
        roleCpuUsage[creep.memory.role] += CREEP_CPU[creepName] || 0;
    }

    for (const role in roleCpuUsage) {
        Game.rooms[roomDisplay].visual.text(`Role CPU: ${role} - ${roleCpuUsage[role].toFixed(2)}`, 48.75, textOffset, { align: 'right', font: 0.5 });
        textOffset += 0.5;
    }
}

export function attachDebug() {
    // Attach the debugLog function to the global object for easy access in the console
    global.debugLog = function (message: string): void {
        if (!!Memory.debugDisplay) {
            console.log(`[DEBUG] ${message}`);
        }
    }
}

export function drawHiveDebugInfo() {
    for (const roomName in Memory.hive.rooms) {
        const roomMemory = Memory.hive.rooms[roomName];
        if (!roomMemory) {
            continue;
        }

        Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, { fill: roomMemory.hostile ? '#ff0000' : '#00ff00', opacity: 0.25 });
        Game.map.visual.text(`Age: ${roomMemory.lastScan === 0 ? 'N/A' : Game.time - roomMemory.lastScan}`, new RoomPosition(25, 25, roomName), { align: 'center', fontSize: 3, color: '#ffffff' });
        Game.map.visual.text(`Hostile: ${roomMemory.hostile ? 'Yes' : 'No'}`, new RoomPosition(25, 27, roomName), { align: 'center', fontSize: 3, color: '#ffffff' })
        Game.map.visual.text(`Highway: ${roomMemory.highway ? 'Yes' : 'No'}`, new RoomPosition(25, 29, roomName), { align: 'center', fontSize: 3, color: '#ffffff' })
    }
}