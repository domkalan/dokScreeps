import { dokScreeps } from "../dokScreeps";
import { Locks } from "../Locks";
import { dokRoom } from "../rooms/Room";
import { dokCreep } from "./Creep";

export class dokEnergyMinerCreep extends dokCreep {
    private focusedSource: string | null = null;

    public GatherSource() {
        if (this.focusedSource === null) {
            const homeRoom = this.dokScreepsRef.GetRoomReference(this.fromRoom);

            if (typeof homeRoom === 'undefined') {
                return;
            }

            const sourcesHere = homeRoom.roomRef.find(FIND_SOURCES).filter(i => Locks.GetLocksWithoutMe(i, this).length === 0);

            if (sourcesHere.length === 0) {
                this.creepRef.say('?');

                return;
            }

            this.focusedSource = sourcesHere[0].id;

            Locks.PlaceLock(sourcesHere[0], this);

            return;
        }
        
        const targetedSource = Game.getObjectById(this.focusedSource) as Source;

        if (targetedSource === null) {
            return;
        }

        const harvestCode = this.creepRef.harvest(targetedSource);

        if (harvestCode == -9) {
            this.MoveTo(targetedSource)

            return;
        } else if (harvestCode == -6) {
            this.sleepTime = 10;
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.GatherSource();
        
        return true;
    }

    public static buildBody: BodyPartConstant[] = [ MOVE, WORK, WORK ];
    public static buildName: string = 'energyminer';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        // copy build body, we don't want to edit static
        const buildBody = [...this.buildBody];

        if (rcl === 2)
            return buildBody;

        for(var i = 1; i < rcl; i++) {
            buildBody.push(WORK);

            if (i === 4)
                break;
        }

        if (rcl >= 5) {
            buildBody.push(CARRY);
        }

        return buildBody;
    }
}