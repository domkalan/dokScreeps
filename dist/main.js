'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function getTaskById(roomName, taskId) {
    var _a, _b;
    return ((_b = (_a = Memory.rooms[roomName]) === null || _a === void 0 ? void 0 : _a.tasks) === null || _b === void 0 ? void 0 : _b[taskId]) || undefined;
}
function findTaskForCreep(creep, taskType) {
    const tasks = Memory.rooms[creep.memory.room].tasks;
    let best;
    for (const taskId in tasks) {
        const task = tasks[taskId];
        if (task.type !== taskType || task.assigned || task.completed)
            continue;
        if (!best || task.priority < best.priority) {
            best = task;
        }
    }
    return best;
}
function createTask(room, type, targetId, priority, roomId, action, expires) {
    // make sure tasks object exists in room memory
    if (!room.memory.tasks) {
        room.memory.tasks = {};
    }
    const taskId = `${type}-${targetId}`;
    if (room.memory.tasks[taskId]) {
        debugLog(`Task ${taskId} already exists in room ${room.name}, resetting expires and priority.`);
        room.memory.tasks[taskId].expires = expires !== undefined ? expires : Game.time + 1000;
        room.memory.tasks[taskId].priority = priority;
        return room.memory.tasks[taskId];
    }
    const task = {
        id: taskId,
        type,
        completed: false,
        priority,
        targetId,
        roomId: roomId || room.name,
        action,
        created: Game.time,
        expires: expires !== undefined ? expires : Game.time + 1000 // Example expiration time, adjust as needed
    };
    if (!room.memory.tasks) {
        room.memory.tasks = {};
    }
    room.memory.tasks[taskId] = task;
    return task;
}
function completeTask(creep) {
    var _a, _b;
    try {
        const taskId = creep.memory.taskId;
        if (!taskId)
            return;
        const task = (_b = (_a = Memory.rooms[creep.memory.room]) === null || _a === void 0 ? void 0 : _a.tasks) === null || _b === void 0 ? void 0 : _b[taskId];
        if (task) {
            delete Memory.rooms[creep.memory.room].tasks[taskId];
        }
        delete creep.memory.taskId;
    }
    catch (error) {
        debugLog(`Error setting a task completed for creep ${creep.name}: ${error}`);
    }
}
function releaseTask(creep) {
    if (!creep.memory.taskId)
        return;
    const task = creep.room.memory.tasks[creep.memory.taskId];
    if (task) {
        task.assigned = undefined; // Unassign the task
    }
    else {
        debugLog(`Task with ID ${creep.memory.taskId} not found in room ${creep.room.name}`);
    }
}
function monitorTasks(room) {
    const now = Game.time;
    for (const taskId in room.memory.tasks) {
        const task = room.memory.tasks[taskId];
        if (task.expires <= now) {
            debugLog(`Task ${taskId} has expired and will be deleted.`);
            delete room.memory.tasks[taskId];
        }
    }
    // Remove invalid tasks from the room's memory and check if assigned creep still exists
    for (const taskId in room.memory.tasks) {
        const task = room.memory.tasks[taskId];
        if (task.assigned && Game.creeps[task.assigned] === undefined) {
            debugLog(`Task ${taskId} was assigned to a non-existent creep ${task.assigned}. Unassigning.`);
            delete task.assigned;
        }
    }
}

function GetSlots(room, object, area, structureArea = 0, ignore = []) {
    // area of 1 is a 3x3 grid.
    const terrain = Game.map.getRoomTerrain(room.name);
    let openSpots = [];
    let x = 0 - area;
    let y = 0 - area;
    while (x <= area) {
        while (y <= area) {
            const roomPos = new RoomPosition(object.pos.x + x, object.pos.y + y, room.name);
            const terrainHit = terrain.get(object.pos.x + x, object.pos.y + y);
            switch (terrainHit) {
                case TERRAIN_MASK_WALL:
                    if (ignore.includes('wall')) {
                        const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                        const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                        if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType });
                        }
                        else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType });
                        }
                        else {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null });
                        }
                        break;
                    }
                    openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: 'wall' });
                    break;
                case TERRAIN_MASK_SWAMP:
                    if (ignore.includes('swamp')) {
                        const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                        const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                        if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType });
                        }
                        else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType });
                        }
                        else {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null });
                        }
                        break;
                    }
                    openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: 'swamp' });
                    break;
                case 0:
                    const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                    const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                    if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                        openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType });
                    }
                    else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                        openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType });
                    }
                    else {
                        openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null });
                    }
                    break;
            }
            y += 1;
        }
        y = 0 - area;
        x += 1;
    }
    return openSpots;
}

