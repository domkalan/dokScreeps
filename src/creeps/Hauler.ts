import { Distance } from "../Distance";
import { Logger } from "../Logger";
import { dokCreep, dokCreepMemory } from "./Creep";

export interface dokHaulerCreepMemory extends dokCreepMemory {
    haulTask: HaulQueueEntry | null,
    haulStep: number
}

export enum HaulType {
    Pickup,
    Pull,
    Deliver
}

export interface HaulQueueEntry {
    haulType: HaulType,
    item: string,
    itemPos: RoomPosition,
    priority: number,
    addedAt: number,
    resource: ResourceConstant
    
}

export class dokHaulerCreep extends dokCreep {
    private checkedForRequestor: boolean = false;
    private focusedStorage: string | null = null;
    private haulDeliveryResourceConstraint: ResourceConstant | null = null;
    private timeWithoutJob: number = 0;

    public DoHaulWork() {
        let haulTask = (this.creepRef.memory as dokHaulerCreepMemory).haulTask;
        let haulStep = (this.creepRef.memory as dokHaulerCreepMemory).haulStep;

        if (haulTask === null) {
            const roomRef = this.GetRoomRefSafe();

            let haulWork = undefined;

            if (this.haulDeliveryResourceConstraint === null) {
                haulWork = roomRef.PullFromHaulQueue();
            } else {
                haulWork = roomRef.PullFromHaulQueueWithConstraint(this.haulDeliveryResourceConstraint)
            }

            if (typeof haulWork === 'undefined') {
                this.timeWithoutJob++;
                if (this.timeWithoutJob > 3 && this.haulDeliveryResourceConstraint !== null) {
                    this.DumpResources();

                    this.haulDeliveryResourceConstraint = null;

                    return;
                }

                this.sleepTime = 10;

                this.creepRef.say('😴');
    
                return;
            }

            this.timeWithoutJob = 0;

            // save haul task to memory
            (this.creepRef.memory as dokHaulerCreepMemory).haulTask = haulWork;

            // update our current memory
            haulTask = haulWork;
        }
        
        switch(haulStep) {
            case 0:
                this.MoveToResource(haulTask);

                break;
            case 1:
                this.LocateHaulItem(haulTask);

                break;
            case 2:
                this.ProcessHauledItem(haulTask);

                break;
        }
    }

    public MoveToResource(item : HaulQueueEntry) {
        if (item.haulType === HaulType.Pickup || item.haulType == HaulType.Pull) {
            // update step, go to haul location, once finished we are on step 1
            (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 1;

            return;
        }

        if (item.haulType === HaulType.Deliver) {
            if (this.creepRef.store[item.resource] > 0) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
                
                return;
            }

            const storages = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).filter(i => i.structureType === 'storage' || i.structureType === 'container') as StructureStorage[];
            const storedResources = storages.filter(i => i.store[item.resource] > 0);

            if (storedResources.length === 0) {
                this.creepRef.say('📦?');

                const roomRef = this.GetRoomRefSafe();

                roomRef.QueueHaulRequest(item);

                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;

                const pickupRequestConstraint = roomRef.SearchForPickupMatching(item.resource);

                if (typeof pickupRequestConstraint === 'undefined') {
                    return;
                }

                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = pickupRequestConstraint;

                this.creepRef.say('🔄');

                return;
            }

            const storedResource = storedResources[0];

            this.focusedStorage = storedResource.id;

            (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 1;

            return;
        }
    }

    public LocateHaulItem(item : HaulQueueEntry) {
        if (item.haulType === HaulType.Pickup) {
            const itemLookup = Game.getObjectById(item.item) as Resource;

            if (itemLookup === null) {
                Logger.Log('Hauler', `Haul pickup request for item ${item.item} voided, could not locate`);

                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;

                return;
            }

            if (itemLookup.amount > this.creepRef.store.getFreeCapacity()) {
                const roomRef = this.GetRoomRefSafe();

                roomRef.QueueHaulRequest(item);
            }

            const pickupCode = this.creepRef.pickup(itemLookup);

            if (pickupCode == -9) {
                this.MoveTo(itemLookup);

                return;
            } else if (pickupCode == -8) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            } else if (pickupCode == 0 && itemLookup.amount < this.creepRef.store.getFreeCapacity()) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            }

