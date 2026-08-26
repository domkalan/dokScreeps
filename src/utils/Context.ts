/**
 * RoomContext is a representation of the current state of a room in the game. It contains information about the room's structures, creeps, resources, and other relevant data that can be used for decision-making and task assignment.
 * The RoomContext is built and updated each tick using the buildRoomContext function, which gathers all relevant information about the room and its entities. The context can be accessed using GLOBAL_CONTEXT[roomName], where roomName is the name of the room you want to access.
 * Example usage:
 * const roomContext = GLOBAL_CONTEXT['W8N3'];
 * console.log(roomContext.myCreeps.length); // Outputs the number of my creeps in room W8N3
 */
export interface RoomContext {
    room: Room;
    myCreeps: Creep[];
    creepsByRole: { [role: string]: Creep[] };
    injuredCreeps: Creep[];
    hostiles: Creep[];
    structures: Structure[];
    structuresByType: { [structureType: string]: Structure[] };
    constructionSites: ConstructionSite[];
    sources: Source[];
    ruins: Array<Ruin | Tombstone>;
    spawns: StructureSpawn[];
    extensions: StructureExtension[];
    towers: StructureTower[];
    links: StructureLink[];
    containers: StructureContainer[];
    storages: StructureStorage[];
    portals: StructurePortal[];
    spawnEnergyReceivers: Array<StructureSpawn | StructureExtension>;
    energyReceivers: Array<StructureSpawn | StructureExtension | StructureTower>;
    energyStores: Array<StructureStorage | StructureContainer>;
    defenseStructures: Array<StructureWall | StructureRampart | StructureRoad>;
    regularRepairTargets: Structure[];
    towerRepairTargets: Structure[];
    storedEnergy: number;
    resources: Resource[];
}

/**
 * ContextCache is a cached representation of the RoomContext for a specific room. It stores the IDs of various entities in the room, such as creeps, structures, and resources, to avoid recalculating the context every tick. The cache has an expiration time to ensure that it is updated periodically.
 * The ContextCache is used to improve performance by reducing the number of expensive find operations in the game. Instead of querying the game state every tick, the cached data can be used to quickly access information about the room's entities.
 * The cache is built and updated each tick using the buildRoomContext function, which gathers all relevant information about the room and its entities. The cache can be accessed using CONTEXT_CACHE[roomName], where roomName is the name of the room you want to access.
 * Example usage:
 * const roomContextCache = CONTEXT_CACHE['W8N3'];
 * console.log(roomContextCache.myCreeps.length); // Outputs the number of my creeps in room W8N3
 */
export interface ContextCache {
    room: string;
    myCreeps: string[];
    hostiles: string[];
    structures: string[];
    constructionSites: string[];
    sources: string[];
    ruins: string[];
    spawns: string[];
    resources: string[];
}

/**
 * ContextCacheMap is a mapping of room names to their corresponding ContextCache objects. It allows for easy access to the cached context of each room in the game.
 * The cache includes information about the room's structures, creeps, resources, and other relevant data that can be used for decision-making and task assignment.
 * This global context cache is built and updated each tick, and can be cached for performance optimization.
 * The context cache is built using the buildRoomContext function, which gathers all relevant information about the room and its entities.
 * The context cache can be accessed using CONTEXT_CACHE[roomName], where roomName is the name of the room you want to access.
 * Example usage:
 * const roomContextCache = CONTEXT_CACHE['W8N3'];
 * console.log(roomContextCache.myCreeps.length); // Outputs the number of my creeps in room W8N3
 */
export interface ContextCacheMap {
    [roomName: string]: {
        expires: number;
        cache: ContextCache;
    };
}

/**
 * GlobalContext is a mapping of room names to their corresponding RoomContext objects. It allows for easy access to the context of each room in the game.
 * The context includes information about the room's structures, creeps, resources, and other relevant data that can be used for decision-making and task assignment.
 * This global context is built and updated each tick, and can be cached for performance optimization.
 * The context is built using the buildRoomContext function, which gathers all relevant information about the room and its entities.
 * The context can be accessed using GLOBAL_CONTEXT[roomName], where roomName is the name of the room you want to access.
 * Example usage:
 * const roomContext = GLOBAL_CONTEXT['W8N3'];
 * console.log(roomContext.myCreeps.length); // Outputs the number of my creeps in room W8N3
 */
export interface GlobalContext {
    [roomName: string]: RoomContext;
}


// create a cache for room contexts to avoid recalculating them every tick
export const CONTEXT_CACHE: ContextCacheMap = {};

// allow easy access to the global context for each room
export const GLOBAL_CONTEXT: GlobalContext = {};

interface ContextObjects {
    myCreeps: Creep[];
    hostiles: Creep[];
    structures: Structure[];
    constructionSites: ConstructionSite[];
    sources: Source[];
    ruins: Array<Ruin | Tombstone>;
    resources: Resource[];
}

function resolveObjects<T extends RoomObject>(ids: string[]): T[] {
    const objects: T[] = [];

    for (const id of ids) {
        const object = Game.getObjectById(id as Id<any>) as T | null;
        if (object) objects.push(object);
    }

    return objects;
}

