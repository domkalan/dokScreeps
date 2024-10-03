import { dokBootstrapCreep } from "../creeps/Bootstrap";
import { dokBuilderCreep, RoomConstructionEntry } from "../creeps/Builder";
import { dokCreep } from "../creeps/Creep";
import { dokEnergyMinerCreep } from "../creeps/EnergyMiner";
import { dokHaulerCreep, HaulQueueEntry, HaulType } from "../creeps/Hauler";
import { dokRancherCreep } from "../creeps/Rancher";
import { dokServantCreep } from "../creeps/Servant";
import { dokScreeps } from "../dokScreeps";
import { Logger } from "../Logger";
import { Seats } from "../Seats";
import { Settings } from "../Settings";

export enum RoomState {
    Controlled,
    Reserved,
    Visiting,
    Inactive
}

export enum ResourceType {
    Source,
    Mineral,
    Deposit
}

export interface dokRoomResource {
    resourceType: ResourceType,
    resourceSubType: ResourceConstant,
    id: string,
    seats: number
}

export interface dokRoomMemory {
    owned: boolean,
    owner: string | null,
    avoid: boolean,
    resources: dokRoomResource[],
    plans: any[],

    scouted: boolean,
    scoutedAt: number,

    lastActive: number
}

export class dokRoom {
    // store room references
    public roomRef: Room;
    public name: string;
    private dokScreepsRef: dokScreeps;

    // what is the state of this room?
    public state: RoomState = RoomState.Visiting;

    // keep track of creeps
    private ownedCreeps: dokCreep[] = [];
    private creepSpawnQueue: typeof dokCreep[] = [];

    // what do we have to haul here?
    private haulQueue: HaulQueueEntry[] = [];

    // how many sources does this room have
    private sources: number = 0;

    // track our construction projects
    private constructionProjects: RoomConstructionEntry[] = [];

    // track if this is our first tick
    private firstTick: boolean = true;

    constructor(room: Room, dokScreepsInstance: dokScreeps) {
        Logger.Log('dokRooms', `Room ${room.name} has been created as a dokRoom`);

        this.roomRef = room;
        this.name = room.name;
        this.dokScreepsRef = dokScreepsInstance;

        // Determine room state
        if (typeof room.controller === 'undefined') {
            this.state = RoomState.Visiting;
        } else if (room.controller.my) {
            this.state = RoomState.Controlled;
        } else if (typeof room.controller.reservation !== 'undefined' && room.controller.reservation.username === Settings.username) {
            this.state = RoomState.Reserved;
        } else {
            this.state = RoomState.Visiting;
        }

        // Generate memory for room
        if (typeof (Memory as any).rooms === 'undefined') {
            (Memory as any).rooms = {};
        }

        if (typeof (Memory.rooms[this.name] as dokRoomMemory) === 'undefined') {
            (Memory.rooms[this.name] as dokRoomMemory) = {
                owned: false,
                owner: null,
                avoid: false,
                resources: [],
                plans: [],
                scouted: true,
                scoutedAt: Game.time,

                lastActive: Game.time
            };
        }

        // scan room resources, save them into storage if not
        if ((Memory.rooms[this.name] as dokRoomMemory).resources === null) {
            (Memory.rooms[this.name] as dokRoomMemory).resources = [];

            this.ScanRoomResources();
        
        // if room already has scanned, set sources length from mem
        } else {
            this.sources = (Memory.rooms[this.name] as dokRoomMemory).resources.filter((i : dokRoomResource) => i.resourceType === ResourceType.Source).length;
        }

        Logger.Log('dokRooms', `Room ${room.name} has state ${this.state}`);

        if (this.state === RoomState.Controlled) {
            this.ownedCreeps = dokScreepsInstance.GetCreepsByRoom(room.name);

            Logger.Log('dokRooms', `Room ${room.name} has ${this.ownedCreeps.length} creeps`);

            if (!(Memory.rooms[this.name] as dokRoomMemory).owned) {
                (Memory.rooms[this.name] as dokRoomMemory).owned = true;
            }
        }
    }

    private ScanRoomResources() {
        const resources: dokRoomResource[] = [];

        const sources = this.roomRef.find(FIND_SOURCES);

        for (const source of sources) {
            const seats = Seats.GetSeatsForItem(this.roomRef, source);

            resources.push({ resourceType: ResourceType.Source, resourceSubType: 'energy', id: source.id, seats });
        }

        // set the sources count
        this.sources = sources.length;

        const minerals = this.roomRef.find(FIND_MINERALS);

        for (const mineral of minerals) {
            const seats = Seats.GetSeatsForItem(this.roomRef, mineral);

            resources.push({ resourceType: ResourceType.Mineral, resourceSubType: mineral.mineralType, id: mineral.id, seats });
        }

        const deposits = this.roomRef.find(FIND_DEPOSITS);

        for (const deposit of deposits) {
            const seats = Seats.GetSeatsForItem(this.roomRef, deposit);

            resources.push({ resourceType: ResourceType.Mineral, resourceSubType: deposit.depositType, id: deposit.id, seats });
        }

        Logger.Log(`dokCreep:RoomResources`, `Room ${this.name} has ${resources.length} resource(s)`);

        (Memory.rooms[this.name] as dokRoomMemory).resources = resources;
    }

