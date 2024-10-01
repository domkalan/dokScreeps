import { dokScreeps } from "../dokScreeps";
import { dokCreep } from "./Creep";

export interface RoomConstructionEntry {
    item: string,
    itemPos: RoomPosition,
    addedAt: number,
    priority: number,
    points: number
}

export class dokBuilderCreep extends dokCreep {
    private focusedConstruct: string | null = null;

    constructor(creep: Creep, dokScreepInstance : dokScreeps) {
        super(creep, dokScreepInstance);
    }

    public DoConstructionWork() {
        const roomRef = this.GetRoomRefSafe();

        if (this.focusedConstruct === null) {
            // TODO: convert this to a room based queue, similar to hauler
            const construction = roomRef.PullFromConstructionQueue();

            if (typeof construction === 'undefined') {
                this.sleepTime = 10;

                this.creepRef.say('😴');

                return;
            }

            this.focusedConstruct = construction.item;
        }

        const constructionSite = Game.getObjectById(this.focusedConstruct) as ConstructionSite;

        if (constructionSite === null) {
            roomRef.RemoveFromConstructionQueue(this.focusedConstruct);

            this.focusedConstruct = null;

            return;
        }

        if (this.creepRef.store.energy === 0) {
            this.creepRef.say(`⚡?`);

            this.sleepTime = 10;

            this.RequestEnergyDelivery();

            return;
        }

        const buildCode = this.creepRef.build(constructionSite);

        if (buildCode === -9) {
            this.MoveTo(constructionSite);
        }
    }

    public RequestEnergyDelivery() {
        const roomRef = this.GetRoomRefSafe();

        roomRef.AddDeliveryToHaulQueue(this.creepRef.id, 'energy', 3, new RoomPosition(this.creepRef.pos.x, this.creepRef.pos.y - 2, this.creepRef.pos.roomName));
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoConstructionWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ WORK, CARRY, MOVE ];
    public static buildName: string = 'builder';
}