            return;
        }

        if (item.haulType === HaulType.Pull) {
            const itemLookup = Game.getObjectById(item.item) as StructureContainer | Ruin;

            if (itemLookup === null) {
                Logger.Log('Hauler', `Haul pickup request for item ${item.item} voided, could not locate`);

                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;

                return;
            }

            if (itemLookup.store[item.resource] > this.creepRef.store.getFreeCapacity()) {
                const roomRef = this.GetRoomRefSafe();

                roomRef.QueueHaulRequest(item);
            }

            const pullCode = this.creepRef.withdraw(itemLookup, item.resource);

            if (pullCode == -9) {
                this.MoveTo(itemLookup);

                return;
            } else if (pullCode == -8) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            } else if (pullCode == 0 && itemLookup.store[item.resource] < this.creepRef.store.getFreeCapacity()) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            } else if (pullCode == -7) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;

                this.creepRef.say(`📦💨`);
            }

            return;
        }

        if (item.haulType === HaulType.Deliver) {
            if (this.focusedStorage === null) {
                Logger.Log(`Hauler:${this.fromRoom}`, `Invalid storage pull id.`);

                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;

                return;
            }

            const chosenStorage = Game.getObjectById(this.focusedStorage) as StructureStorage;

            if (chosenStorage === null) {
                Logger.Log(`Hauler:${this.fromRoom}`, `Invalid storage item, does it exist?`);

                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;

                return;
            }

            const withdrawCode = this.creepRef.withdraw(chosenStorage, item.resource);

            if (withdrawCode === -9) {
                this.MoveTo(chosenStorage);
            } else if (withdrawCode === -8) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            } else if (withdrawCode === -6) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            }

            return;
        }
    }

    public ProcessHauledItem(item : HaulQueueEntry) {
        if (item.haulType === HaulType.Pickup || item.haulType === HaulType.Pull) {
            if (!this.checkedForRequestor) {
                const roomRef = this.GetRoomRefSafe();
    
                const deliveryRequest = roomRef.SearchForDeliveryMatching(item.resource);

                if (typeof deliveryRequest !== 'undefined') {
                    (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                    (this.creepRef.memory as dokHaulerCreepMemory).haulTask = deliveryRequest;
    
                    return;
                }
    
                this.checkedForRequestor = true;
            }
    
            if (this.focusedStorage === null) {
                const storages = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).filter(i => i.structureType === 'storage' || i.structureType === 'container' || i.structureType === 'link');
    
                if (storages.length === 0) {
                    this.creepRef.say('📦?')

                    const roomRef = this.GetRoomRefSafe();

                    roomRef.QueueHaulRequest(item);

                    this.creepRef.drop(item.resource);

                    (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                    (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;
                    this.checkedForRequestor = false;
                    
                    return;
                }
    
                const closestStorages = storages.sort((a, b) => Distance.GetDistance(a.pos, this.creepRef.pos) - Distance.GetDistance(b.pos, this.creepRef.pos));
                const closestStorage = closestStorages[0];
    
                this.focusedStorage = closestStorage.id;
            }
    
            const chosenStorage = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).find(i => i.id === this.focusedStorage) as Structure;
    
            const transferCode = this.creepRef.transfer(chosenStorage, item.resource);
    
            if (transferCode == -9) {
                this.MoveTo(chosenStorage);
            } else if (transferCode == 0) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;
                this.focusedStorage = null;
            }

            return;
        }

        if (item.haulType === HaulType.Deliver) {
            const deliveryEndpoint = Game.getObjectById(item.item) as Structure | Creep;

            if (deliveryEndpoint === null) {
                this.haulDeliveryResourceConstraint = item.resource;
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;

                return;
            }

            const transferCode = this.creepRef.transfer(deliveryEndpoint, item.resource);

            if (transferCode == -9) {
                this.MoveTo(deliveryEndpoint);
            } else if (transferCode == -8) {
                this.haulDeliveryResourceConstraint = item.resource;
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;
            } else if (transferCode == 0) {
                if (Object.keys(this.creepRef.store).length > 0) {
                    const resourceConstraint = Object.keys(this.creepRef.store)[0] as ResourceConstant;

                    this.haulDeliveryResourceConstraint = resourceConstraint;
                } else {
                    this.haulDeliveryResourceConstraint = null;
                }

                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;
                this.checkedForRequestor = false;
            } else if (transferCode == -6) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;
                this.checkedForRequestor = false;
            }

            return;
        }
    }

    public DumpResources() {
        for(const resource in Object.keys(this.creepRef.store)) {
            this.creepRef.drop(resource as ResourceConstant);
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoHaulWork();
        
        return false;
    }

    public static buildBody: BodyPartConstant[] = [ MOVE, CARRY ];
    public static buildName: string = 'hauler';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        const buildBody: BodyPartConstant[] = [...this.buildBody]; // Base body

        let totalCost = buildBody.reduce((sum, part) => sum + BODYPART_COST[part as keyof typeof BODYPART_COST], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + BODYPART_COST.move + BODYPART_COST.carry <= energy && buildBody.length < 12) {
            buildBody.push(MOVE, CARRY);
            totalCost += BODYPART_COST.move + BODYPART_COST.carry;
        }

        return buildBody;
    }

    public static BuildInitialMemory(memParams: dokCreepMemory): dokHaulerCreepMemory {
        return {
            haulTask: null,
            haulStep: 0,
            ...memParams
        }
    }
}