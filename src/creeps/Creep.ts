import { dokScreeps } from "../dokScreeps";
import { Locks } from "../Locks";
import { Pathing } from "../Pathing";
import { dokRoom } from "../rooms/Room";

export interface dokCreepMemory {
    fromRoom: string;
}

export class dokCreep {
    public fromRoom: string;
    public name: string;
    public creepRef: Creep;

    protected roomRef: dokRoom | null = null;
    protected dokScreepsRef: dokScreeps;

    protected sleepTime: number = 0;
    protected travelingFor: number = 0;
    protected travelingTo: RoomObject | null = null;

    constructor(creep : Creep, dokScreepsInstance: dokScreeps) {
        this.fromRoom = (creep.memory as any).fromRoom;
        this.name = creep.name;
        this.creepRef = creep;

        this.dokScreepsRef = dokScreepsInstance;
    }

    public Tick(tickNumber: number, instanceTickNumber: number) : boolean {
        // check if creep is alive
        if (typeof Game.creeps[this.name] === 'undefined') {
            this.dokScreepsRef.RemoveCreep(this);

            Locks.ReleaseLocks(this);

            return true;
        }

        // update ref
        this.creepRef = Game.creeps[this.name];

        // dont tick is spawning
        if (this.creepRef.spawning)
            return true;

        if (this.travelingFor > 1 && this.travelingTo !== null) {
            this.travelingFor--;

            this.creepRef.say(`🐟`);

            this.MoveTo(this.travelingTo);

            return true;
        }

        if (this.sleepTime > 0) {
            this.creepRef.say('💤');

            this.sleepTime--;

            return true;
        }

        return false;
    }

    public MoveTo(target : RoomObject, blocksTick: boolean = true) {
        /*this.creepRef.moveTo(target, {
            visualizePathStyle: {
                fill: 'transparent',
                stroke: '#fff',
                lineStyle: 'dashed',
                strokeWidth: .15,
                opacity: .1
            },
            reusePath: 150
        });*/

        const getRoomsToAvoid = Pathing.GetRoomsToAvoid();

        // using traveler
        let data = {} as any;
        (this.creepRef as any).travelTo(target, { 
            returnData: data,
            allowHostile: false,
            avoid: getRoomsToAvoid
        });

        if (blocksTick && typeof data.path !== 'undefined') {
            this.travelingFor = data.path.length;
            this.travelingTo = target;
        }
    }

    public GetRoomRefSafe() : dokRoom {
        if (this.roomRef !== null)
            return this.roomRef;

        const roomRef = this.dokScreepsRef.GetRoomReference(this.fromRoom);

        // handle room does not exist
        if (typeof roomRef === 'undefined')
            throw new Error(`Room ${this.fromRoom} does not exist in the rooms list...?`);

        this.roomRef = roomRef;

        return roomRef;
    }

    //#region Static methods
    public static buildName: string = 'creep';
    public static buildBody: BodyPartConstant[] = [ MOVE ];
    public static BuildBodyStack(rcl: number, energy: number) {
        return this.buildBody;
    }

    public static BuildInitialMemory(memParams: dokCreepMemory) {
        return memParams;
    }
    //#endregion
}