function goToRoom(creep, roomName) {
    const exitDir = Game.map.findExit(creep.room.name, roomName);
    if (exitDir !== ERR_NO_PATH) {
        const exit = creep.pos.findClosestByRange(exitDir);
        if (exit) {
            creep.moveTo(exit);
            return;
        }
    }
    debugLog(`Creep ${creep.name} cannot find exit to room ${roomName}`);
    creep.say(`❌ ${roomName}`);
}
function runHarvester(creep, context) {
    if (!creep.memory.taskId) {
        // Assign a new task to the harvester if it doesn't have one
        const task = findTaskForCreep(creep, 'harvest');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.name;
        }
        else {
            debugLog(`No available harvest tasks for creep ${creep.name}`);
            return;
        }
    }
    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    // check if harvest task is remote and if so, move to the room of the source
    if (task.roomId !== creep.room.name) {
        goToRoom(creep, task.roomId);
        return;
    }
    // Get the source object using the targetId from the task
    const source = Game.getObjectById(task.targetId);
    if (!source) {
        debugLog(`Source with ID ${task.targetId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    // if creep is full, attempt to build a container near the source
    if (creep.store.getFreeCapacity() === 0 || creep.memory.focusedOn === 'building') {
        const container = source.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (s) => s.structureType === STRUCTURE_CONTAINER
        })[0];
        if (!container) {
            // Attempt to build a container if one doesn't exist
            debugLog('No container found, attempting to build one.');
            const constructionSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 3, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            })[0];
            if (!constructionSite) {
                const bestSlot = GetSlots(creep.room, source, 3, 0, ['wall', 'swamp']).find(slot => slot.code === 1);
                if (!bestSlot) {
                    debugLog(`No suitable slot found for container near source ${source.id}`);
                    return;
                }
                creep.room.createConstructionSite(bestSlot.pos.x, bestSlot.pos.y, STRUCTURE_CONTAINER);
                debugLog(`Creep ${creep.name} is building a container at source ${source.id}`);
                return;
            }
            const buildResult = creep.build(constructionSite);
            // If a construction site exists, move to it and build
            if (buildResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSite);
            }
            else if (buildResult === OK) {
                creep.memory.focusedOn = 'building'; // Mark that the creep is focused on building
            }
            else if (buildResult === ERR_NOT_ENOUGH_RESOURCES) {
                delete creep.memory.focusedOn; // Clear the focusedOn memory if not enough resources
            }
            return;
        }
        // ensure the container remains at a healthy hit level
        if (container.hits < container.hitsMax * 0.5) {
            const repairResult = creep.repair(container);
            creep.memory.focusedOn = 'building'; // Mark that the creep is focused on repairing
            if (repairResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(container);
                return;
            }
            else if (repairResult === ERR_NOT_ENOUGH_RESOURCES) {
                delete creep.memory.focusedOn; // Clear the focusedOn memory if not enough resources
            }
        }
        // get the room room reference for the creep's home room
        const homeRoom = Game.rooms[creep.memory.room];
        // Attempt to transfer energy to the container
        const transferResult = creep.transfer(container, RESOURCE_ENERGY);
        // If a container exists, transfer energy to it
        if (transferResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(container);
            return;
        }
        else if (transferResult === ERR_FULL) {
            creep.drop(RESOURCE_ENERGY); // Drop energy if the container is full
            // add a hauler task to the home room if the creep is not in the home room
            if (homeRoom && creep.memory.room !== creep.room.name) {
                // also add a task for the filled container
                createTask(homeRoom, 'haul', container.id, 1, creep.room.name);
                // do a one time scan to see if we have dropped resources for the id
                const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
                    filter: (r) => r.resourceType === RESOURCE_ENERGY && r.pos.isNearTo(container)
                });
                if (droppedResources.length > 0 && droppedResources[0].amount > 50) {
                    // Add a hauler task to the home room
                    createTask(homeRoom, 'haul', droppedResources[0].id, 0, creep.room.name);
                    creep.say(`🛻 ⚡ 🗑️`);
                }
            }
            return;
        }
        // get the amount of energy stored in the container
        const containerStored = container.store.getUsedCapacity(RESOURCE_ENERGY);
        // If the container is 25% full, we can consider it full enough for now to add a hauler task
        if (containerStored >= container.store.getCapacity(RESOURCE_ENERGY) * 0.25) {
            debugLog(`Container at source ${source.id} is at or above 25% full.`);
            if (homeRoom && creep.memory.room !== creep.room.name) {
                // Add a hauler task to the home room
                createTask(homeRoom, 'haul', container.id, 1, creep.room.name);
                creep.say(`🛻 ⚡`);
            }
        }
    }
    // If the creep is not in range to harvest, move towards the source
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
    }
}

// if no other work exists, haulers will go to the room controller and upgrade it
function upgradeRoomController(creep, context) {
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep, context);
        return;
    }
    if (creep.upgradeController(context.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(context.room.controller, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
    }
}
// the queen is a basic task, but responsible for ensuring extensions are maintained
function runQueen(creep, context) {
    // the queen needs energy to run, so if it has no energy, it will go get some
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep, context);
        return;
    }
    // if the queen is not in the room it is assigned to, it will go to that room
    if (creep.room.name !== creep.memory.room) {
        goToRoom(creep, creep.memory.room);
        return;
    }
    // the focused target
    let target = null;
    if (creep.memory.focusedOn) {
        target = Game.getObjectById(creep.memory.focusedOn);
    }
    if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        // get all the extensions in the room that are not full
        const extensions = context.structures.filter(structure => {
            return (structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_SPAWN) &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        });
        // if there are no extensions that need energy, the queen will go to the controller and upgrade it
        if (extensions.length === 0) {
            upgradeRoomController(creep, context);
            return;
        }
        target = extensions[0];
        creep.memory.focusedOn = target.id; // Store the target in memory
    }
    if (target && (target.structureType === STRUCTURE_EXTENSION || target.structureType === STRUCTURE_SPAWN)) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
    }
    else {
        delete creep.memory.focusedOn; // Clear the invalid target from memory
    }
}

function goForEnergy(creep, context) {
    let target = null;
    if (creep.memory.focusedOn) {
        target = Game.getObjectById(creep.memory.focusedOn);
    }
    if (!target || (target instanceof Structure && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
        // Find the closest storage, container, or dropped resource with energy
        const possibleTargets = [...context.resources, ...context.structures].filter(resource => {
            return ((resource instanceof Resource && resource.resourceType === RESOURCE_ENERGY) ||
                (resource instanceof StructureStorage && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ||
                (resource instanceof StructureContainer && resource.store.getUsedCapacity(RESOURCE_ENERGY) > 0));
            // sort, dropped resources first, then storage, then containers
        }).sort((a, b) => {
            if (a instanceof Resource && b instanceof Resource) {
                return 0; // Both are dropped resources, no change in order
            }
            else if (a instanceof Resource) {
                return -1; // a is a dropped resource, it should come first
            }
            else if (b instanceof Resource) {
                return 1; // b is a dropped resource, it should come first
            }
            else if (a instanceof StructureStorage && b instanceof StructureStorage) {
                return 0; // Both are storage, no change in order
            }
            else if (a instanceof StructureStorage) {
                return -1; // a is storage, it should come before containers
            }
            else if (b instanceof StructureStorage) {
                return 1; // b is storage, it should come before containers
            }
            else {
                return 0; // Both are containers, no change in order
            }
        });
        if (possibleTargets.length === 0) {
            debugLog(`No available energy sources for creep ${creep.name}`);
            creep.say('⚡ ❌');
            return;
        }
        target = creep.pos.findClosestByPath(possibleTargets);
        creep.memory.focusedOn = target === null || target === void 0 ? void 0 : target.id; // Store the target in memory
    }
    if (target instanceof Resource) {
        const pickupResult = creep.pickup(target);
        if (pickupResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
        }
        else if (pickupResult === OK) {
            debugLog(`Creep ${creep.name} picked up energy from dropped resource ${target.id}`);
            delete creep.memory.focusedOn; // Clear the focused target after picking up
        }
        return;
    }
    else if (target instanceof StructureStorage || target instanceof StructureContainer) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' }, reusePath: 50 });
        }
        else if (withdrawResult === OK) {
            debugLog(`Creep ${creep.name} withdrew energy from ${target.structureType} ${target.id}`);
            delete creep.memory.focusedOn; // Clear the focused target after withdrawing
        }
        return;
    }
    else {
        debugLog(`Creep ${creep.name} has an invalid target for energy: ${target}`);
        delete creep.memory.focusedOn; // Clear the invalid target from memory
    }
    debugLog(`Creep ${creep.name} could not find any energy sources to withdraw from.`);
    creep.say('🤷 ⚡');
}
function runBuilder(creep, context) {
    // if creep has no energy, attempt to find from a nearby storage (link or container) if available
    if (creep.store[RESOURCE_ENERGY] === 0) {
        if (creep.memory.taskId) {
            releaseTask(creep); // Release the task if the creep has no energy
            delete creep.memory.taskId; // Clear the task ID from memory
        }
        goForEnergy(creep, context); // Attempt to get energy from nearby storage or dropped energy
        return;
    }
    if (!creep.memory.taskId) {
        // Assign a new task to the builder if it doesn't have one
        const task = findTaskForCreep(creep, 'build');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.name;
        }
        else {
            debugLog(`No available build tasks for creep ${creep.name}`);
            runQueen(creep, context); // Attempt to upgrade the controller if no build tasks are available
            return;
        }
    }
    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    if (!task) {
        debugLog(`Task with ID ${creep.memory.taskId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    const target = Game.getObjectById(task.targetId);
    if (!target) {
        debugLog(`Construction site with ID ${task.targetId} not found for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    if (target instanceof ConstructionSite) {
        // if the build target is a rampart, we want to have full energy
        if (target.structureType === STRUCTURE_RAMPART && creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity(RESOURCE_ENERGY)) {
            debugLog(`Creep ${creep.name} is building a rampart but does not have full energy. Going to get more energy.`);
            goForEnergy(creep, context);
            return;
        }
        // fire the build action
        const buildResult = creep.build(target);
        if (buildResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
        else if (buildResult === OK) {
            // if the build is successful and the structure is a rampart, instantly begin repairing it to full health
            if (target.structureType === STRUCTURE_RAMPART) {
                completeTask(creep);
                const repairTask = createTask(creep.room, 'build', target.id, 0); // Create a repair task for the rampart
                creep.memory.taskId = repairTask.id; // Assign the new repair task to the creep
            }
        }
    }
    else if (target instanceof StructureController) {
        if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
    }
    else if (target instanceof Structure) {
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
        if (target.hits >= target.hitsMax) {
            debugLog(`Creep ${creep.name} has finished repairing structure ${target.id}.`);
            delete creep.memory.taskId; // Clear the task ID after finishing the repair
            delete creep.room.memory.tasks[task.id]; // Remove the task from room memory
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

function scanRoom$1(room, creep) {
    creep.say(`📸`);
    debugLog(`Scanning room ${room.name} for energy sources and other information.`);
    // scan the room for energy sources and update memory
    const energySources = room.find(FIND_SOURCES);
    const energySourceIds = energySources.map(source => source.id);
    // if the room if not far away from an existing room, lets add it as additional energy
    // source to be mined by a remote miner
    const nearbyRooms = Game.map.describeExits(room.name);
    const ownedRooms = getOwnedRooms();
    const nearbyOwnedRoom = Object.values(nearbyRooms || {}).find(nearbyRoomName => {
        return ownedRooms.some(ownedRoom => ownedRoom.name === nearbyRoomName);
    });
    if (nearbyOwnedRoom && nearbyOwnedRoom !== room.name) {
        debugLog(`Room ${room.name} is near owned room ${nearbyOwnedRoom}. Adding energy sources to hive memory.`);
        if (!Memory.rooms[nearbyOwnedRoom].remoteEnergySources) {
            Memory.rooms[nearbyOwnedRoom].remoteEnergySources = {};
        }
        for (const sourceId of energySourceIds) {
            debugLog(`Adding energy source ${sourceId} from room ${room.name} to remoteEnergySources of room ${nearbyOwnedRoom}.`);
            Memory.rooms[nearbyOwnedRoom].remoteEnergySources[sourceId] = {
                room: room.name,
                id: sourceId
            };
        }
    }
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
        debugLog(`Room ${room.name} not found in hive memory. Initializing...`);
        Memory.hive.rooms[room.name] = {
            hostile: false,
            owner: null,
            lastScan: Game.time,
            energySources: energySourceIds,
            energyProfitability: 0,
            resourceType: null
        };
    }
    // get nearby rooms and add them to the hive memory
    for (const direction in nearbyRooms) {
        const nearbyRoomName = nearbyRooms[direction];
        const roomDistanceFromHome = Game.map.getRoomLinearDistance(room.name, creep.memory.room);
        if (nearbyRoomName && !Memory.hive.rooms[nearbyRoomName] && roomDistanceFromHome <= 4) {
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
                        debugLog(`Spawned new scout: ${scoutName} in room ${room.name}`);
                        Memory.hive.scouts[scoutName] = { assigned: roomsNeedingScan[0][0] }; // Assign the first room needing scan
                        spawnFound = true;
                        break;
                    }
                    else {
                        debugLog(`Failed to spawn scout in room ${room.name}. Error code: ${spawnResult}`);
                    }
                }
            }
            if (!spawnFound) {
                debugLog('No available spawns to create a new scout.');
            }
        }
    }
}

function runScout(creep, context) {
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
        }
        else {
            debugLog(`No unscanned rooms available for scout ${creep.name}`);
            return;
        }
    }
    if (!creep.memory.inRoom || creep.memory.inRoom !== creep.room.name) {
        scanRoom$1(creep.room, creep);
        creep.memory.inRoom = creep.room.name;
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
            debugLog(`No path found for scout ${creep.name} to room ${assignedRoomName}`);
        }
    }
    else if (creep.room.name === assignedRoomName) {
        scanRoom$1(creep.room, creep);
        debugLog(`Scout ${creep.name} has scanned room ${assignedRoomName}`);
        // After scanning, clear the assigned room so the scout can be reassigned
        Memory.hive.scouts[creep.name].assigned = undefined;
    }
}

function depositInventory(creep, context) {
    let target = null;
    if (creep.memory.focusedOn) {
        debugLog(`Creep ${creep.name} is focused on ${creep.memory.focusedOn}`);
        target = Game.getObjectById(creep.memory.focusedOn);
    }
    if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        // Find the closest storage or container with free capacity
        const possibleTargets = context.structures.filter(structure => {
            return (structure.structureType === STRUCTURE_STORAGE || structure.structureType === STRUCTURE_CONTAINER);
        });
        const targets = possibleTargets.filter(structure => {
            return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        });
        if (targets.length === 0) {
            debugLog(`No available storage or container to deposit energy for creep ${creep.name}`);
            // if no storage hauler will go near controller and drop energy
            if (!creep.pos.isNearTo(possibleTargets[0])) {
                creep.moveTo(possibleTargets[0], { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
                return;
            }
            creep.drop(RESOURCE_ENERGY);
            return;
        }
        target = targets[0];
        creep.memory.focusedOn = target === null || target === void 0 ? void 0 : target.id; // Store the target in memory
    }
    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
    }
}
function runFill(creep, context) {
    // ensure task remains valid
    if (!creep.memory.taskId) {
        debugLog(`Creep ${creep.name} has no valid task ID for filling.`);
        return;
    }
    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    // ensure task is still valid and of type 'fill'
    if (!task || task.type !== 'fill') {
        debugLog(`Task with ID ${creep.memory.taskId} not found or is not a fill task for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    if (creep.store[RESOURCE_ENERGY] === 0) {
        debugLog(`Creep ${creep.name} has no energy to fill structures.`);
        goForEnergy(creep, context); // Attempt to get energy from nearby storage or dropped energy
        return;
    }
    // get the target
    const target = Game.getObjectById(task === null || task === void 0 ? void 0 : task.targetId);
    // if target is invalid or full, clear the focusedOn memory and return
    if (!target) {
        delete creep.memory.focusedOn; // Clear the focusedOn memory if the target is invalid or full
        debugLog(`Creep ${creep.name} has no valid fill target.`);
        return;
    }
    const transferResult = creep.transfer(target, RESOURCE_ENERGY);
    if (transferResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
    }
    else if (transferResult === OK) {
        delete creep.memory.focusedOn; // Clear the focusedOn memory once energy is transferred
        debugLog(`Creep ${creep.name} successfully filled ${target.structureType} (${target.id}).`);
        completeTask(creep); // Mark the task as complete after successfully filling the target
    }
    else {
        debugLog(`Creep ${creep.name} failed to fill ${target.structureType} (${target.id}) with error code: ${transferResult}`);
    }
}
function runHaul(creep, context) {
    // ensure task remains valid
    if (!creep.memory.taskId) {
        debugLog(`Creep ${creep.name} has no valid task ID for hauling.`);
        return;
    }
    const task = getTaskById(creep.memory.room, creep.memory.taskId);
    // ensure task is still valid and of type 'haul'
    if (!task || task.type !== 'haul') {
        debugLog(`Task with ID ${creep.memory.taskId} not found or is not a haul task for creep ${creep.name}`);
        delete creep.memory.taskId; // Clear the invalid task ID
        return;
    }
    // get the target
    const target = Game.getObjectById(task === null || task === void 0 ? void 0 : task.targetId);
    // if target is invalid or empty, clear the focusedOn memory and return
    if (!target || (target instanceof Resource && target.amount === 0)) {
        delete creep.memory.focusedOn; // Clear the focusedOn memory if the target is invalid or empty
        debugLog(`Creep ${creep.name} has no valid haul target.`);
        return;
    }
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        debugLog(`Creep ${creep.name} has no free capacity to haul energy.`);
        depositInventory(creep, context); // Attempt to deposit energy into storage or container
        return;
    }
    if (target instanceof Ruin || target instanceof Tombstone || target instanceof StructureContainer || target instanceof StructureStorage) {
        const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
        if (withdrawResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
        else if (withdrawResult === OK) {
            delete creep.memory.focusedOn; // Clear the focusedOn memory once energy is withdrawn
            debugLog(`Creep ${creep.name} successfully hauled energy from ${target instanceof Resource ? 'Resource' : target instanceof Ruin ? 'Ruin' : 'Tombstone'} (${target.id}).`);
            completeTask(creep); // Mark the task as complete after successfully hauling energy
        }
        else {
            debugLog(`Creep ${creep.name} failed to haul energy from ${target instanceof Resource ? 'Resource' : target instanceof Ruin ? 'Ruin' : 'Tombstone'} (${target.id}) with error code: ${withdrawResult}`);
        }
    }
    else if (target instanceof Resource) {
        const pickupResult = creep.pickup(target);
        if (pickupResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' }, reusePath: 50 });
        }
        else if (pickupResult === OK) {
            delete creep.memory.focusedOn; // Clear the focusedOn memory once energy is picked up
            debugLog(`Creep ${creep.name} successfully hauled energy from Resource (${target.id}).`);
            completeTask(creep); // Mark the task as complete after successfully hauling energy
        }
        else {
            debugLog(`Creep ${creep.name} failed to haul energy from Resource (${target.id}) with error code: ${pickupResult}`);
        }
    }
}
// hauler main loop
function runHauler(creep, context) {
    // get the current task
    let currentTask = creep.memory.taskId ? getTaskById(creep.memory.room, creep.memory.taskId) : null;
    // if no task attempt to assign a new task
    if (!currentTask) {
        const task = findTaskForCreep(creep, 'haul') || findTaskForCreep(creep, 'fill');
        if (task) {
            creep.memory.taskId = task.id;
            task.assigned = creep.name;
            currentTask = task;
        }
        else {
            debugLog(`No available haul or fill tasks for creep ${creep.name}`);
            runQueen(creep, context); // Attempt to upgrade the controller if no haul or fill tasks are available
            return;
        }
    }
    // if the creep is on a filling task, branch
    if (currentTask && currentTask.type === 'fill') {
        runFill(creep, context);
        return;
    }
    // if the creep is on a hauling task, branch
    if (currentTask && currentTask.type === 'haul') {
        runHaul(creep, context);
        return;
    }
}

/**
 * The defender is tasked with protecting the room from hostile creeps.
 * It will prioritize attacking hostile creeps that are in the room, and will also assist in defending structures if necessary.
 *
 * The defender does not use the task system, but instead has its own logic for managing combat.
 */
function runDefender(creep, context) {
    var _a;
    // find hostile creeps in the room
    const hostiles = context.hostiles;
    if (hostiles.length > 0) {
        // prioritize attacking the closest hostile creep
        const target = creep.pos.findClosestByRange(hostiles);
        if (target) {
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' }, reusePath: 50 });
            }
        }
    }
    else {
        // if there are no hostiles, move to a defensive position near the room controller or spawn
        const defensivePosition = creep.room.controller || ((_a = context.structures.find(structure => structure.structureType === STRUCTURE_SPAWN)) === null || _a === void 0 ? void 0 : _a.pos);
        if (defensivePosition) {
            creep.moveTo(defensivePosition, { visualizePathStyle: { stroke: '#00ff00' }, reusePath: 50 });
        }
    }
}

// constructionPlanner.ts
const DEFAULT_MAX_SITES = 5;
const DEFAULT_PLACEMENTS_PER_RUN = 2;
const DEFAULT_INTERVAL = 25;
class ConstructionPlanner {
    static run(room, context) {
        var _a;
        if (!((_a = room.controller) === null || _a === void 0 ? void 0 : _a.my)) {
            return;
        }
        const memory = this.getMemory(room);
        if (!memory.enabled) {
            return;
        }
        // Visuals should run every tick because RoomVisual only lasts one tick.
        this.drawVisuals(room, memory.plan, context);
        this.createBuildTasks(room, context);
        if (Game.time - memory.lastRun < memory.interval) {
            return;
        }
        memory.lastRun = Game.time;
        this.placeConstructionSites(room, memory, context);
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
    static placeConstructionSites(room, memory, context) {
        var _a, _b;
        const roomSites = context.constructionSites;
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
                debugLog(`[ConstructionPlanner] ${room.name}: ` +
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
    static createBuildTasks(room, context) {
        const sites = context.constructionSites;
        const existingTargets = new Set(Object.values(room.memory.tasks)
            .filter(task => task.type === "build")
            .map(task => task.targetId));
        for (const site of sites) {
            if (existingTargets.has(site.id)) {
                continue;
            }
            const taskId = `build_${site.id}`;
            room.memory.tasks[taskId] = {
                id: taskId,
                assigned: "",
                type: "build",
                targetId: site.id,
                priority: this.getBuildPriority(site),
                completed: false,
                roomId: room.name,
                created: Game.time,
                expires: Game.time + 1000, // Example expiration time, adjust as needed
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
    static drawVisuals(room, plan, context) {
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
        const activeSites = context.constructionSites.length;
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

function buildRoomContext(room) {
    const structures = room.find(FIND_STRUCTURES);
    return {
        room,
        structures,
        constructionSites: room.find(FIND_CONSTRUCTION_SITES),
        sources: room.find(FIND_SOURCES),
        hostiles: room.find(FIND_HOSTILE_CREEPS),
        myCreeps: room.find(FIND_MY_CREEPS),
        spawns: structures.filter((structure) => structure.structureType === STRUCTURE_SPAWN),
        resources: [
            ...room.find(FIND_DROPPED_RESOURCES)
            // TODO: Consider adding ruins and tombstones if needed
        ],
        fillTargets: structures.filter((structure) => {
            if (structure.structureType !== STRUCTURE_SPAWN &&
                structure.structureType !== STRUCTURE_EXTENSION &&
                structure.structureType !== STRUCTURE_TOWER) {
                return false;
            }
            return (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
        }),
    };
}

// get owned rooms by controller ownership
function getOwnedRooms() {
    return Object.values(Game.rooms).filter(room => { var _a; return ((_a = room.controller) === null || _a === void 0 ? void 0 : _a.my) === true; });
}
// append more body parts depending on available energy and role
function getCreepBodyParts(room, role) {
    let baseBody = [WORK, CARRY, MOVE];
    const energyAvailable = room.energyAvailable;
    // if defender, we need a different base body
    if (role === 'defender') {
        baseBody = [ATTACK, MOVE, MOVE];
    }
    else if (role === 'claimer') {
        baseBody = [CLAIM, MOVE];
    }
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
        else if (role === 'defender') {
            additionalParts.push(ATTACK);
        }
        else if (role === 'hauler') {
            additionalParts.push(CARRY);
        }
    }
    return baseBody.concat(additionalParts);
}
// get the ideal number of creeps that should exist
function getIdealCreepCount(room, context, roleCounts) {
    var _a;
    const roomControlLevel = ((_a = context.room.controller) === null || _a === void 0 ? void 0 : _a.level) || 0;
    const haulerJobs = Object.values(room.memory.tasks).filter(task => task.type === 'haul' && !task.assigned && !task.completed);
    const builderJobs = Object.values(room.memory.tasks).filter(task => task.type === 'build' && !task.assigned && !task.completed);
    const idealCounts = {
        harvester: { count: room.memory.energySources.length, priority: 0 },
        builder: { count: 1, priority: 5 },
        queen: { count: 1, priority: 2.5 },
        hauler: { count: 1, priority: 5 },
        claimer: { count: 0, priority: 10 }, // only spawn a claimer if we have a claim task, medium priority
    };
    if ((builderJobs.length / 2) > roleCounts.builder) {
        idealCounts.builder.count = Math.ceil(builderJobs.length / 2) + 1;
        idealCounts.builder.priority = 2.5; // if we have build tasks, increase the priority of builders
        // hard cap the number of builders to 4 for now
        idealCounts.builder.count = Math.min(idealCounts.builder.count, roomControlLevel + 1);
    }
    // remote harvester spawning
    if (roleCounts.harvester && roleCounts.harvester >= room.memory.energySources.length) {
        idealCounts.harvester.count = Object.keys(room.memory.remoteEnergySources || {}).length + 1;
        idealCounts.harvester.priority = 5; // if we have enough haulers, lower the priority
    }
    // 2 tasks per hauler, if we have more than 2 tasks per hauler, increase the priority of haulers
    if (haulerJobs.length / 2 > idealCounts.hauler.count) {
        idealCounts.hauler.count = Math.ceil(haulerJobs.length / 2);
        idealCounts.hauler.priority = 5; // if we have enough hauler jobs, increase the priority
    }
    if (room.energyAvailable >= 650) {
        const roomsToClaim = Object.values(room.memory.tasks).filter(task => task.type === 'claim' || task.type === 'reserve');
        if (roomsToClaim.length > 0) {
            idealCounts.claimer.count = roomsToClaim.length;
            idealCounts.claimer.priority = 5; // if we have rooms to claim, increase the priority of claimers
        }
    }
    return idealCounts;
}
// monitor creeps count and log if any role is underrepresented
function monitorCreepRoles(room, context) {
    const roleCounts = {};
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (creep.memory.room !== room.name) {
            continue;
        }
        if (creep.ticksToLive && creep.ticksToLive < 50) {
            debugLog(`Creep ${creep.name} is about to die.`);
            continue; // skip counting this creep if it's about to die
        }
        if (creep.memory.role) {
            roleCounts[creep.memory.role] = (roleCounts[creep.memory.role] || 0) + 1;
        }
    }
    const idealCounts = getIdealCreepCount(room, context, roleCounts);
    // reset the spawn queue for this room
    room.memory.spawnQueue = [];
    for (const role in idealCounts) {
        const idealCount = idealCounts[role];
        const actualCount = roleCounts[role] || 0;
        if (actualCount < idealCount.count) {
            debugLog(`Room ${room.name} has ${actualCount} ${role}s, but ideally should have ${idealCount.count}. Adding to spawn queue.`);
            room.memory.spawnQueue.push({ role, priority: idealCount.priority });
        }
    }
    // if the spawn queue has roles, and the room has energy
    if (room.memory.spawnQueue.length > 0 && room.energyAvailable > 150) {
        // Sort the spawn queue by priority (lower number = higher priority)
        room.memory.spawnQueue.sort((a, b) => a.priority - b.priority);
        // Get the highest priority role to spawn
        const nextRoleToSpawn = room.memory.spawnQueue[0].role;
        spawnCreep(room, nextRoleToSpawn, context);
    }
}
// spawn a creep for a given role in a room
function spawnCreep(room, role, context) {
    // Log the spawning action
    debugLog(`Spawning new creep with role: ${role}`);
    const spawns = context.structures.filter(structure => structure.structureType === STRUCTURE_SPAWN);
    // select the next available spawn (for simplicity, just take the first one)
    const spawn = spawns.length > 0 ? spawns[0] : null;
    if (spawn) {
        // Define a basic body for the new creep
        const body = getCreepBodyParts(room, role);
        const roleCounter = getRoleNameCounter(role);
        const creepName = `${role}-${roleCounter}`;
        // Attempt to spawn the new creep
        const spawnResult = spawn.spawnCreep(body, creepName, {
            memory: { role, room: room.name },
        });
        if (spawnResult === OK) {
            debugLog(`Successfully spawned ${role} creep.`);
        }
        else {
            debugLog(`Failed to spawn ${role} creep. Error code: ${spawnResult}`);
        }
    }
    else {
        debugLog(`No available spawns in room ${room.name} to spawn new creeps.`);
    }
}
// scan a room for energy sources and update its memory
function scanRoom(room, context) {
    debugLog(`Scanning room ${room.name}`);
    // Update the last scan time
    room.memory.lastScan = Game.time;
    // Scan for energy sources in the room
    room.memory.energySources = context.sources.map(source => source.id);
    // create a harvest task for each energy source
    for (const source of context.sources) {
        createTask(room, 'harvest', source.id, 1);
    }
    // process any nearby remote energy sources and create tasks for them if they are not already in memory
    for (const source in room.memory.remoteEnergySources) {
        const remoteSource = room.memory.remoteEnergySources[source];
        createTask(room, 'harvest', source, 10, remoteSource.room); // low priority for remote harvesting
    }
    // create a task for upgrading the controller if it exists
    if (room.controller && room.controller.my) {
        if (room.controller.ticksToDowngrade < 5000) {
            debugLog(`Controller in room ${room.name} is close to downgrading. Creating upgrade task.`);
            createTask(room, 'build', room.controller.id, 0); // high priority for upgrading the controller
        }
    }
    // if the controller level has changed, log it
    if (room.controller && room.controller.level !== room.memory.controllerLevel) {
        debugLog(`Controller in room ${room.name} has leveled up from ${room.memory.controllerLevel} to ${room.controller.level}`);
    }
    // if the construction planner is enabled and there is no plan, create a basic plan
    if (room.memory.constructionPlanner && room.memory.constructionPlanner.plan.length === 0) {
        ConstructionPlanner.setPlan(room, createBasicRoomPlan(room));
    }
    // run the construction planner for the room
    // TODO: make this return a list of tasks to create
    ConstructionPlanner.run(room, context);
    // review structures that are low on health and create a build task to repair
    const structuresToRepair = context.structures.filter(structure => {
        return ((structure.hits < structure.hitsMax * 0.5) && // less than 50% health
            (structure.structureType !== STRUCTURE_WALL && structure.structureType !== STRUCTURE_RAMPART) // ignore walls and ramparts for now
        );
    });
    for (const structure of structuresToRepair) {
        createTask(room, 'build', structure.id, 1); // high priority for repairing structures
    }
    // review walls and ramparts that are low on health and create a build task to repair
    const wallsToRepair = context.structures.filter(structure => {
        var _a;
        return ((structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) &&
            (structure.hits < (((_a = room.controller) === null || _a === void 0 ? void 0 : _a.level) || 0) * 10000) // less than RCL * 10k health
        );
    }).sort((a, b) => a.hits - b.hits); // sort by lowest health first
    for (const wall of wallsToRepair) {
        createTask(room, 'build', wall.id, wall.hits < 1000 ? 0 : 5, undefined, undefined, 110); // high priority for repairing walls and ramparts
    }
    const roadsToRepair = context.structures.filter(structure => {
        return (structure.structureType === STRUCTURE_ROAD &&
            structure.hits < structure.hitsMax * 0.5 // less than 50% health
        );
    });
    for (const road of roadsToRepair) {
        createTask(room, 'build', road.id, 10, undefined, undefined, 110); // medium priority for repairing roads
    }
    debugLog(`Room ${room.name} scanned. Found ${context.sources.length} energy sources.`);
}
function runCreeps(room, context) {
    var _a, _b;
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.memory.room !== room.name) {
            continue;
        }
        // check creep position
        if (creep.pos.x != ((_a = creep.memory.atLocation) === null || _a === void 0 ? void 0 : _a.x) || creep.pos.y !== ((_b = creep.memory.atLocation) === null || _b === void 0 ? void 0 : _b.y)) {
            creep.memory.atLocation = { x: creep.pos.x, y: creep.pos.y };
            creep.memory.atLocationFor = Game.time;
        }
        else if (creep.memory._move) {
            const stallTime = Game.time - (creep.memory.atLocationFor || 0);
            // if the creep has been at the same location for more than 10 ticks, move it randomly
            if (stallTime >= 5 && stallTime < 10 && creep.fatigue === 0) {
                // delete cached path to force recalculation
                delete creep.memory._move;
                if (stallTime > 5) {
                    creep.say(`🐢 ${stallTime - 5}`);
                }
            }
            else if (stallTime >= 10 && creep.fatigue === 0) {
                creep.say(`💀`);
            }
        }
        // run the appropriate role logic for the creep
        switch (creep.memory.role) {
            case 'harvester':
                runHarvester(creep);
                break;
            case 'builder':
                runBuilder(creep, context);
                break;
            case 'queen':
                runQueen(creep, context);
                break;
            case 'scout':
                runScout(creep);
                break;
            case 'hauler':
                runHauler(creep, context);
                break;
            case 'defender':
                runDefender(creep, context);
                break;
            default:
                debugLog(`Creep ${creep.name} has an unknown role: ${creep.memory.role}`);
        }
    }
}
function resetRoom(room) {
    if (!room.memory) {
        room.memory = {
            tasks: {},
            lastScan: 0,
            energySources: [],
            controllerLevel: 0,
            spawnQueue: [],
            defenseMode: false,
        };
    }
    room.memory.tasks = {};
    room.memory.lastScan = 0;
    room.memory.defenseMode = false;
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.memory.room === room.name) {
            creep.memory.taskId = undefined;
        }
    }
    debugLog(`Room ${room.name} has been reset.`);
}
// defense mode override for a room if hostiles are detected
function runColonyDefense(room, context) {
    // get total length of defenders from context
    const defenders = context.myCreeps.filter(creep => creep.memory.role === 'defender');
    const hostiles = context.hostiles;
    debugLog(`Hostiles detected in room ${room.name}: ${hostiles.map(h => h.name).join(', ')}`);
    // set room to defense mode
    if (!room.memory.defenseMode) {
        room.memory.defenseMode = true;
        room.memory.defenseModeActivatedAt = Game.time;
        debugLog(`Room ${room.name} is now in defense mode.`);
    }
    const structures = room.find(FIND_STRUCTURES);
    const sources = room.find(FIND_SOURCES);
    // if we have no defenders, queue a defender to be spawned
    if (defenders.length < (hostiles.length + 2)) { // add a buffer of 2 to ensure we have enough defenders
        debugLog(`No defenders present in room ${room.name}. Queuing a defender to be spawned.`);
        spawnCreep(room, 'defender', context);
    }
    const structuresToFill = structures.filter(structure => {
        return ((structure.structureType === STRUCTURE_EXTENSION ||
            structure.structureType === STRUCTURE_SPAWN ||
            structure.structureType === STRUCTURE_TOWER) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    });
    for (const structure of structuresToFill) {
        createTask(room, 'fill', structure.id, 5); // medium priority for filling structures
    }
    // have harvesters continue to harvest
    for (const source of sources) {
        createTask(room, 'harvest', source.id, 1); // high priority for harvesting
    }
    // switch roles in defense mode, all creeps that are not defenders will act as haulers to fill structures with energy
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        if (creep.memory.room !== room.name) {
            continue;
        }
        switch (creep.memory.role) {
            case 'harvester':
                runHarvester(creep);
                break;
            case 'defender':
                runDefender(creep, context);
                break;
            default:
                runHauler(creep, context); // all other creeps will act as haulers to fill structures with energy
        }
    }
}
// run colony logic for a given room
function runColony(room) {
    debugLog(`Running colony logic for room ${room.name}`);
    // monitor tasks for the room
    monitorTasks(room);
    // get room context
    const context = buildRoomContext(room);
    // if we have hostiles, the room goes into defensive mode and we need to spawn defenders if we don't have enough
    if (context.hostiles.length > 0 || room.memory.defenseMode === true && room.memory.defenseModeActivatedAt && Game.time - room.memory.defenseModeActivatedAt < 100) {
        runColonyDefense(room, context);
        return;
    }
    else if (context.hostiles.length === 0 && room.memory.defenseMode) {
        debugLog(`Room ${room.name} is no longer under threat. Exiting defense mode.`);
        resetRoom(room);
        return;
    }
    // Check if the room needs to be scanned
    if (room.memory.lastScan === undefined || Game.time - room.memory.lastScan > 100) {
        // scan the room
        scanRoom(room, context);
    }
    // monitor the roles of creeps in the room
    monitorCreepRoles(room, context);
    // run all creeps
    runCreeps(room, context);
}
// run logic for all owned rooms
function runRooms() {
    const rooms = getOwnedRooms();
    for (const room of rooms) {
        runColony(room);
    }
}

function addCliFunctions() {
    global.resetScoutData = function () {
        if (Memory.hive) {
            Memory.hive.rooms = {};
            Memory.hive.scouts = {};
            Memory.hive.lastScan = 0;
            // kill all current scout creeps
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep.memory.role === 'scout') {
                    creep.suicide();
                }
            }
            for (const roomName in Memory.rooms) {
                Memory.rooms[roomName].remoteEnergySources = {};
            }
            debugLog('All scout data has been reset.');
        }
        else {
            debugLog('No scout data found to reset.');
        }
    };
    global.resetScoutTimerFor = function (roomName) {
        if (Memory.hive && Memory.hive.rooms[roomName]) {
            Memory.hive.rooms[roomName].lastScan = 0;
            debugLog(`Scout data for room ${roomName} has been reset.`);
        }
        else {
            debugLog(`No scout data found for room ${roomName} to reset.`);
        }
    };
    global.resetRoomTasks = function (roomName) {
        const room = Game.rooms[roomName];
        if (room) {
            resetRoom(room);
        }
        else {
            debugLog(`No room found with name ${roomName}.`);
        }
    };
    global.setDebug = function (value) {
        Memory.debugMode = value;
    };
}

/**
 * Draws on screen debug information for the colony.
 */
function drawDebugInfo() {
    for (const roomName in Game.rooms) {
        let textOffset = 0;
        const room = Game.rooms[roomName];
        // display the cpu bucket and cpu usage
        room.visual.text(`CPU: ${Game.cpu.getUsed().toFixed(2)}/${Game.cpu.limit}/${Game.cpu.bucket}`, 0, textOffset, { align: 'left', font: 0.5 });
        textOffset += 0.5;
        const hiveScan = (Game.time - Memory.hive.lastScan) - 100;
        // draw the next time the hive will scan
        room.visual.text(`Hive (next hive scan t${hiveScan})`, 0, textOffset, { align: 'left', font: 0.5 });
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
        }
        else if (roomData.lastScan > 0 && scanAge < 10000 && roomData.hostile) {
            Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, { fill: '#ffff00', stroke: '#ffff00', opacity: 0.5, lineStyle: 'dashed' });
        }
        else if (roomData.lastScan > 0 && scanAge > 10000) {
            Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, { fill: '#ff7300', stroke: '#ff7300', opacity: 0.5, lineStyle: 'dashed' });
        }
        else {
            Game.map.visual.rect(new RoomPosition(0, 0, roomName), 50, 50, { fill: '#ff0000', stroke: '#ff0000', opacity: 0.5, lineStyle: 'dashed' });
        }
    }
}

// Attach the debugLog function to the global object for easy access in the console
global.debugLog = function (message) {
    if (Memory.debugMode) {
        debugLog(`[DEBUG] ${message}`);
    }
};
// attach cli functions to the global object for easy access in the console
addCliFunctions();
console.log(`Screeps bot initialized. Current game tick is ${Game.time}`);
// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
const loop = () => {
    debugLog(`Current game tick is ${Game.time}`);
    // run logic loop for each owned room
    runRooms();
    // run the hive logic to coordinate work between colonies
    runHive();
    // draw debug information on the screen for each room
    drawDebugInfo();
    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
        if (!(name in Game.creeps)) {
            delete Memory.creeps[name];
        }
    }
    // Generate a pixel for when the bucket is at 10000 and the pixel generation cooldown is 0
    if (Game.cpu.bucket >= 10000 && Game.cpu.generatePixel() === OK) {
        console.log('Generated a pixel!');
    }
};

exports.loop = loop;
//# sourceMappingURL=main.js.map