    private QueueForSpawnOnce(creep: typeof dokCreep) {
        if (this.creepSpawnQueue.includes(creep))
            return;

        Logger.Log('dokCreep:Spawn', `${creep.buildName} has been queued for spawn`)

        this.creepSpawnQueue.push(creep);
    }

    private MonitorRoomCreeps() {
        if (this.state !== RoomState.Controlled)
            return;

        this.ownedCreeps = this.dokScreepsRef.GetCreepsByRoom(this.roomRef.name);

        // reset queue, if creeps are 0 room has probably crashed
        if (this.ownedCreeps.length === 0) {
            this.creepSpawnQueue = [];

            this.QueueForSpawnOnce(dokBootstrapCreep);

            return;
        }

        // get creep counts
        const bootstrapCreeps = this.ownedCreeps.filter(i => i.name.startsWith('bootstrap'));
        const energyMinerCreeps = this.ownedCreeps.filter(i => i.name.startsWith('energyminer'));
        const haulerCreeps = this.ownedCreeps.filter(i => i.name.startsWith('hauler'));
        const servantCreeps = this.ownedCreeps.filter(i => i.name.startsWith('servant'));
        const builderCreeps = this.ownedCreeps.filter(i => i.name.startsWith('builder'));
        const rancherCreeps = this.ownedCreeps.filter(i => i.name.startsWith('rancher'));

        // do logic based on rcl
        if (this.roomRef.controller?.level || 0 >= 2) {
            if (bootstrapCreeps.length < 1 && servantCreeps.length < 1) {
                // flush spawn queue, we need to bootstrap
                this.creepSpawnQueue = [];

                this.QueueForSpawnOnce(dokBootstrapCreep);

                return;
            }

            if (rancherCreeps.length < 1) {
                this.QueueForSpawnOnce(dokRancherCreep);
            }

            if (energyMinerCreeps.length < 1) {
                this.QueueForSpawnOnce(dokEnergyMinerCreep);
            }

            if (haulerCreeps.length < 1) {
                this.QueueForSpawnOnce(dokHaulerCreep);
            }

            if (energyMinerCreeps.length < this.sources) {
                this.QueueForSpawnOnce(dokEnergyMinerCreep);
            }

            if (builderCreeps.length < Math.floor((this.constructionProjects.length / 5) + 1) && this.constructionProjects.length > 0 && builderCreeps.length < 4) {
                this.QueueForSpawnOnce(dokBuilderCreep);
            }

            if (servantCreeps.length < (this.roomRef.controller?.level || 1)) {
                this.QueueForSpawnOnce(dokServantCreep);
            }
            
            Logger.Log(`dokRooms:${this.name}`, `Math says we need ${Math.floor((this.haulQueue.length / 3) + 1)} hauler(s)`);

            if (haulerCreeps.length < Math.floor((this.haulQueue.length / 3) + 1) && this.haulQueue.length > 0 && haulerCreeps.length < 10) {
                this.QueueForSpawnOnce(dokHaulerCreep);
            }
        }
    }

    // monitor our spawns in the room
    private MonitorSpawnCreeps() {
        if (this.creepSpawnQueue.length === 0)
            return;

        const structures = this.dokScreepsRef.GetStructuresByRoom(this.roomRef.name);

        const spawns = structures.filter(i => i.structureType === 'spawn') as StructureSpawn[];
        const spawnsReady = spawns.filter(i => !i.spawning);

        Logger.Log(`dokRooms:${this.roomRef.name}`, `Room spawn status, ${spawnsReady.length}/${spawns.length} ready`);

        const extensions = structures.filter(i => i.structureType === 'extension') as StructureExtension[];

        let standbyEnergy = 0;

        for(const extension of extensions) {
            standbyEnergy += extension.store.energy;
        }

        Logger.Log(`dokRooms:${this.roomRef.name}`, `Room spawn status, ${spawnsReady.length}/${spawns.length} ready`);

        for (const spawn of spawns) {
            if (this.creepSpawnQueue.length === 0)
                break;

            const creepClass = this.creepSpawnQueue[0];

            if (typeof creepClass === 'undefined')
                break;

            Logger.Log(`dokRooms:${this.roomRef.name}`, `${creepClass.buildName} is first in queue`)

            // get the creep counter
            const creepCounter = this.dokScreepsRef.GetCreepCounter();

            // get initial creep building info
            const creepName = creepClass.buildName;
            const creepNameFull = `${creepName}:${creepCounter}`;
            const bodyStack = creepClass.BuildBodyStack(this.roomRef.controller?.level || 1, standbyEnergy);
            const startingMemory = creepClass.BuildInitialMemory({ fromRoom: this.roomRef.name });

            // spawn creep
            const spawnCode = spawn.spawnCreep(bodyStack, creepNameFull, {
                energyStructures: [spawn, ...extensions],
                memory: startingMemory
            });

            Logger.Log(`dokRooms:${this.roomRef.name}`, `Spawn request for ${creepClass.buildName} resulted in ${spawnCode}`)

            // bump the counter
            if (spawnCode === OK) {
                this.dokScreepsRef.BumpCreepCounter();

                const creepClassInstance = new creepClass(Game.creeps[creepNameFull], this.dokScreepsRef);

                this.dokScreepsRef.RegisterCreep(creepClassInstance);

                this.creepSpawnQueue.shift();

                this.ownedCreeps.push(creepClassInstance);
            }

            // update stored energy
            standbyEnergy = 0;

            for(const extension of extensions) {
                standbyEnergy += extension.store.energy;
            }
        }
    }

