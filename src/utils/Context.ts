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
    hostiles: Creep[];
    structures: Structure[];
    constructionSites: ConstructionSite[];
    sources: Source[];
    ruins: Array<Ruin | Tombstone>;
    spawns: StructureSpawn[];
    fillTargets: Array<
        StructureSpawn |
        StructureExtension |
        StructureTower
    >;
    resources: Array<Resource | Ruin | Tombstone>;
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
    fillTargets: string[];
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
const CONTEXT_CACHE: ContextCacheMap = {};

// allow easy access to the global context for each room
export const GLOBAL_CONTEXT: GlobalContext = {};

/**
 * Builds a context for the given room.
 * @param room The room to build the context for.
 * @returns The room context.
 */
export function buildRoomContext(room: Room): RoomContext {
    if (Memory.cacheMode && CONTEXT_CACHE[room.name] && CONTEXT_CACHE[room.name].expires > Game.time) {
        // If the context is cached and still valid, return the cached context

        return {
            room: room,
            myCreeps: CONTEXT_CACHE[room.name].cache.myCreeps.map(name => Game.creeps[name]).filter(creep => creep !== undefined) as Creep[],

            // always find hostiles in the room to ensure we have the most up-to-date information
            hostiles: room.find(FIND_HOSTILE_CREEPS),

            structures: CONTEXT_CACHE[room.name].cache.structures.map(id => Game.getObjectById(id)).filter(structure => structure !== undefined) as Structure[],
            constructionSites: CONTEXT_CACHE[room.name].cache.constructionSites.map(id => Game.getObjectById(id)).filter(site => site !== undefined) as ConstructionSite[],
            sources: CONTEXT_CACHE[room.name].cache.sources.map(id => Game.getObjectById(id)).filter(source => source !== undefined) as Source[],
            ruins: CONTEXT_CACHE[room.name].cache.ruins.map(id => Game.getObjectById(id)).filter(ruin => ruin !== undefined) as Array<Ruin | Tombstone>,
            spawns: CONTEXT_CACHE[room.name].cache.spawns.map(id => Game.getObjectById(id)).filter(spawn => spawn !== undefined) as StructureSpawn[],
            fillTargets: CONTEXT_CACHE[room.name].cache.fillTargets.map(id => Game.getObjectById(id)).filter(target => target !== undefined) as Array<StructureSpawn | StructureExtension | StructureTower>,
            resources: CONTEXT_CACHE[room.name].cache.resources.map(id => Game.getObjectById(id)).filter(resource => resource !== undefined) as Array<Resource | Ruin | Tombstone>,
        };
    }

    // otherwise, start building the context for this room
    const structures = room.find(FIND_STRUCTURES);

    // build the context object
    const context: RoomContext = {
        room,
        structures,
        constructionSites: room.find(FIND_CONSTRUCTION_SITES),
        sources: room.find(FIND_SOURCES),
        hostiles: room.find(FIND_HOSTILE_CREEPS),
        myCreeps: room.find(FIND_MY_CREEPS),
        ruins: [...room.find(FIND_RUINS), ...room.find(FIND_TOMBSTONES)],

        spawns: structures.filter(
            (structure): structure is StructureSpawn =>
                structure.structureType === STRUCTURE_SPAWN
        ),

        resources: [
            ...room.find(FIND_DROPPED_RESOURCES)
            // TODO: Consider adding ruins and tombstones if needed
        ],

        fillTargets: structures.filter(
            (
                structure
            ): structure is
                | StructureSpawn
                | StructureExtension
                | StructureTower => {
                if (
                    structure.structureType !== STRUCTURE_SPAWN &&
                    structure.structureType !== STRUCTURE_EXTENSION &&
                    structure.structureType !== STRUCTURE_TOWER
                ) {
                    return false;
                }

                return (
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                );
            }
        ),
    };

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
            fillTargets: context.fillTargets.map(target => target.id),
            resources: context.resources.map(resource => resource.id),
        }
    }

    // store the context in the global context for easy access
    GLOBAL_CONTEXT[room.name] = context;

    return context;
}