import { RoomContext } from "./Context";

interface PerformanceData {
    // the time in milliseconds since the epoch when this data was captured
    utcTime: number;
    // the time in milliseconds since the last tick when this data was captured
    deltaTime: number;

    // the game tick when this data was captured
    tick: number;
    // the CPU used for this tick
    cpuUsage: number;
    // the CPU bucket at the time this data was captured
    cpuBucket: number;

    // the number of creeps by role for this tick
    creepCounts: { [role: string]: number };
    // the number of tasks completed by creeps that died this tick
    creepDeaths: { [creepName: string]: { tasks: number, role: string, diedAt: number } };
    // the CPU used by each creep for this tick
    creepCPUUsage: { [creepName: string]: number };
    // the total CPU used by all creeps for this tick
    creepCPUUsageTotal: number;

    // the energy stored in each room for this tick
    roomEnergyStored: { [roomName: string]: number };
    // the energy stored in each room's spawns and extensions for this tick
    roomSpawnEnergyStored: { [roomName: string]: number };
    // the number of creeps by role for each room for this tick
    roomCreepCounts: { [roomName: string]: { [role: string]: number } };
    // the control level of each room for this tick
    roomControlLevel: { [roomName: string]: number };
    // the CPU used by each room for this tick
    roomCPUUsage: { [roomName: string]: number };
    // the total CPU used by all rooms for this tick
    roomCPUUsageTotal: number;
}

const tickData: PerformanceData = {
    utcTime: Date.now(),
    deltaTime: 0,

    tick: Game.time,
    cpuUsage: Game.cpu.getUsed(),
    cpuBucket: Game.cpu.bucket,

    creepCounts: {},
    creepDeaths: {},
    creepCPUUsage: {},
    creepCPUUsageTotal: 0,

    roomEnergyStored: {},
    roomSpawnEnergyStored: {},
    roomCreepCounts: {},
    roomControlLevel: {},
    roomCPUUsage: {},
    roomCPUUsageTotal: 0,
};

export function onCreepDeath(creepName: string) {
    const completedTasks = Memory.creeps[creepName]?.completedTasks || 0;
    const role = Memory.creeps[creepName]?.role || 'unknown';

    // get current time
    const diedAt = Game.time;

    // log the completed tasks for this creep
    tickData.creepDeaths[creepName] = { tasks: completedTasks, role, diedAt };
}

export function onCreepsCounted(counts: { [role: string]: number }) {
    tickData.creepCounts = counts;
}

export function onCreepTick(creepName: string, cpuUsed: number) {
    tickData.creepCPUUsage[creepName] = cpuUsed;
}

export function onCreepsTicked(cpuUsedTotal: number) {
    tickData.creepCPUUsageTotal = cpuUsedTotal;
}

export function onRoomTick(room: Room, cpuUsed: number, context: RoomContext, creepCounts: { [role: string]: number }) {
    // log the energy stored in the room by summing the energy in all containers and storage structures
    tickData.roomEnergyStored[room.name] = context.structures.filter((structure) => {
        return (
            (structure.structureType === STRUCTURE_CONTAINER) ||
            (structure.structureType === STRUCTURE_STORAGE)
        );
    }).reduce((total, structure) => {
        if (structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_STORAGE) {
            return total + (structure as StructureContainer | StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY);
        }
        return total;
    }, 0);

    // log the creep counts for the room
    tickData.roomCreepCounts[room.name] = creepCounts;

    // log the energy stored in the room's spawns and extensions
    tickData.roomSpawnEnergyStored[room.name] = context.structures.filter((structure) => {
        return (
            (structure.structureType === STRUCTURE_SPAWN) ||
            (structure.structureType === STRUCTURE_EXTENSION)
        );
    }).reduce((total, structure) => {
        if (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) {
            return total + (structure as StructureSpawn | StructureExtension).store.getUsedCapacity(RESOURCE_ENERGY);
        }
        return total;
    }, 0);

    // log the CPU used for this room
    tickData.roomCPUUsage[room.name] = cpuUsed;

    // log the control level of the room
    tickData.roomControlLevel[room.name] = room.controller?.level || 0;
}

export function onRoomsTicked(roomsCpuUsedTotal: number) {
    tickData.roomCPUUsageTotal = roomsCpuUsedTotal;
}

export function captureTickData() {
    const now = Date.now();

    tickData.deltaTime = now - tickData.utcTime;
    tickData.utcTime = now;
    tickData.tick = Game.time;
    tickData.cpuUsage = Game.cpu.getUsed();
    tickData.cpuBucket = Game.cpu.bucket;

    if (Memory.perfMode) {
        console.log(`perfTickData: ${JSON.stringify(tickData)}`);
    }

    // reset the tickData for the next tick
    tickData.creepCounts = {};
    tickData.creepDeaths = {};
    tickData.creepCPUUsage = {};
    tickData.creepCPUUsageTotal = 0;
    tickData.roomEnergyStored = {};
    tickData.roomSpawnEnergyStored = {};
    tickData.roomCreepCounts = {};
    tickData.roomControlLevel = {};
    tickData.roomCPUUsage = {};
    tickData.roomCPUUsageTotal = 0;
}