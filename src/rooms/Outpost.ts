import { dokRoom, dokRoomType } from "./Room"

export class dokOutpostRoom extends dokRoom {
    public  override readonly roomType: dokRoomType = dokRoomType.Outpost;

    public DoConstructionPlanning(rcl : number | undefined): Array<{ type: StructureConstant, pos: RoomPosition }>  {
        return []
    }
}