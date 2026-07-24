'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function getTaskById(taskId) {
    for (const room of getOwnedRooms()) {
        const task = room.memory.tasks[taskId];
        if (task) {
            return task;
        }
    }
    return undefined;
}
function findTaskForCreep(creep, taskType) {
    const room = creep.room;
    const tasks = room.memory.tasks;
    // Filter tasks by type and unassigned status
    const availableTasks = Object.entries(tasks)
        .filter(([_, task]) => task.type === taskType && !task.assigned)
        .map(([taskId, task]) => ({ ...task, id: taskId }));
    // Sort tasks by priority (lower number means higher priority)
    availableTasks.sort((a, b) => a.priority - b.priority);
    // Return the highest priority task, if any
    return availableTasks.length > 0 ? availableTasks[0] : undefined;
}

function runHarvester(creep) {
    if (!creep.memory.taskId) {
        // Assign a new task to the harvester if it doesn't have one
        const task = findTaskForCreep(creep, 'harvest');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.id;
        }
        else {
            console.log(`No available harvest tasks for creep ${creep.name}`);
            return;
        }
    }
    const task = getTaskById(creep.memory.taskId);
    if (!task) {
        console.log(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    task.assigned = creep.id; // Ensure the task is marked as assigned to this creep
    const source = Game.getObjectById(task.targetId);
    if (!source) {
        console.log(`Source with ID ${task.targetId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    // if the creep is full, attempt to transfer to nearby storage (link or container) if available
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        const nearbyStorage = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_LINK ||
                    structure.structureType === STRUCTURE_CONTAINER) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        console.log(`Creep ${creep.name} is full. Found ${nearbyStorage.length} nearby storage structures.`);
        if (nearbyStorage.length > 0) {
            const targetStorage = nearbyStorage[0];
            const transferResult = creep.transfer(targetStorage, RESOURCE_ENERGY);
            if (transferResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetStorage, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        }
        else {
            if (creep.room.controller && creep.room.controller.level < 2) {
                // if no nearby storage is available and room is in bootstrap mode, take the energy to the spawn or extension
                const spawnOrExtension = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
                    filter: (structure) => {
                        return ((structure.structureType === STRUCTURE_SPAWN ||
                            structure.structureType === STRUCTURE_EXTENSION) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
                    }
                });
                console.log(`Creep ${creep.name} is full. Found ${spawnOrExtension ? 1 : 0} nearby spawn or extension structures.`);
                if (spawnOrExtension) {
                    const transferResult = creep.transfer(spawnOrExtension, RESOURCE_ENERGY);
                    if (transferResult === ERR_NOT_IN_RANGE) {
                        creep.moveTo(spawnOrExtension, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
                    }
                }
                else {
                    creep.drop(RESOURCE_ENERGY);
                }
            }
            else {
                // if no nearby storage is available and room is not in bootstrap mode, drop the energy on the ground
                creep.drop(RESOURCE_ENERGY);
            }
        }
    }
    else {
        const harvestResult = creep.harvest(source);
        if (harvestResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
            return;
        }
    }
}

function goForEnergy(creep) {
    if (creep.memory.goingFor) {
        const target = Game.getObjectById(creep.memory.goingFor);
        if (target && target instanceof StructureStorage && target.store[RESOURCE_ENERGY] > 0) {
            const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
            if (withdrawResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
            else if (withdrawResult === OK) {
                delete creep.memory.goingFor; // Clear the goingFor memory once energy is withdrawn
            }
        }
        else if (target && target instanceof Resource) {
            const pickupResult = creep.pickup(target);
            if (pickupResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
            else if (pickupResult === OK) {
                delete creep.memory.goingFor; // Clear the goingFor memory once energy is picked up
            }
        }
        else {
            delete creep.memory.goingFor; // Clear the goingFor memory if the target is invalid or out of energy
        }
        return;
    }
    // If the creep doesn't have a target, find the closest energy source (storage or dropped energy)
    const nearbyStorage = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return ((structure.structureType === STRUCTURE_STORAGE ||
                structure.structureType === STRUCTURE_CONTAINER) &&
                structure.store[RESOURCE_ENERGY] > 0);
        }
    });
    if (nearbyStorage.length > 0) {
        const targetStorage = nearbyStorage[0];
        creep.memory.goingFor = targetStorage.id; // Store the target in memory
        const withdrawResult = creep.withdraw(targetStorage, RESOURCE_ENERGY);
        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(targetStorage, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
    }
    else {
        // If no nearby storage is available, attempt to find dropped energy on the ground
        const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY,
        });
        if (droppedEnergy) {
            creep.memory.goingFor = droppedEnergy.id; // Store the target in memory
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        }
        else {
            console.log(`Creep ${creep.name} has no energy and no nearby storage or dropped energy.`);
        }
    }
}
function runBuilder(creep) {
    if (!creep.memory.taskId) {
        // Assign a new task to the builder if it doesn't have one
        const task = findTaskForCreep(creep, 'build');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.id;
        }
        else {
            console.log(`No available build tasks for creep ${creep.name}`);
            return;
        }
    }
    const task = getTaskById(creep.memory.taskId);
    if (!task) {
        console.log(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    const target = Game.getObjectById(task.targetId);
    if (!target) {
        console.log(`Construction site with ID ${task.targetId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    // if creep has no energy, attempt to find from a nearby storage (link or container) if available
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep);
    }
    else {
        if (target instanceof ConstructionSite) {
            const buildResult = creep.build(target);
            if (buildResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
            else if (buildResult === OK) {
                // make sure the task is reserved for this creep while it's working on it
                task.assigned = creep.id;
            }
        }
        else if (target instanceof StructureController) {
            if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        }
    }
}

function getRoleNameCounter(roleName) {
    if (!Memory.counter) {
        Memory.counter = {};
    }
    const counterKey = `roleNameCounter_${roleName}`;
    if (!Memory.counter[counterKey]) {
        Memory.counter[counterKey] = 0;
    }
    const counterValue = Memory.counter[counterKey];
    Memory.counter[counterKey] += 1; // Increment the counter for the next call
    if (roleName === 'queen' && counterValue > 10) {
        Memory.counter[counterKey] = 0; // Reset the counter if it exceeds 10 for queens
    }
    if (counterValue > 100) {
        Memory.counter[counterKey] = 0; // Reset the counter if it exceeds 20
    }
    return counterValue;
}

// constructionPlanner.ts
const DEFAULT_MAX_SITES = 5;
const DEFAULT_PLACEMENTS_PER_RUN = 2;
const DEFAULT_INTERVAL = 25;
class ConstructionPlanner {
    static run(room) {
        var _a;
        if (!((_a = room.controller) === null || _a === void 0 ? void 0 : _a.my)) {
            return;
        }
        const memory = this.getMemory(room);
        if (!memory.enabled) {
            return;
        }
        // Visuals should run every tick because RoomVisual only lasts one tick.
        this.drawVisuals(room, memory.plan);
        this.createBuildTasks(room);
        if (Game.time - memory.lastRun < memory.interval) {
            return;
        }
        memory.lastRun = Game.time;
        this.placeConstructionSites(room, memory);
    }
    /**
     * Replace the current room blueprint.
     */
    static setPlan(room, plan) {
        const memory = this.getMemory(room);
        memory.plan = [...plan].sort((a, b) => a.priority - b.priority);
    }
    /**
     * Adds items without replacing the existing plan.
     */
    static addToPlan(room, items) {
        const memory = this.getMemory(room);
        const existing = new Set(memory.plan.map(item => this.getPositionKey(item)));
        for (const item of items) {
            const key = this.getPositionKey(item);
            if (!existing.has(key)) {
                memory.plan.push(item);
                existing.add(key);
            }
        }
        memory.plan.sort((a, b) => a.priority - b.priority);
    }
    static getMemory(room) {
        if (!room.memory.constructionPlanner) {
            room.memory.constructionPlanner = {
                enabled: true,
                maxSites: DEFAULT_MAX_SITES,
                placementsPerRun: DEFAULT_PLACEMENTS_PER_RUN,
                interval: DEFAULT_INTERVAL,
                lastRun: 0,
                plan: [],
            };
        }
        return room.memory.constructionPlanner;
    }
    static placeConstructionSites(room, memory) {
        var _a, _b;
        const roomSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        let availableSlots = Math.max(0, memory.maxSites - roomSites.length);
        if (availableSlots === 0) {
            return;
        }
        /*
         * Screeps also has an account-wide construction site limit.
         * Avoid issuing placement attempts once that global limit is reached.
         */
        const globalAvailable = Math.max(0, MAX_CONSTRUCTION_SITES -
            Object.keys(Game.constructionSites).length);
        availableSlots = Math.min(availableSlots, globalAvailable, memory.placementsPerRun);
        if (availableSlots === 0) {
            return;
        }
        const controllerLevel = (_b = (_a = room.controller) === null || _a === void 0 ? void 0 : _a.level) !== null && _b !== void 0 ? _b : 0;
        const candidates = memory.plan
            .filter(item => item.minRcl <= controllerLevel)
            .sort((a, b) => a.priority - b.priority);
        let placed = 0;
        for (const item of candidates) {
            if (placed >= availableSlots) {
                break;
            }
            const state = this.getItemState(room, item);
            if (state !== "planned") {
                continue;
            }
            const result = room.createConstructionSite(item.x, item.y, item.structureType);
            if (result === OK) {
                placed++;
                console.log(`[ConstructionPlanner] ${room.name}: ` +
                    `placed ${item.structureType} at ` +
                    `${item.x},${item.y}`);
            }
            else if (result !== ERR_INVALID_TARGET &&
                result !== ERR_RCL_NOT_ENOUGH) {
                console.warn(`[ConstructionPlanner] ${room.name}: ` +
                    `failed to place ${item.structureType} at ` +
                    `${item.x},${item.y}; result=${result}`);
            }
        }
    }
    /**
     * Creates build tasks for active construction sites.
     */
    static createBuildTasks(room) {
        const sites = room.find(FIND_MY_CONSTRUCTION_SITES);
        const existingTargets = new Set(Object.values(room.memory.tasks)
            .filter(task => task.type === "build")
            .map(task => task.targetId));
        for (const site of sites) {
            if (existingTargets.has(site.id)) {
                continue;
            }
            const taskId = `build:${room.name}:${site.id}`;
            room.memory.tasks[taskId] = {
                id: taskId,
                assigned: "",
                type: "build",
                targetId: site.id,
                priority: this.getBuildPriority(site),
            };
        }
        this.removeFinishedBuildTasks(room);
    }
    static removeFinishedBuildTasks(room) {
        for (const taskId in room.memory.tasks) {
            const task = room.memory.tasks[taskId];
            if (task.type !== "build") {
                continue;
            }
            const target = Game.getObjectById(task.targetId);
            if (!target) {
                delete room.memory.tasks[taskId];
            }
        }
    }
    static getBuildPriority(site) {
        switch (site.structureType) {
            case STRUCTURE_SPAWN:
                return 1;
            case STRUCTURE_EXTENSION:
                return 10;
            case STRUCTURE_TOWER:
                return 15;
            case STRUCTURE_STORAGE:
                return 20;
            case STRUCTURE_CONTAINER:
                return 25;
            case STRUCTURE_ROAD:
                return 50;
            case STRUCTURE_RAMPART:
            case STRUCTURE_WALL:
                return 75;
            default:
                return 40;
        }
    }
    static getItemState(room, item) {
        var _a, _b;
        if (!this.isInsideRoom(item.x, item.y)) {
            return "blocked";
        }
        if (((_b = (_a = room.controller) === null || _a === void 0 ? void 0 : _a.level) !== null && _b !== void 0 ? _b : 0) < item.minRcl) {
            return "unavailable";
        }
        const terrain = room.getTerrain().get(item.x, item.y);
        if (terrain === TERRAIN_MASK_WALL) {
            return "blocked";
        }
        const structures = room.lookForAt(LOOK_STRUCTURES, item.x, item.y);
        if (structures.some(structure => structure.structureType === item.structureType)) {
            return "complete";
        }
        if (structures.some(structure => !this.canShareTile(structure.structureType, item.structureType))) {
            return "blocked";
        }
        const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, item.x, item.y);
        if (sites.some(site => site.structureType === item.structureType)) {
            return "construction";
        }
        if (sites.length > 0) {
            return "blocked";
        }
        return "planned";
    }
    /**
     * Roads and ramparts may share tiles with many structures.
     */
    static canShareTile(existing, planned) {
        // Ramparts may occupy the same tile as another structure.
        if (existing === STRUCTURE_RAMPART ||
            planned === STRUCTURE_RAMPART) {
            return true;
        }
        // Containers and roads can share a tile.
        if ((existing === STRUCTURE_CONTAINER &&
            planned === STRUCTURE_ROAD) ||
            (existing === STRUCTURE_ROAD &&
                planned === STRUCTURE_CONTAINER)) {
            return true;
        }
        return false;
    }
    static drawVisuals(room, plan) {
        const visual = room.visual;
        let planned = 0;
        let constructing = 0;
        let complete = 0;
        let blocked = 0;
        for (const item of plan) {
            const state = this.getItemState(room, item);
            switch (state) {
                case "planned":
                    planned++;
                    visual.circle(item.x, item.y, {
                        radius: 0.38,
                        fill: "transparent",
                        stroke: "#00d8ff",
                        strokeWidth: 0.08,
                        opacity: 0.7,
                    });
                    visual.text(this.getStructureSymbol(item.structureType), item.x, item.y + 0.13, {
                        font: 0.45,
                        color: "#00d8ff",
                        opacity: 0.9,
                        align: "center",
                    });
                    break;
                case "construction": {
                    constructing++;
                    const site = room
                        .lookForAt(LOOK_CONSTRUCTION_SITES, item.x, item.y)
                        .find(value => value.structureType ===
                        item.structureType);
                    const progress = site
                        ? site.progress / site.progressTotal
                        : 0;
                    visual.circle(item.x, item.y, {
                        radius: 0.4,
                        fill: "#ffd166",
                        opacity: 0.18,
                        stroke: "#ffd166",
                        strokeWidth: 0.1,
                    });
                    visual.text(`${Math.floor(progress * 100)}%`, item.x, item.y + 0.12, {
                        font: 0.32,
                        color: "#ffffff",
                        align: "center",
                    });
                    break;
                }
                case "complete":
                    complete++;
                    break;
                case "blocked":
                    blocked++;
                    visual.line(item.x - 0.3, item.y - 0.3, item.x + 0.3, item.y + 0.3, {
                        color: "#ff4d6d",
                        width: 0.08,
                        opacity: 0.8,
                    });
                    visual.line(item.x + 0.3, item.y - 0.3, item.x - 0.3, item.y + 0.3, {
                        color: "#ff4d6d",
                        width: 0.08,
                        opacity: 0.8,
                    });
                    break;
            }
        }
        const activeSites = room.find(FIND_MY_CONSTRUCTION_SITES).length;
        visual.text(`Construction ${activeSites}/${this.getMemory(room).maxSites}`, 1, 1, {
            align: "left",
            font: 0.65,
            color: "#ffffff",
            backgroundColor: "#111111",
            backgroundPadding: 0.15,
            opacity: 0.9,
        });
        visual.text(`Queued: ${planned} | Building: ${constructing}`, 1, 1.8, {
            align: "left",
            font: 0.45,
            color: "#00d8ff",
            backgroundColor: "#111111",
            backgroundPadding: 0.1,
            opacity: 0.85,
        });
        if (blocked > 0) {
            visual.text(`Blocked: ${blocked} | Complete: ${complete}`, 1, 2.4, {
                align: "left",
                font: 0.42,
                color: "#ff4d6d",
                backgroundColor: "#111111",
                backgroundPadding: 0.1,
                opacity: 0.85,
            });
        }
    }
    static getStructureSymbol(structureType) {
        switch (structureType) {
            case STRUCTURE_SPAWN:
                return "S";
            case STRUCTURE_EXTENSION:
                return "E";
            case STRUCTURE_ROAD:
                return "·";
            case STRUCTURE_CONTAINER:
                return "C";
            case STRUCTURE_STORAGE:
                return "ST";
            case STRUCTURE_TOWER:
                return "T";
            case STRUCTURE_LINK:
                return "L";
            case STRUCTURE_LAB:
                return "B";
            case STRUCTURE_TERMINAL:
                return "TM";
            case STRUCTURE_RAMPART:
                return "R";
            case STRUCTURE_WALL:
                return "W";
            default:
                return "?";
        }
    }
    static getPositionKey(item) {
        return (`${item.x}:${item.y}:` +
            `${item.structureType}`);
    }
    static isInsideRoom(x, y) {
        /*
         * Avoid room exits. Building directly on exits is usually undesirable.
         */
        return x > 0 && x < 49 && y > 0 && y < 49;
    }
}

const EXTENSION_OFFSETS = [
    [-2, -2],
    [0, -2],
    [2, -2],
    [-2, 0],
    [2, 0],
    [-2, 2],
    [0, 2],
    [2, 2],
    [-3, -1],
    [-3, 1],
    [3, -1],
    [3, 1],
    [-1, -3],
    [1, -3],
    [-1, 3],
    [1, 3],
];
const ROAD_OFFSETS = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
    [-2, -1],
    [-2, 1],
    [2, -1],
    [2, 1],
    [-1, -2],
    [1, -2],
    [-1, 2],
    [1, 2],
];
function createBasicRoomPlan(room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) {
        return [];
    }
    const plan = [];
    let extensionPriority = 10;
    for (const [dx, dy] of EXTENSION_OFFSETS) {
        plan.push({
            x: spawn.pos.x + dx,
            y: spawn.pos.y + dy,
            structureType: STRUCTURE_EXTENSION,
            priority: extensionPriority++,
            minRcl: 2,
        });
    }
    let roadPriority = 100;
    for (const [dx, dy] of ROAD_OFFSETS) {
        plan.push({
            x: spawn.pos.x + dx,
            y: spawn.pos.y + dy,
            structureType: STRUCTURE_ROAD,
            priority: roadPriority++,
            minRcl: 2,
        });
    }
    // Early tower position.
    plan.push({
        x: spawn.pos.x,
        y: spawn.pos.y + 3,
        structureType: STRUCTURE_TOWER,
        priority: 30,
        minRcl: 3,
    });
    // Storage location.
    plan.push({
        x: spawn.pos.x,
        y: spawn.pos.y - 3,
        structureType: STRUCTURE_STORAGE,
        priority: 40,
        minRcl: 4,
    });
    return plan.filter(item => item.x > 0 &&
        item.x < 49 &&
        item.y > 0 &&
        item.y < 49);
}

