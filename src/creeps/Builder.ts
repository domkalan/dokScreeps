import { dokCreep } from "./Creep";

export enum ConstructionType {
    Build,
    Repair
}

export interface RoomConstructionEntry {
    item: string,
    itemPos: RoomPosition,
    addedAt: number,
    priority: number,
    points: number,
    constructionType: ConstructionType
}

export class dokBuilderCreep extends dokCreep {
    private focusedConstruct: string | null = null;
    private focusedConstructType: ConstructionType | null = null;
    private focusedConstructPoints: number = 0;

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
            this.focusedConstructType = construction.constructionType;
            this.focusedConstructPoints = construction.points;
        }

        // repair structure
        if (this.focusedConstructType === ConstructionType.Repair) {
            const constructionSite = Game.getObjectById(this.focusedConstruct) as Structure;

            if (constructionSite === null || constructionSite.hits > this.focusedConstructPoints || constructionSite.hits >= constructionSite.hitsMax) {
                roomRef.RemoveFromConstructionQueue(this.focusedConstruct);

                this.focusedConstruct = null;
                this.focusedConstructType = null;
                this.focusedConstructPoints = 0;

                return;
            }

            const repairCode = this.creepRef.repair(constructionSite);

            if (repairCode === -9) {
                this.MoveTo(constructionSite);
            } else if (repairCode === -6) {
                // creep should reset to check for other work after repair has finished
                this.focusedConstruct = null;
                this.focusedConstructType = null;
                this.focusedConstructPoints = 0;

                this.creepRef.say(`⚡?`);

                this.sleepTime = 10;

                this.RequestEnergyDelivery();
            }

            return;
        }

        const constructionSite = Game.getObjectById(this.focusedConstruct) as ConstructionSite;

        if (constructionSite === null) {
            roomRef.RemoveFromConstructionQueue(this.focusedConstruct);

            this.focusedConstruct = null;

            return;
        }

        const buildCode = this.creepRef.build(constructionSite);

        if (buildCode === -9) {
            this.MoveTo(constructionSite);
        } else if (buildCode === -6) {
            this.creepRef.say(`⚡?`);

            this.sleepTime = 10;

            this.RequestEnergyDelivery();
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