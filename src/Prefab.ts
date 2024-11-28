import { Distance } from "./Distance";
import { dokRoom } from "./rooms/Room";

export class Prefab {
    public static RecenterPrefabAround(centerPos: RoomPosition, plans: { structureType: string; x: number; y: number; }[]) : { type: StructureConstant; pos: RoomPosition; }[] {
        return plans.map(i => {
            i.x = centerPos.x + i.x;
            i.y = centerPos.y + i.y;

            return { pos: new RoomPosition(i.x, i.y, centerPos.roomName), type: i.structureType as StructureConstant };
        }).sort((a, b) => Distance.GetDistance(a.pos, centerPos) - Distance.GetDistance(b.pos, centerPos));
    }

    public static FilterOutBuilt(plans: { type: StructureConstant; pos: RoomPosition; }[], structures : RoomObject[], terrain : RoomTerrain) : { type: StructureConstant; pos: RoomPosition; }[] {
        return plans.filter(i => {
            const existingObject = structures.find(ii => ii.pos.x === i.pos.x && ii.pos.y === i.pos.y);

            return typeof existingObject === 'undefined' && terrain.get(i.pos.x, i.pos.y) !== TERRAIN_MASK_WALL;
        })
    }
}