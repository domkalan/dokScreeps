import { Distance } from "./Distance";
import { dokScreeps } from "./dokScreeps";
import { RoomState } from "./rooms/Room";

export class dokFlag {
    public name: string;
    public room: string;
    public assignedRoom: string | null = null;
    
    public flagRef: Flag;

    // TODO: implement every tick flag logic, useful for debug visual drawing
    public runEveryTick: boolean = false;

    constructor(flag : Flag) {
        this.name = flag.name;
        this.room = flag.pos.roomName;

        this.flagRef = flag;
    }

    public AssignFlagRoom(dokScreeps: dokScreeps) {
        if (this.flagRef === null)
            return;

        // settler flags
        if (this.flagRef.color === COLOR_PURPLE) {
            const ownedRooms = dokScreeps.GetRooms().filter(i => i.state === RoomState.Controlled);

            const sameRoom = ownedRooms.find(i => i.roomRef.name === this.flagRef?.pos.roomName);

            if (typeof sameRoom !== 'undefined') {
                this.assignedRoom = sameRoom.roomRef.name;

                // do this for debugging purpose
                (this.flagRef.memory as any).assignedRoom = sameRoom.roomRef.name;

                return;
            }

            const closerRooms = ownedRooms.sort((a, b) => Game.map.getRoomLinearDistance(a.name, this.room) - Game.map.getRoomLinearDistance(b.name, this.room));

            this.assignedRoom = closerRooms[0].name;

            // do this for debugging purpose
            (this.flagRef.memory as any).assignedRoom = closerRooms[0].name;

            return;
        }

        this.assignedRoom = '*';

        // do this for debugging purpose
        (this.flagRef.memory as any).assignedRoom = '*';
    }

    public DoFlagLogic(dokScreeps: dokScreeps) {
        if (this.flagRef === null)
            return;

        if (this.assignedRoom === null) {
            this.AssignFlagRoom(dokScreeps);
        }
    }
}