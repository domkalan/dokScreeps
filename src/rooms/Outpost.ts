import { dokRoom, dokRoomType } from "./Room"

/**
 * dokOutpostRoom
 * An outpost room is a lightly defended room, usually for sending energy back to a main fortified room.
 * Operates similar to a puppet room, but contains its own spawner/extensions but will not expand past RCL 4.
 */
export class dokOutpostRoom extends dokRoom {
    public  override readonly roomType: dokRoomType = dokRoomType.Outpost;

    public DoConstructionPlanning(rcl : number | undefined): Array<{ type: StructureConstant, pos: RoomPosition }>  {
        return []
    }
}