/**
 * This module defines the behavior of the queen role in the game.
 * The queen is responsible for filling extensions and spawns with energy once the room reaches RCL 2.
 * The queen does not run on the task system, but instead has its own logic for managing energy distribution.
 *
 * The queen will prioritize filling extensions first, then spawns, and finally towers if they exist.
 */
function runQueen(creep) {
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep);
    }
    else {
        // the queen will also be responsible for ensuring the room controller does not downgrade
        if (creep.room.controller && creep.room.controller.ticksToDowngrade < 1000) {
            console.log(`Room ${creep.room.name} controller is about to downgrade. Prioritizing upgrading.`);
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
            return; // exit early to prioritize upgrading
        }
        // If the queen has energy, prioritize filling extensions first, then spawns, and finally towers if they exist
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return ((structure.structureType === STRUCTURE_EXTENSION ||
                    structure.structureType === STRUCTURE_SPAWN ||
                    structure.structureType === STRUCTURE_TOWER) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            }
        });
        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
                }
            }
        }
        else {
            console.log(`Creep ${creep.name} has energy but no valid targets to transfer to.`);
        }
    }
}

function scanRoom$1(room) {
    // scan the room for energy sources and update memory
    const energySources = room.find(FIND_SOURCES);
    const energySourceIds = energySources.map(source => source.id);
    const roomMemory = Memory.hive.rooms[room.name];
    if (roomMemory) {
        roomMemory.lastScan = Game.time;
        roomMemory.energySources = energySourceIds;
        // check if the room is hostile
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        roomMemory.hostile = hostileCreeps.length > 0;
        // check if the room has an owner
        const controller = room.controller;
        if (controller && controller.owner) {
            roomMemory.owner = controller.owner.username;
        }
        else {
            roomMemory.owner = null;
        }
    }
    else {
        console.log(`Room ${room.name} not found in hive memory. Initializing...`);
        Memory.hive.rooms[room.name] = {
            hostile: false,
            owner: null,
            lastScan: Game.time,
            energySources: energySourceIds,
            energyProfitability: 0,
            resourceType: null
        };
    }
}
/**
 * Hive acts as a hive mind, cordinating work between colonies.
 */
