/**
 * RoomContext is a per-tick view of useful room state. Expensive/static room
 * objects are cached in heap between ticks; volatile objects are refreshed.
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

export interface ContextCache {
    room: string;
    structures: string[];
    constructionSites: string[];
    sources: string[];
    myCreeps: string[];
}

export interface ContextCacheMap {
    [roomName: string]: {
        expires: number;
        sourceExpires: number;
        siteExpires: number;
        cache: ContextCache;
    };
}

export interface GlobalContext {
    [roomName: string]: RoomContext;
}

export const CONTEXT_CACHE: ContextCacheMap = {};
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
        (structuresByType[structure.structureType] ||= []).push(structure);

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
        (creepsByRole[creep.memory.role] ||= []).push(creep);
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
 * Builds a context for a room.
 *
 * Full contexts cache structures for 50 ticks and sources for 500 ticks. Those
 * objects rarely change, while creeps/hostiles/drops/ruins are intentionally
 * refreshed every tick. Construction sites refresh every 10 ticks.
 *
 * Lightweight contexts are used for incidental/scout/transit vision. They keep
 * only the data expansion/scout safety logic needs and avoid scanning/indexing
 * every structure in rooms where colony logic is not running.
 */
export function buildRoomContext(room: Room, lightweight: boolean = false): RoomContext {
    const myCreeps = room.find(FIND_MY_CREEPS);
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const resources = room.find(FIND_DROPPED_RESOURCES);
    const ruins = [...room.find(FIND_RUINS), ...room.find(FIND_TOMBSTONES)];

    if (lightweight) {
        const context = createIndexedContext(room, {
            myCreeps,
            hostiles,
            structures: [],
            constructionSites: room.find(FIND_CONSTRUCTION_SITES),
            sources: room.find(FIND_SOURCES),
            ruins,
            resources,
        });
        GLOBAL_CONTEXT[room.name] = context;
        return context;
    }

    let entry = CONTEXT_CACHE[room.name];
    const caching = Memory.cacheMode !== false;

    if (!entry || !caching) {
        const structures = room.find(FIND_STRUCTURES);
        const sources = room.find(FIND_SOURCES);
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

        entry = CONTEXT_CACHE[room.name] = {
            expires: Game.time + 50,
            sourceExpires: Game.time + 500,
            siteExpires: Game.time + 10,
            cache: {
                room: room.name,
                structures: structures.map(o => o.id),
                sources: sources.map(o => o.id),
                myCreeps: myCreeps.map(c => c.id),
                constructionSites: constructionSites.map(o => o.id),
            }
        };

        const context = createIndexedContext(room, {
            myCreeps,
            hostiles,
            structures,
            constructionSites,
            sources,
            ruins,
            resources,
        });
        GLOBAL_CONTEXT[room.name] = context;
        return context;
    }

    let structures: Structure[];
    let sources: Source[];
    let constructionSites: ConstructionSite[];

    if (entry.expires <= Game.time) {
        structures = room.find(FIND_STRUCTURES);
        entry.cache.structures = structures.map(o => o.id);
        entry.expires = Game.time + 50;
    } else {
        structures = resolveObjects<Structure>(entry.cache.structures);
    }

    if (entry.sourceExpires <= Game.time) {
        sources = room.find(FIND_SOURCES);
        entry.cache.sources = sources.map(o => o.id);
        entry.sourceExpires = Game.time + 500;
    } else {
        sources = resolveObjects<Source>(entry.cache.sources);
    }

    if (entry.siteExpires <= Game.time) {
        constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        entry.cache.constructionSites = constructionSites.map(o => o.id);
        entry.siteExpires = Game.time + 10;
    } else {
        constructionSites = resolveObjects<ConstructionSite>(entry.cache.constructionSites);
    }

    const context = createIndexedContext(room, {
        myCreeps,
        hostiles,
        structures,
        constructionSites,
        sources,
        ruins,
        resources,
    });

    GLOBAL_CONTEXT[room.name] = context;
    return context;
}
