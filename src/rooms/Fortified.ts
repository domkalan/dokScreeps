import { dokRoom } from "./Room"

/**
 * dokFortifiedRoomA
 * A full featured room layout that with full base design, with fortification first.
 */
export class dokFortifiedRoom extends dokRoom {
    public DoConstructionPlanning(rcl : number | undefined): Array<{ type: StructureConstant, pos: RoomPosition }>  {
        return []
    }
}