function runHive() {
    if (!Memory.hive) {
        Memory.hive = {
            rooms: {},
            scouts: {},
            lastScan: 0
        };
    }
    // only run the hive logic every 100 ticks
    if (Game.time - Memory.hive.lastScan > 100) {
        // update the hive last scan time
        Memory.hive.lastScan = Game.time;
        // scan all rooms in the game
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            // skip rooms that could be invalid
            if (!room)
                continue;
            if (!Memory.hive.rooms[roomName]) {
                Memory.hive.rooms[roomName] = {
                    hostile: false,
                    owner: null,
                    lastScan: 0,
                    energySources: [],
                    energyProfitability: 0,
                    resourceType: null
                };
                // get nearby rooms and add them to the hive memory
                const nearbyRooms = Game.map.describeExits(roomName);
                for (const direction in nearbyRooms) {
                    const nearbyRoomName = nearbyRooms[direction];
                    if (nearbyRoomName && !Memory.hive.rooms[nearbyRoomName]) {
                        Memory.hive.rooms[nearbyRoomName] = {
                            hostile: false,
                            owner: null,
                            lastScan: 0,
                            energySources: [],
                            energyProfitability: 0,
                            resourceType: null
                        };
                    }
                }
            }
        }
    }
    // rooms should be scanned every 100,000 ticks, so check if any rooms need to be scanned
    const roomsNeedingScan = Object.entries(Memory.hive.rooms).filter(([roomName, roomData]) => {
        return Game.time - roomData.lastScan > 100000;
    });
    if (roomsNeedingScan.length > 0 && Object.keys(Memory.hive.scouts).length === 0) {
        // No scouts available, create a new one by finding a free spawn in all of our owned rooms
        const ownedRooms = getOwnedRooms();
        let spawnFound = false;
        for (const room of ownedRooms) {
            const spawns = room.find(FIND_MY_SPAWNS).filter(spawn => !spawn.spawning && room.energyAvailable >= 100);
            if (spawns.length > 0) {
                const scoutCounter = getRoleNameCounter('scout');
                const spawn = spawns[0];
                const scoutName = `scout-${scoutCounter}`;
                const spawnResult = spawn.spawnCreep([MOVE], scoutName, {
                    memory: { role: 'scout', room: room.name },
                });
                if (spawnResult === OK) {
                    console.log(`Spawned new scout: ${scoutName} in room ${room.name}`);
                    Memory.hive.scouts[scoutName] = { assigned: roomsNeedingScan[0][0] }; // Assign the first room needing scan
                    spawnFound = true;
                    break;
                }
                else {
                    console.log(`Failed to spawn scout in room ${room.name}. Error code: ${spawnResult}`);
                }
            }
        }
        if (!spawnFound) {
            console.log('No available spawns to create a new scout.');
        }
    }
}

