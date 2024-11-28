import { dokRoom, dokRoomType } from "./Room"

/**
 * dokCustomRoom
 * A custom room with no construction planning, all construction will be done with yourself.
 */
export class dokCustomRoom extends dokRoom {
    public  override readonly roomType: dokRoomType = dokRoomType.Custom;

    public override DoConstructionTick(): void {
        
    }
}