import { Distance } from "./Distance";
import { dokScreeps } from "./dokScreeps";
import { Logger } from "./Logger";
import { dokRoomType, RoomState } from "./rooms/Room";

/**
 * dokFlag
 * 
 * Flags are an essential part of commanding and interacting with dokScreeps.
 * 
 * Some flags require an assigned room to operate correctly, others will work with all assigned rooms.
 * 
 * Red Flags - Attack Operations
 * Purple Flags - Claim/Settlement Operations
 * Orange Flags - Remote Mining and Power Harvesting Operations
 * Brown Flags - Instructions for dokScreeps
 */
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

        // Signal to instance to add room to pathing, set flag name to true/false to toggle
        if (this.flagRef.color === COLOR_WHITE && this.flagRef.secondaryColor === COLOR_BLUE) {
            if (typeof Memory.flags[this.flagRef.pos.roomName] === 'undefined') {
                Memory.flags[this.flagRef.pos.roomName] = {};
            }

            if (typeof (Memory.flags[this.flagRef.pos.roomName] as dokRoomMemory).avoid === 'undefined') {
                (Memory.flags[this.flagRef.pos.roomName] as dokRoomMemory).avoid = false;
            }

            const oldValue = (Memory.flags[this.flagRef.pos.roomName] as dokRoomMemory).avoid;
            const newValue = JSON.parse(this.flagRef.name.toLowerCase());

            (Memory.flags[this.flagRef.pos.roomName] as dokRoomMemory).avoid = newValue;

            new RoomVisual(this.flagRef.pos.roomName).text(`Room pathing updated, value was ${oldValue}, but is now ${newValue}`, this.flagRef.pos);

            this.flagRef.remove();
        }

        // Signal to instance to toggle pixel generation
        if (this.flagRef.color === COLOR_WHITE && this.flagRef.secondaryColor === COLOR_RED) {
            

            const oldValue = (Memory as any).dokScreeps.pixelGen;
            const newValue = JSON.parse(this.flagRef.name.toLowerCase());

            (Memory as any).dokScreeps.pixelGen = newValue;

            new RoomVisual(this.flagRef.pos.roomName).text(`Pixel generation setting updated! Was ${oldValue}, but is now ${newValue}`, this.flagRef.pos);

            this.flagRef.remove();
        }

        this.assignedRoom = '*';

        // do this for debugging purpose
        (this.flagRef.memory as any).assignedRoom = '*';

        Logger.Log(`Flag:${this.flagRef.name}`, `Flag registered with assignedRoom *`);
    }

    public AssignByDistance(dokScreeps: dokScreeps) {
        const ownedRooms = dokScreeps.GetRooms().filter(i => i.state === RoomState.Controlled && i.roomType !== dokRoomType.Puppet);

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