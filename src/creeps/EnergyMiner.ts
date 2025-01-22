import { Locks } from "../Locks";
import { dokCreep } from "./Creep";

export class dokEnergyMinerCreep extends dokCreep {
    protected focusedSource: string | null = null;
    protected focusedLink: string | null = null;
    protected focusedLinkBlocked: boolean = false;

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

        if (!this.focusedLinkBlocked && this.creepRef.store.getFreeCapacity() <= 0) {
            if (this.focusedLink === null) {
                const nearbyLink = this.creepRef.pos.findInRange(FIND_STRUCTURES, 2).filter(i => i.structureType === 'link');

                if (nearbyLink.length === 0) {
                    this.focusedLinkBlocked = true;

                    return;
                }

                this.focusedLink = nearbyLink[0].id;
            }

            const nearbyLink = Game.getObjectById(this.focusedLink) as StructureLink;

            const transferCode = this.creepRef.transfer(nearbyLink, 'energy');
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
        const buildBody: BodyPartConstant[] = [...this.buildBody]; // Base body

        if (rcl >= 5) {
            buildBody.push(CARRY, WORK, WORK, WORK)
        }

        return buildBody;
    }
}