export interface RoomContext {
    room: Room;
    myCreeps: Creep[];
    hostiles: Creep[];
    structures: Structure[];
    constructionSites: ConstructionSite[];
    sources: Source[];
    spawns: StructureSpawn[];
    fillTargets: Array<
        StructureSpawn |
        StructureExtension |
        StructureTower
    >;
    resources: Array<Resource | Ruin | Tombstone>;
}

export function buildRoomContext(room: Room): RoomContext {
    const structures = room.find(FIND_STRUCTURES);

    return {
        room,
        structures,
        constructionSites: room.find(FIND_CONSTRUCTION_SITES),
        sources: room.find(FIND_SOURCES),
        hostiles: room.find(FIND_HOSTILE_CREEPS),
        myCreeps: room.find(FIND_MY_CREEPS),

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
}