import dokUtil from "../dokUtil";
import dokCreep from "./Base";

export default class dokCreepHeavyMiner extends dokCreep {
    private lastMessage: number = 0;
    private creepTransfer: string | null = null;
    private pickupIdleTime: number = 0;
    private buildingContainer: boolean = false;
    private noSourceTime: number = 0;
    private deadLocksCleared: boolean = false;

    public canTakeFrom: boolean = true;

    public ShouldTurnOffContainerBuilding() {
        if (this.creepRef.store.energy <= 0) {
            this.buildingContainer = false;
        }
    }

    public DoMinerGather() {
        const energySources = this.util.FindResource<Source>(this.creepRef.room, FIND_SOURCES).filter(i => this.util.GetLocksWithoutMe({ id: `heavyminer:${i.id}` }, this).length === 0).sort((a, b) => dokUtil.getDistance(a.pos, this.creepRef.pos) - dokUtil.getDistance(b.pos, this.creepRef.pos));

        if (energySources.length > 0) {
            // lock for general public
            this.util.PlaceLock(energySources[0], this);

            // lock for other heavy miners
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

    public PlaceIntoLink(nearbyLink : StructureLink) {
        const linkTransferResult = this.creepRef.transfer(nearbyLink, 'energy');

        if (linkTransferResult === ERR_NOT_IN_RANGE) {
            this.moveToObject(nearbyLink)
        } else if (linkTransferResult === OK) {
            const currRoom = this.util.GetDokRoom(this.creepRef.room.name);

            if (typeof currRoom !== 'undefined') {
                currRoom.TickOnLink(nearbyLink);
            }
        }

        this.ShouldTurnOffContainerBuilding();

        return;
    }

    public PlaceOverflowContainer() {
        const nearbyContainersBuilt = this.creepRef.pos.findInRange(FIND_STRUCTURES, 4).filter(i => i.structureType === 'container');

        if (nearbyContainersBuilt.length > 0) {
            if (this.creepRef.transfer(nearbyContainersBuilt[0], 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(nearbyContainersBuilt[0])
            }

            this.ShouldTurnOffContainerBuilding();

            return;
        }

        const nearbyContainerConstructions = this.creepRef.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 4).filter(i => i.structureType === 'container' || i.structureType === 'link');

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
            // check if we have a link nearby, do an instant deposit if so
            const nearbyLinks = this.creepRef.pos.findInRange(FIND_STRUCTURES, 4).filter(i => i.structureType === 'link' && i.store.getFreeCapacity('energy') > 0) as StructureLink[];

            if (nearbyLinks.length > 0) {
                this.PlaceIntoLink(nearbyLinks[0]);

                this.creepRef.say(`🔗`, false);

                // tell other creeps you cant take from me
                this.canTakeFrom = false;

                return;
            }

            // if no links are nearby, allow some time for miners to come access me
            this.pickupIdleTime++;
            this.lastMessage++;

            if (this.lastMessage >= 10) {
                this.lastMessage = 0;

                this.creepRef.say(`PICKUP! ${this.pickupIdleTime}`, false);
            }

            if (this.pickupIdleTime >= 30) {
                this.buildingContainer = true;

                this.PlaceOverflowContainer();
            }
        }
    }

    public RequestTransfer(id: string) {
        this.creepTransfer = id;
    }
}