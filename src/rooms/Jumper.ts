import { dokRoom, dokRoomType } from "./Room"

/**
 * dokJumperRoom
 * A lightweight room used for portal jumping and claim jumping.
 * 
 * Defense is light, extensions are light as this room is now intended to be a long term strategic base.
 */
export class dokJumperRoom extends dokRoom {
    public  override readonly roomType: dokRoomType = dokRoomType.Outpost;

    public DoConstructionPlanning(rcl : number | undefined): Array<{ type: StructureConstant, pos: RoomPosition }>  {
        return []
    }
}