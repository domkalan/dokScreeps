import { Distance } from "../Distance";
import { dokScreeps } from "../dokScreeps";
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

    constructor(creep: Creep, dokScreepInstance : dokScreeps) {
        super(creep, dokScreepInstance);
    }

    public DoHaulWork() {
        let haulTask = (this.creepRef.memory as dokHaulerCreepMemory).haulTask;
        let haulStep = (this.creepRef.memory as dokHaulerCreepMemory).haulStep;

        if (haulTask === null) {
            const roomRef = this.GetRoomRefSafe();

            const haulWork = roomRef.PullFromHaulQueue();

            if (typeof haulWork === 'undefined') {
                this.sleepTime = 10;

                this.creepRef.say('😴');
    
                return;
            }

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
            if (this.creepRef.store.getUsedCapacity(item.resource) > 0) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
                
                return;
            }

            const storages = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).filter(i => i.structureType === 'storage' || i.structureType === 'container') as StructureStorage[];
            const storedResources = storages.filter(i => i.store.getUsedCapacity(item.resource) > 0);

            if (storedResources.length === 0) {
                this.creepRef.say('📦?');

                const roomRef = this.GetRoomRefSafe();

                roomRef.QueueHaulRequest(item);

                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;

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

            if (itemLookup.store.getUsedCapacity(item.resource) > this.creepRef.store.getFreeCapacity()) {
                const roomRef = this.GetRoomRefSafe();

                roomRef.QueueHaulRequest(item);
            }

            const pullCode = this.creepRef.withdraw(itemLookup, item.resource);

            if (pullCode == -9) {
                this.MoveTo(itemLookup);

                return;
            } else if (pullCode == -8) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            } else if (pullCode == 0 && itemLookup.store.getUsedCapacity(item.resource) < this.creepRef.store.getFreeCapacity()) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            } else if (pullCode == -7) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;

                this.creepRef.say(`📦💨`);
            }

            return;
        }

        if (item.haulType === HaulType.Deliver) {
            const chosenStorage = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).find(i => i.id === this.focusedStorage) as StructureStorage;

            this.creepRef.withdraw(chosenStorage, item.resource);

            if (this.creepRef.store.getFreeCapacity() < 0) {
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 2;
            } else if (chosenStorage.store.getUsedCapacity(item.resource) < this.creepRef.store.getFreeCapacity()) {
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
                (this.creepRef.memory as dokHaulerCreepMemory).haulStep = 0;
                (this.creepRef.memory as dokHaulerCreepMemory).haulTask = null;

                this.DumpResources();

                return;
            }

            const transferCode = this.creepRef.transfer(deliveryEndpoint, item.resource);

            if (transferCode == -9) {
                this.MoveTo(deliveryEndpoint);
            } else if (transferCode == -8) {
                this.sleepTime = 10;
            } else if (transferCode == 0) {
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

    public static buildBody: BodyPartConstant[] = [ MOVE, CARRY, CARRY, CARRY ];
    public static buildName: string = 'hauler';

    public static BuildInitialMemory(memParams: dokCreepMemory): dokHaulerCreepMemory {
        return {
            haulTask: null,
            haulStep: 0,
            ...memParams
        }
    }
}