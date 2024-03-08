import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepHeavyMiner extends dokCreep {
    private lastMessage: number = 0;
    private creepTransfer: string | null = null;
    private pickupIdleTime: number = 0;
    private buildingContainer: boolean = false;
    private noSourceTime: number = 0;
    private deadLocksCleared: boolean = false;

    public ShouldTurnOffContainerBuilding() {
        if (this.creepRef.store.energy <= 0) {
            this.buildingContainer = false;
        }
    }

    public DoMinerGather() {
        const energySources = this.util.FindCached<Source>(this.creepRef.room, FIND_SOURCES_ACTIVE).filter(i => this.util.GetLocks({ id: `heavyminer:${i.id}` }).filter(i => i.creep !== this.creepRef.id).length === 0).sort((a, b) => dokUtil.getDistance(a.pos, this.creepRef.pos) - dokUtil.getDistance(b.pos, this.creepRef.pos));

        if (energySources.length > 0) {
            this.util.PlaceLock({ id: `heavyminer:${energySources[0].id}` }, this);

            if (this.creepRef.harvest(energySources[0]) === ERR_NOT_IN_RANGE) {
                this.moveToObject(energySources[0])
            }

            return;
        }

        this.lastMessage++;
        this.noSourceTime++;
        if (this.lastMessage >= 5) {
            this.creepRef.say(`No source! ${this.noSourceTime}`, false);

            this.lastMessage = 0;
        }

        if (this.noSourceTime >= 20 && !this.deadLocksCleared) {
            this.noSourceTime = 0;
            this.deadLocksCleared = true;

            this.util.RemoveDeadLocks();
        }
    }

    public DoMinerTransfer() {
        const creep = this.util.GetKnownCreeps().find(i => i.GetId() === this.creepTransfer);

        if (typeof creep === 'undefined') {
            this.creepRef.say('Who?', false);

            this.creepTransfer = null;

            return;
        }

        if (this.creepRef.pos.getRangeTo(creep.GetRef()) >= 2) {
            this.creepRef.say('Too far!', false);

            this.creepTransfer = null;

            return;
        }

        /*const balance = this.creepRef.store.energy;
        const donateMaximum = creep.GetRef().store.getFreeCapacity('energy');
        let donateAmount = donateMaximum;

        if (donateAmount > donateMaximum) {
            donateAmount = balance;
        }*/

        this.creepRef.transfer(creep.GetRef(), 'energy');

        this.creepTransfer = null;

        this.creepRef.say('Here', false);

        this.pickupIdleTime = 0;
        this.buildingContainer = false;
    }

    public PlaceOverflowContainer() {
        const nearbyLinks = this.creepRef.pos.findInRange(FIND_STRUCTURES, 4).filter(i => i.structureType === 'link');
        const nearbyContainersBuilt = this.creepRef.pos.findInRange(FIND_STRUCTURES, 4).filter(i => i.structureType === 'container');

        if (nearbyLinks.length > 0) {
            if (this.creepRef.transfer(nearbyLinks[0], 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(nearbyLinks[0])
            }

            return;
        }

        if (nearbyContainersBuilt.length > 0) {
            if (this.creepRef.transfer(nearbyContainersBuilt[0], 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(nearbyContainersBuilt[0])
            }

            this.ShouldTurnOffContainerBuilding();

            return;
        }

        const nearbyContainerConstructions = this.creepRef.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 4).filter(i => i.structureType === 'container');

        if (nearbyContainerConstructions.length > 0) {
            if (this.creepRef.build(nearbyContainerConstructions[0]) === ERR_NOT_IN_RANGE) {
                this.moveToObject(nearbyContainerConstructions[0])
            }

            this.ShouldTurnOffContainerBuilding();

            return;
        }

        const nearbySource = this.creepRef.pos.findInRange(FIND_SOURCES, 4);

        if (nearbySource.length === 0) {
            this.creepRef.say('Source?');

            return;
        }

        const bestSpot = dokUtil.GetFreeSlots(this.creepRef.room, nearbySource[0], 3, 1, ['swamp']).filter(i => i.code === 1).sort((a, b) => dokUtil.getDistance(a.pos, nearbySource[0].pos) - dokUtil.getDistance(b.pos, nearbySource[0].pos));

        bestSpot.forEach(spot => {
            if (spot.code === 0) {
                new RoomVisual(spot.pos.roomName).circle(spot.pos, { fill: 'red' })

                return;
            }

            new RoomVisual(spot.pos.roomName).circle(spot.pos, { fill: 'green' })
        })

        if (bestSpot.length === 0) {
            this.creepRef.say('No overflow!');

            return;
        }

        this.creepRef.room.createConstructionSite(bestSpot[0], 'container');
    }

    public DoCreepWork(): void {
        if (this.creepTransfer !== null) {
            this.DoMinerTransfer();
        }

        if (this.buildingContainer) {
            this.PlaceOverflowContainer();

            return;
        }

        if (this.creepRef.store.energy < this.creepRef.store.getCapacity('energy')) {
            this.DoMinerGather();
        } else {
            this.pickupIdleTime++;
            this.lastMessage++;
            if (this.lastMessage >= 10) {
                this.lastMessage = 0;

                this.creepRef.say(`PICKUP! ${this.pickupIdleTime}`, false);

                if (this.pickupIdleTime > 50) {
                    this.buildingContainer = true;
                }
            }
        }
    }

    public RequestTransfer(id: string) {
        this.creepTransfer = id;
    }
}