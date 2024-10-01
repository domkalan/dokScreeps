export interface SlotsResult {
    pos: RoomPosition
    code: number
    object: null | Terrain | Structure | StructureConstant
}

/**
 * Static utility class to determine free slots on a room grid.
 */
export class Slots {
    public static GetFreeSlots(room : Room, object : Structure | Resource | { pos: RoomPosition }, area : number, structureArea: number = 0, ignore: Array<StructureConstant | Terrain> = []) : Array<SlotsResult> {
        // area of 1 is a 3x3 grid.
        const terrain = Game.map.getRoomTerrain(room.name)

        let openSpots: Array<SlotsResult> = []
        
        let x = 0 - area
        let y = 0 - area

        while (x <= area) {
            while (y <= area) {
                const roomPos = new RoomPosition(object.pos.x + x, object.pos.y + y, room.name);

                const terrainHit = terrain.get(object.pos.x + x, object.pos.y + y);

                switch(terrainHit) {
                    case TERRAIN_MASK_WALL:
                        if (ignore.includes('wall')) {
                            const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                            const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                    
                            if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType })
                            } else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType })
                            } else {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null })
                            }
                            
                            break;
                        }

                        openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: 'wall' })

                        break
                    case TERRAIN_MASK_SWAMP:
                        if (ignore.includes('swamp')) {
                            const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                            const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                    
                            if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType })
                            } else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType })
                            } else {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null })
                            }
                            
                            break;
                        }

                        openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: 'swamp' })

                        break
                    case 0:
                        const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                        const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                
                        if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType })
                        } else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType })
                        } else {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null })
                        }

                        break;
                    }
                y += 1
            }
            y = 0 - area
            x += 1
        }

        return openSpots
    }
}