    public ScanRoom() {
        Logger.Log(`Room:${this.name}`, 'Scanning room, you may notice CPU spike.')

        // search for dropped resources here in the room
        const resources = this.roomRef.find(FIND_DROPPED_RESOURCES);

        for(const resource of resources) {
            this.AddPickupToHaulQueue(resource.id, resource.resourceType);
        }

        // search for ruins with resources
        const ruins = this.roomRef.find(FIND_RUINS);

        for(const ruin of ruins) {
            for(const ruinResource of Object.keys(ruin.store)) {
                this.AddPullToHaulQueue(ruin.id, ruinResource as ResourceConstant);
            }
        }

        // search for tombstones with resources
        const tombstones = this.roomRef.find(FIND_TOMBSTONES);

        for(const tombstone of tombstones) {
            for(const tombstoneResource of Object.keys(tombstone.store)) {
                this.AddPullToHaulQueue(tombstone.id, tombstoneResource as ResourceConstant);
            }
        }

        // search for construction sites
        const constructionSites = this.roomRef.find(FIND_CONSTRUCTION_SITES).filter(i => i.structureType === 'road' || i.structureType === 'container' || i.structureType === 'constructedWall');
        const personalConstructionSites = this.roomRef.find(FIND_MY_CONSTRUCTION_SITES);
        const totalConstructionSites = [...constructionSites, ...personalConstructionSites];

        for(const construction of totalConstructionSites) {
            this.AddConstructionProject(construction.id, construction.progressTotal);
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number) : boolean {
        if (typeof Game.rooms[this.name] === 'undefined') {
            Logger.Log(`Room:${this.name}`, 'Room is inactive, will not tick.')

            return false;
        }

        // track the last time we ticked here
        (Memory.rooms[this.name] as dokRoomMemory).lastActive = Game.time;

        // update room ref
        this.roomRef = Game.rooms[this.name];
        
        // monitor room health check every x ticks defined by settings
        if (tickNumber % Settings.roomCreepCheck == 0) {
            this.MonitorRoomCreeps();
        }

        if (tickNumber % Settings.roomCreepSpawn == 0) {
            this.MonitorSpawnCreeps();
        }

        if (tickNumber % Settings.roomScan === 0) {
            this.ScanRoom();
        }

        // do things on first tick here
        if (this.firstTick) {
            this.firstTick = false;

            this.ScanRoom();
        }

        return true;
    }

    public GetSeatsForItem(item: { id: string, pos: RoomPosition }) : number {
        return Seats.GetSeatsForItem(this.roomRef, item);
    }

    public AddPickupToHaulQueue(item: string, resource: ResourceConstant, priority: number = 3, itemPos: RoomPosition | null = null) {
        const existingEntry = this.haulQueue.find(i => i.item === item);

        if (typeof existingEntry !== 'undefined')
            return;

        let roomPosition = itemPos;

        if (roomPosition === null) {
            const itemLookup = Game.getObjectById(item) as Resource | Creep | Structure | Ruin;

            if (itemLookup === null)
                throw new Error(`Failed to add item ${item} to haul queue, could not find by id?`);

            roomPosition = itemLookup.pos;
        }

        Logger.Log(`HaulQueue:${this.name}`, `Haul pickup requested added to queue for item ${item}`)

        this.haulQueue.push({ item, itemPos: roomPosition, priority, resource, haulType: HaulType.Pickup, addedAt: Game.time });
    }

    public AddPullToHaulQueue(item: string, resource: ResourceConstant, priority: number = 3, itemPos: RoomPosition | null = null) {
        const existingEntry = this.haulQueue.find(i => i.item === item);

        if (typeof existingEntry !== 'undefined')
            return;

        let roomPosition = itemPos;

        if (roomPosition === null) {
            const itemLookup = Game.getObjectById(item) as Resource | Creep | Structure | Ruin;

            if (itemLookup === null)
                throw new Error(`Failed to add item ${item} to haul queue, could not find by id?`);

            roomPosition = itemLookup.pos;
        }

        Logger.Log(`HaulQueue:${this.name}`, `Haul pull requested added to queue for item ${item}`)

        this.haulQueue.push({ item, itemPos: roomPosition, priority, resource, haulType: HaulType.Pull, addedAt: Game.time });
    }

    public AddDeliveryToHaulQueue(item: string, resource: ResourceConstant, priority: number = 3, itemPos: RoomPosition | null = null) {
        const existingEntry = this.haulQueue.find(i => i.item === item);

        if (typeof existingEntry !== 'undefined')
            return;

        let roomPosition = itemPos;

        if (roomPosition === null) {
            const itemLookup = Game.getObjectById(item) as Resource | Creep | Structure | Ruin;

            if (itemLookup === null)
                throw new Error(`Failed to add item ${item} to haul queue, could not find by id?`);

            roomPosition = itemLookup.pos;
        }

        Logger.Log(`HaulQueue:${this.name}`, `Haul delivery requested added to queue for item ${item}`)

        this.haulQueue.push({ item, itemPos: roomPosition, priority, resource, haulType: HaulType.Deliver, addedAt: Game.time });
    }

    public SearchForDeliveryMatching(resource: ResourceConstant) {
        const deliveryRequests = this.haulQueue.filter(i => i.haulType === HaulType.Deliver && i.resource === resource);

        if (deliveryRequests.length === 0)
            return undefined;

        const deliveryRequest = deliveryRequests.shift();

        this.haulQueue = this.haulQueue.filter(i => i !== deliveryRequest);

        return deliveryRequest;
    }

    public PullFromHaulQueue() {
        const haulEntry = this.haulQueue.shift();

        if (typeof haulEntry !== 'undefined') {
            Logger.Log(`HaulQueue:${this.name}`, `Haul request ${haulEntry.item} has been pulled out of queue`);
        }

        return haulEntry;
    }

    public PullFromHaulQueueWithConstraint(resource : ResourceConstant) {
        const haulQueueConstrained = this.haulQueue.filter(i => i.resource === resource);

        if (haulQueueConstrained.length === 0) {
            return undefined;
        }

        const haulEntry = haulQueueConstrained.shift();

        // remove item from queue since we cloned array when we filtered
        this.haulQueue = this.haulQueue.filter(i => i !== haulEntry);

        if (typeof haulEntry !== 'undefined') {
            Logger.Log(`HaulQueue:${this.name}`, `Haul request ${haulEntry.item} has been pulled out of queue`);
        }

        return haulEntry;
    }

    public AddConstructionProject(item: string, points: number, priority: number = 3, itemPos: RoomPosition | null = null) {
        const existingEntry = this.constructionProjects.find(i => i.item === item);

        if (typeof existingEntry !== 'undefined')
            return;

        let roomPosition = itemPos;

        if (roomPosition === null) {
            const itemLookup = Game.getObjectById(item) as Resource | Creep | Structure | Ruin;

            if (itemLookup === null)
                throw new Error(`Failed to add item ${item} to haul queue, could not find by id?`);

            roomPosition = itemLookup.pos;
        }

        Logger.Log(`HaulQueue:${this.name}`, `Construction project added to queue for item ${item}`)

        this.constructionProjects.push({ item, itemPos: roomPosition, points, priority, addedAt: Game.time });
    }

    public PullFromConstructionQueue() {
        if (this.constructionProjects.length === 0)
            return undefined;

        const constructionProject = this.constructionProjects[0];

        if (typeof constructionProject !== 'undefined') {
            Logger.Log(`ConstructionQueue:${this.name}`, `Construction project ${constructionProject.item} has been pulled out of queue`);
        }

        return constructionProject;
    }

    public RemoveFromConstructionQueue(item: string) {
        this.constructionProjects = this.constructionProjects.filter(i => i.item !== item);
    }

    public QueueHaulRequest(request : HaulQueueEntry) {
        const existingEntry = this.haulQueue.find(i => i.item === request.item);

        if (typeof existingEntry !== 'undefined')
            return;

        const itemLookup = Game.getObjectById(request.item) as Resource | Creep | Structure | Ruin;

        if (itemLookup === null) {
            Logger.Log(`HaulQueue:${this.name}`, `Failed to add item ${request.item} to haul queue, could not find by id?`);

            return;
        }

        Logger.Log(`HaulQueue:${this.name}`, `Haul request directly added to queue for ${request.item}`)

        this.haulQueue.push(request);
    }
}