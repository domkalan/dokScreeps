import { dokBootstrapCreep } from "../creeps/Bootstrap";
import { ConstructionType } from "../creeps/Builder";
import { dokCreep } from "../creeps/Creep";
import { dokScreeps } from "../dokScreeps";
import { Logger } from "../Logger";
import { dokRoom, dokRoomMemory, dokRoomType, RoomState } from "./Room"

/**
 * dokPuppetRoom
 * A basic room that will not construct anything on its own, essentially leaches off another room.
 * Useful for when you need to defend a walkway room, but are not interested in expanding the room.
 */
export class dokPuppetRoom extends dokRoom {
    private leachingRoom: dokRoom | null = null;

    public override readonly roomType: dokRoomType = dokRoomType.Puppet;

    constructor(room: Room, dokScreepsInstance: dokScreeps) {
        super(room, dokScreepsInstance);

        this.GetNearestRoom();
    }

    protected override QueueForSpawnOnce(creep: typeof dokCreep): void {
        if (this.leachingRoom === null)
            return;

        this.leachingRoom.CommandeerSpawn(creep, this.name)
    }

    protected override QueueForSpawn(creep: typeof dokCreep): void {
        if (this.leachingRoom === null)
            return;

        this.leachingRoom.CommandeerSpawn(creep, this.name)
    }

    protected override MonitorRoomCreeps() {
        if (this.state !== RoomState.Controlled)
            return;

        if (this.leachingRoom === null) {
            Logger.Error(`Room:${this.name}`, `No nearest room, could not monitor creeps in room since room does not have spawn.`);

            return;
        }

        this.ownedCreeps = this.dokScreepsRef.GetCreepsByRoom(this.roomRef.name);

        // get creep counts
        const bootstrapCreeps = this.ownedCreeps.filter(i => i.name.startsWith('bootstrap'));

        if (bootstrapCreeps.length < 1) {
            this.QueueForSpawnOnce(dokBootstrapCreep);
        }
    }

    // empty this
    protected override MonitorSpawnCreeps(): void {}

    public AddConstructionProject(item: string, points: number, priority?: number, itemPos?: RoomPosition | null): void {
        if (this.leachingRoom === null)
            return;

        this.leachingRoom.AddConstructionProject(item, points, priority, itemPos);
    }

    public QueueRepairStructure(item: string, points: number, priority?: number, itemPos?: RoomPosition | null): void {
        if (this.leachingRoom === null)
            return;

        this.leachingRoom.AddConstructionProject(item, points, priority, itemPos);
    }

    /*public AddPickupToHaulQueue(item: string, resource: ResourceConstant, priority?: number, itemPos?: RoomPosition | null): void {
        if (this.leachingRoom === null)
            return;

        this.leachingRoom.AddPickupToHaulQueue(item, resource, priority, itemPos)
    }

    public AddDeliveryToHaulQueue(item: string, resource: ResourceConstant, priority?: number, itemPos?: RoomPosition | null): void {
        if (this.leachingRoom === null)
            return;

        this.leachingRoom.AddDeliveryToHaulQueue(item, resource, priority, itemPos);
    }

    public AddPullToHaulQueue(item: string, resource: ResourceConstant, priority?: number, itemPos?: RoomPosition | null): void {
        if (this.leachingRoom === null)
            return;

        this.leachingRoom.AddDeliveryToHaulQueue(item, resource, priority, itemPos);
    }*/

    public DoConstructionPlanning(rcl : number | undefined): Array<{ type: StructureConstant, pos: RoomPosition }>  {
        return []
    }

    protected GetNearestRoom() : dokRoom | null {
        const ownedRooms = this.dokScreepsRef.GetRooms().filter(i => i.state === RoomState.Controlled && i.name !== this.name && i.roomType !== dokRoomType.Puppet).filter(i => {
            return this.dokScreepsRef.GetStructuresByRoom(i.name).filter(i => i.structureType === 'spawn').length > 0;
        });

        if (ownedRooms.length === 0) {
            Logger.Log(`Room:${this.name}`, `Could not ask for help, no other rooms!`);

            return null;
        }

        let closerRoom = null;

        if (ownedRooms.length === 1) {
            Logger.Log(`Room:${this.name}`, `Only one other room, will beg for help from them.`);

            closerRoom = ownedRooms[0];
        }

        if (closerRoom === null) {
            const closerRooms = ownedRooms.sort((a, b) => Game.map.getRoomLinearDistance(a.name, this.name) - Game.map.getRoomLinearDistance(b.name, this.name));

            closerRoom = closerRooms[0];
        }

        this.leachingRoom = closerRoom;

        return closerRoom;
    }
}