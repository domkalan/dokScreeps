import { Distance } from "./Distance";
import { dokScreeps } from "./dokScreeps";
import { Logger } from "./Logger";
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
            this.AssignByDistance(dokScreeps);

            return;
        }

        // remote miner flags
        if (this.flagRef.color === COLOR_ORANGE) {
            this.AssignByDistance(dokScreeps);

            return;
        }

        if (this.flagRef.color === COLOR_RED && this.flagRef.secondaryColor === COLOR_RED) {
            this.AssignByDistance(dokScreeps);

            return;
        }

        this.assignedRoom = '*';

        // do this for debugging purpose
        (this.flagRef.memory as any).assignedRoom = '*';

        Logger.Log(`Flag:${this.flagRef.name}`, `Flag registered with assignedRoom *`);
    }

    public AssignByDistance(dokScreeps: dokScreeps) {
        const ownedRooms = dokScreeps.GetRooms().filter(i => i.state === RoomState.Controlled);

        const sameRoom = ownedRooms.find(i => i.roomRef.name === this.flagRef?.pos.roomName);

        if (typeof sameRoom !== 'undefined') {
            this.assignedRoom = sameRoom.roomRef.name;

            // do this for debugging purpose
            (this.flagRef.memory as any).assignedRoom = sameRoom.roomRef.name;

            return;
        }

        const closerRooms = ownedRooms.filter(i => (i.roomRef.controller?.level || 1) >= 3).sort((a, b) => Game.map.getRoomLinearDistance(a.name, this.room) - Game.map.getRoomLinearDistance(b.name, this.room));

        this.assignedRoom = closerRooms[0].name;

        // do this for debugging purpose
        (this.flagRef.memory as any).assignedRoom = closerRooms[0].name;

        Logger.Log(`Flag:${this.flagRef.name}`, `Flag registered with assignedRoom ${closerRooms[0].name}`);

        return;
    }

    public DoFlagLogic(dokScreeps: dokScreeps) {
        if (this.flagRef === null)
            return;

        if (this.assignedRoom === null) {
            this.AssignFlagRoom(dokScreeps);
        }
    }
}