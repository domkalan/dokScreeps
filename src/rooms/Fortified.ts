import { dokRoom } from "./Room"

export class dokFortifiedRoom extends dokRoom {
    public DoConstructionPlanning(rcl : number | undefined): Array<{ type: StructureConstant, pos: RoomPosition }>  {
        return []
    }
}