function runScout(creep) {
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
        }
        else {
            console.log(`No unscanned rooms available for scout ${creep.name}`);
            return;
        }
    }
    // if screep is not in the scanned room, move to the assigned room
    const assignedRoomName = Memory.hive.scouts[creep.name].assigned;
    if (creep.room.name !== assignedRoomName) {
        const exitDir = Game.map.findExit(creep.room.name, assignedRoomName);
        if (exitDir !== ERR_NO_PATH) {
            const exit = creep.pos.findClosestByRange(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
            }
        }
        else {
            console.log(`No path found for scout ${creep.name} to room ${assignedRoomName}`);
        }
    }
    else {
        scanRoom$1(creep.room);
        console.log(`Scout ${creep.name} has scanned room ${assignedRoomName}`);
        // After scanning, clear the assigned room so the scout can be reassigned
        Memory.hive.scouts[creep.name].assigned = undefined;
    }
}

// get owned rooms by controller ownership
function getOwnedRooms() {
    return Object.values(Game.rooms).filter(room => { var _a; return ((_a = room.controller) === null || _a === void 0 ? void 0 : _a.my) === true; });
}
// append more body parts depending on available energy and role
function getCreepBodyParts(room, role) {
    const baseBody = [WORK, CARRY, MOVE];
    const energyAvailable = room.energyAvailable;
    // Calculate how many additional parts can be added based on available energy
    let additionalPartsCount = Math.floor((energyAvailable - 200) / 100); // Each additional part costs 100 energy
    // Limit the number of additional parts to a maximum of 5 for now
    additionalPartsCount = Math.min(additionalPartsCount, 5);
    // Create an array of additional body parts based on the role
    const additionalParts = [];
    for (let i = 0; i < additionalPartsCount; i++) {
        if (role === 'harvester') {
            additionalParts.push(WORK);
        }
        else if (role === 'builder') {
            additionalParts.push(CARRY);
        }
        else if (role === 'queen') {
            additionalParts.push(CARRY, MOVE);
        }
    }
    return baseBody.concat(additionalParts);
}
// get the ideal number of creeps that should exist
function getIdealCreepCount(room) {
    const roomStructures = room.find(FIND_STRUCTURES);
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    const idealCounts = {
        harvester: { count: room.memory.energySources.length, priority: 1 },
        builder: { count: 1, priority: 2 },
        queen: { count: 0, priority: 0 }, // always have one queen
    };
    // if the room controller is below level 2 or we have no extensions, we don't need a queen yet
    if (room.controller && room.controller.level >= 2) {
        if (roomStructures.filter(structure => structure.structureType === STRUCTURE_EXTENSION).length > 0) {
            idealCounts.queen = { count: 1, priority: 0 };
        }
        if (constructionSites.length > 0) {
            idealCounts.builder.count = constructionSites.length + 1; // always have one extra builder
        }
    }
    // hard cap builders to 3 for now, can be adjusted later
    if (idealCounts.builder.count > 3) {
        idealCounts.builder = { count: 3, priority: 3 };
    }
    return idealCounts;
}
// monitor creeps count and log if any role is underrepresented
function monitorCreepRoles(room) {
    const idealCounts = getIdealCreepCount(room);
    const roleCounts = {};
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (creep.memory.role) {
            roleCounts[creep.memory.role] = (roleCounts[creep.memory.role] || 0) + 1;
        }
    }
    // reset the spawn queue for this room
    room.memory.spawnQueue = [];
    for (const role in idealCounts) {
        const idealCount = idealCounts[role];
        const actualCount = roleCounts[role] || 0;
        if (actualCount < idealCount.count) {
            console.log(`Room ${room.name} has ${actualCount} ${role}s, but ideally should have ${idealCount.count}. Adding to spawn queue.`);
            room.memory.spawnQueue.push({ role, priority: idealCount.priority });
        }
    }
    // if the spawn queue has roles, and the room has energy
    if (room.memory.spawnQueue.length > 0 && room.energyAvailable > 150) {
        // Sort the spawn queue by priority (lower number = higher priority)
        room.memory.spawnQueue.sort((a, b) => a.priority - b.priority);
        // Get the highest priority role to spawn
        const nextRoleToSpawn = room.memory.spawnQueue[0].role;
        // Log the spawning action
        console.log(`Spawning new creep with role: ${nextRoleToSpawn}`);
        // select all spawn structures in the room
        const spawns = room.find(FIND_MY_SPAWNS);
        // select the next available spawn (for simplicity, just take the first one)
        const spawn = spawns.length > 0 ? spawns[0] : null;
        if (spawn) {
            // Define a basic body for the new creep
            const body = getCreepBodyParts(room, nextRoleToSpawn);
            const roleCounter = getRoleNameCounter(nextRoleToSpawn);
            const creepName = `${nextRoleToSpawn}-${roleCounter}`;
            // Attempt to spawn the new creep
            const spawnResult = spawn.spawnCreep(body, creepName, {
                memory: { role: nextRoleToSpawn, room: room.name },
            });
            if (spawnResult === OK) {
                console.log(`Successfully spawned ${nextRoleToSpawn} creep.`);
            }
            else {
                console.log(`Failed to spawn ${nextRoleToSpawn} creep. Error code: ${spawnResult}`);
            }
        }
        else {
            console.log(`No available spawns in room ${room.name} to spawn new creeps.`);
        }
    }
}
// create a new task and add it to the room's memory
function createTask(room, type, targetId, priority) {
    const taskId = `${type}_${targetId}`;
    if (room.memory.tasks[taskId]) {
        return;
    }
    // Create a new task and add it to the room's memory
    room.memory.tasks[taskId] = {
        id: taskId,
        assigned: '',
        type,
        targetId,
        priority
    };
}
// scan a room for energy sources and update its memory
function scanRoom(room) {
    console.log(`Scanning room ${room.name}`);
    // Update the last scan time
    room.memory.lastScan = Game.time;
    // Ensure the tasks object exists in room memory
    if (!room.memory.tasks) {
        room.memory.tasks = {};
    }
    // Remove invalid tasks from the room's memory and check if assigned creep still exists
    for (const taskId in room.memory.tasks) {
        const task = room.memory.tasks[taskId];
        const target = Game.getObjectById(task.targetId);
        if (!target) {
            console.log(`Removing invalid task ${taskId} from room ${room.name}`);
            delete room.memory.tasks[taskId];
        }
        // Check if the assigned creep still exists
        if (task.assigned && !Game.creeps[task.assigned]) {
            console.log(`Assigned creep ${task.assigned} for task ${taskId} no longer exists. Unassigning task.`);
            task.assigned = '';
        }
    }
    // Scan for energy sources in the room
    const energySources = room.find(FIND_SOURCES);
    room.memory.energySources = energySources.map(source => source.id);
    // create a harvest task for each energy source
    for (const source of energySources) {
        createTask(room, 'harvest', source.id, 1);
    }
    // create a task for upgrading the controller if it exists
    if (room.controller) {
        createTask(room, 'build', room.controller.id, 3);
    }
    // if the controller level has changed, log it
    if (room.controller && room.controller.level !== room.memory.controllerLevel) {
        console.log(`Controller in room ${room.name} has leveled up from ${room.memory.controllerLevel} to ${room.controller.level}`);
    }
    // if the construction planner is enabled and there is no plan, create a basic plan
    if (room.memory.constructionPlanner && room.memory.constructionPlanner.plan.length === 0) {
        ConstructionPlanner.setPlan(room, createBasicRoomPlan(room));
    }
    // run the construction planner for the room
    ConstructionPlanner.run(room);
    // set the last known level of the controller in memory
    if (room.controller) {
        room.memory.controllerLevel = room.controller.level;
    }
    // create a build task for each construction site in the room
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    for (const site of constructionSites) {
        createTask(room, 'build', site.id, 1);
    }
    console.log(`Room ${room.name} scanned. Found ${energySources.length} energy sources.`);
}
function runCreeps(room) {
    const creepsInRoom = Object.values(Game.creeps).filter(creep => creep.memory.room === room.name);
    for (const creep of creepsInRoom) {
        switch (creep.memory.role) {
            case 'harvester':
                runHarvester(creep);
                break;
            case 'builder':
                runBuilder(creep);
                break;
            case 'queen':
                runQueen(creep);
                break;
            case 'scout':
                runScout(creep);
                break;
            default:
                console.log(`Creep ${creep.name} has an unknown role: ${creep.memory.role}`);
        }
    }
}
// run colony logic for a given room
function runColony(room) {
    console.log(`Running colony logic for room ${room.name}`);
    // Check if the room needs to be scanned
    if (room.memory.lastScan === undefined || Game.time - room.memory.lastScan > 100) {
        // scan the room
        scanRoom(room);
        // monitor the roles of creeps in the room
        monitorCreepRoles(room);
    }
    runCreeps(room);
}
// run logic for all owned rooms
function runRooms() {
    const rooms = getOwnedRooms();
    for (const room of rooms) {
        runColony(room);
    }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
const loop = () => {
    console.log(`Current game tick is ${Game.time}`);
    // run logic loop for each owned room
    runRooms();
    // run the hive logic to coordinate work between colonies
    runHive();
    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
        }
    }
};

exports.loop = loop;
//# sourceMappingURL=main.js.map
