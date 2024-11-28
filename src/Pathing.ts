import { dokRoomMemory } from "./rooms/Room";

export class Pathing {
    public static GetRoomsToAvoid() {
        const roomValues: { [roomName: string] : boolean} = {};

        for(const roomName in Memory.rooms) {
            roomValues[roomName] = (Memory.rooms[roomName] as dokRoomMemory).avoid || false;
        }
    }
}