function createIndexedContext(room: Room, objects: ContextObjects): RoomContext {
    const structuresByType: { [structureType: string]: Structure[] } = {};
    const spawns: StructureSpawn[] = [];
    const extensions: StructureExtension[] = [];
    const towers: StructureTower[] = [];
    const links: StructureLink[] = [];
    const containers: StructureContainer[] = [];
    const storages: StructureStorage[] = [];
    const portals: StructurePortal[] = [];
    const spawnEnergyReceivers: Array<StructureSpawn | StructureExtension> = [];
    const energyReceivers: Array<StructureSpawn | StructureExtension | StructureTower> = [];
    const energyStores: Array<StructureStorage | StructureContainer> = [];
    const defenseStructures: Array<StructureWall | StructureRampart | StructureRoad> = [];
    const regularRepairTargets: Structure[] = [];
    const towerRepairTargets: Structure[] = [];
    let storedEnergy = 0;

    for (const structure of objects.structures) {
        if (!structuresByType[structure.structureType]) structuresByType[structure.structureType] = [];
        structuresByType[structure.structureType].push(structure);

        switch (structure.structureType) {
            case STRUCTURE_SPAWN:
                spawns.push(structure as StructureSpawn);
                spawnEnergyReceivers.push(structure as StructureSpawn);
                energyReceivers.push(structure as StructureSpawn);
                break;
            case STRUCTURE_EXTENSION:
                extensions.push(structure as StructureExtension);
                spawnEnergyReceivers.push(structure as StructureExtension);
                energyReceivers.push(structure as StructureExtension);
                break;
            case STRUCTURE_TOWER:
                towers.push(structure as StructureTower);
                energyReceivers.push(structure as StructureTower);
                break;
            case STRUCTURE_LINK:
                links.push(structure as StructureLink);
                break;
            case STRUCTURE_CONTAINER: {
                const container = structure as StructureContainer;
                containers.push(container);
                energyStores.push(container);
                storedEnergy += container.store.getUsedCapacity(RESOURCE_ENERGY);
                break;
            }
            case STRUCTURE_STORAGE: {
                const storage = structure as StructureStorage;
                storages.push(storage);
                energyStores.push(storage);
                storedEnergy += storage.store.getUsedCapacity(RESOURCE_ENERGY);
                break;
            }
            case STRUCTURE_PORTAL:
                portals.push(structure as StructurePortal);
                break;
        }

        const isDefense = structure.structureType === STRUCTURE_WALL ||
            structure.structureType === STRUCTURE_RAMPART ||
            structure.structureType === STRUCTURE_ROAD;

        if (isDefense) {
            defenseStructures.push(structure as StructureWall | StructureRampart | StructureRoad);
            if (structure.hits < structure.hitsMax * 0.25) towerRepairTargets.push(structure);
        } else if (structure.hits < structure.hitsMax * 0.5) {
            regularRepairTargets.push(structure);
            towerRepairTargets.push(structure);
        }
    }

    const creepsByRole: { [role: string]: Creep[] } = {};
    const injuredCreeps: Creep[] = [];
    for (const creep of objects.myCreeps) {
        if (!creepsByRole[creep.memory.role]) creepsByRole[creep.memory.role] = [];
        creepsByRole[creep.memory.role].push(creep);
        if (creep.hits < creep.hitsMax) injuredCreeps.push(creep);
    }

    return {
        room,
        ...objects,
        creepsByRole,
        injuredCreeps,
        structuresByType,
        spawns,
        extensions,
        towers,
        links,
        containers,
        storages,
        portals,
        spawnEnergyReceivers,
        energyReceivers,
        energyStores,
        defenseStructures,
        regularRepairTargets,
        towerRepairTargets,
        storedEnergy,
    };
}

/**
 * Builds a context for the given room.
 * @param room The room to build the context for.
 * @returns The room context.
 */
export function buildRoomContext(room: Room): RoomContext {
    if (Memory.cacheMode && CONTEXT_CACHE[room.name] && CONTEXT_CACHE[room.name].expires > Game.time) {
        const cache = CONTEXT_CACHE[room.name].cache;
        const myCreeps: Creep[] = [];
        for (const name of cache.myCreeps) {
            const creep = Game.creeps[name];
            if (creep) myCreeps.push(creep);
        }

        const context = createIndexedContext(room, {
            myCreeps,
            hostiles: room.find(FIND_HOSTILE_CREEPS),
            structures: resolveObjects<Structure>(cache.structures),
            constructionSites: resolveObjects<ConstructionSite>(cache.constructionSites),
            sources: resolveObjects<Source>(cache.sources),
            ruins: resolveObjects<Ruin | Tombstone>(cache.ruins),
            resources: resolveObjects<Resource>(cache.resources),
        });

        GLOBAL_CONTEXT[room.name] = context;
        return context;
    }

    // otherwise, start building the context for this room
    const structures = room.find(FIND_STRUCTURES);

    const context = createIndexedContext(room, {
        myCreeps: room.find(FIND_MY_CREEPS),
        hostiles: room.find(FIND_HOSTILE_CREEPS),
        structures,
        constructionSites: room.find(FIND_CONSTRUCTION_SITES),
        sources: room.find(FIND_SOURCES),
        ruins: [...room.find(FIND_RUINS), ...room.find(FIND_TOMBSTONES)],
        resources: room.find(FIND_DROPPED_RESOURCES),
    });

    // store the context in the cache with an expiration time of 10 ticks
    CONTEXT_CACHE[room.name] = {
        expires: Game.time + 10,
        cache: {
            room: room.name,
            myCreeps: context.myCreeps.map(creep => creep.name),
            hostiles: context.hostiles.map(creep => creep.id),
            structures: context.structures.map(structure => structure.id),
            constructionSites: context.constructionSites.map(site => site.id),
            sources: context.sources.map(source => source.id),
            ruins: context.ruins.map(ruin => ruin.id),
            spawns: context.spawns.map(spawn => spawn.id),
            resources: context.resources.map(resource => resource.id),
        }
    }

    // store the context in the global context for easy access
    GLOBAL_CONTEXT[room.name] = context;

    return context;
}
