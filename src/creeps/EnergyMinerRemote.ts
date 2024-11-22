import { Locks } from "../Locks";
import { dokCreep } from "./Creep";

export class dokEnergyMinerRemoteCreep extends dokCreep {
    private focusedSource: string | null = null;
    private focusedCan: string | null = null;
    private focusedOnCanConstruct: boolean = false;

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

        if (this.focusedOnCanConstruct && this.creepRef.store.energy > 0) {
            if (this.focusedCan === null) {
                const canNearby = this.creepRef.pos.findInRange(FIND_CONSTRUCTION_SITES, 3).filter(i => i.structureType === 'container');

                if (canNearby.length === 0) {
                    this.focusedOnCanConstruct = true;

                    this.creepRef.room.createConstructionSite(this.creepRef.pos, 'container');

                    return;
                }

                this.focusedCan = canNearby[0].id;
            }

            const focusedCan = Game.getObjectById(this.focusedCan) as ConstructionSite;

            if (focusedCan === null) {
                this.focusedOnCanConstruct = false;

                return;
            }

            const depositCode = this.creepRef.build(focusedCan);

            if (depositCode === -6) {
                this.MoveTo(focusedCan);
            }

            return;
        }

        if (this.creepRef.store.getFreeCapacity() < 0 && !this.focusedOnCanConstruct) {
            if (this.focusedCan === null) {
                const canNearby = this.creepRef.pos.findInRange(FIND_STRUCTURES, 3).filter(i => i.structureType === 'container');

                if (canNearby.length === 0) {
                    this.focusedOnCanConstruct = true;

                    this.creepRef.room.createConstructionSite(this.creepRef.pos, 'container');

                    return;
                }

                this.focusedCan = canNearby[0].id;
            }

            const focusedCan = Game.getObjectById(this.focusedCan) as StructureContainer;

            const depositCode = this.creepRef.transfer(focusedCan, 'energy');

            if (depositCode === -6) {
                this.MoveTo(focusedCan);
            } else if (depositCode === 0) {
                if (focusedCan.store.energy >= focusedCan.store.getCapacity('energy') / 2) {
                    const roomRef = this.GetRoomRefSafe();

                    roomRef.AddPullToHaulQueue(focusedCan.id, 'energy', 3, focusedCan.pos);

                    this.creepRef.say(`⚡️🚚`);
                }
            }

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

    public static buildBody: BodyPartConstant[] = [ MOVE, WORK, CARRY ];
    public static buildName: string = 'energyminer';
}