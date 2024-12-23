import { dokAttackerCreep } from "../creeps/Attacker";
import { dokBootstrapCreep } from "../creeps/Bootstrap";
import { ConstructionType, dokBuilderCreep, RoomConstructionEntry } from "../creeps/Builder";
import { dokCreep } from "../creeps/Creep";
import { dokDefenderCreep } from "../creeps/Defender";
import { dokEnergyMinerCreep } from "../creeps/EnergyMiner";
import { dokHaulerCreep, HaulQueueEntry, HaulType } from "../creeps/Hauler";
import { dokLinkKeeperCreep } from "../creeps/LinkKeeper";
import { dokRancherCreep } from "../creeps/Rancher";
import { dokServantCreep } from "../creeps/Servant";
import { dokSettlerCreep } from "../creeps/Settler";
import { Distance } from "../Distance";
import { dokScreeps } from "../dokScreeps";
import { dokFlag } from "../Flags";
import { Logger } from "../Logger";
import { RoomLimits } from "../RoomLimits";
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

export enum dokRoomType {
    Base = 'Base',
    Fortified = 'Fortified'
}

export interface dokRoomMemory {
    owned: boolean,
    owner: string | null,
    avoid: boolean,
    resources: dokRoomResource[],
    plans: any[],
    roomType: dokRoomType,
    constructionOverlay: boolean,

    scouted: boolean,
    scoutedAt: number,

    lastActive: number,

    constructionQueue: RoomConstructionEntry[],

    dokRoomUnpacked: true
}

export interface dokRoomSpawnEntry {
    creep: typeof dokCreep;
    room: string;
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
    private creepSpawnQueue: dokRoomSpawnEntry[] = [];
    private creepSpawnQueueStuck: number = 0;

    // what do we have to haul here?
    private haulQueue: HaulQueueEntry[] = [];

    // how many sources does this room have
    private sources: number = 0;

    // track hostiles in the room
    private hostiles: Array<Creep | PowerCreep> = [];

    // how many construction projects we have
    private constructionProjects: number = 0;
    private constructionProjectsProgress: number = 0;
    private constructionProjectsTracking: Array<{ id: string, type: StructureConstant }> = [];
    private constructionProjectsPlanned: Array<{ type: StructureConstant, pos: RoomPosition }> = [];
    private askedForHelp: boolean = false;

    // track our assigned flags
    private assignedFlags: dokFlag[] = [];

    // track if this is our first tick
    private firstTick: boolean = true;

    private towerLocks: { [id: string] : boolean } = {};
    private towerEnergySleep: { [id: string] : number } = {};

    private roomLinks: { id: string, type: number }[] = [];

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

        if (typeof (Memory.rooms[this.name] as dokRoomMemory) === 'undefined' || typeof (Memory.rooms[this.name] as dokRoomMemory).dokRoomUnpacked === 'undefined') {
            this.InitMemory();
        }

        // scan room resources, save them into storage if not
        if ((Memory.rooms[this.name] as dokRoomMemory).resources.length === 0) {
            (Memory.rooms[this.name] as dokRoomMemory).resources = [];

            this.ScanRoomResources();
        
        // if room already has scanned, set sources length from mem
        } else {
            this.sources = (Memory.rooms[this.name] as dokRoomMemory).resources.filter((i : dokRoomResource) => i.resourceType === ResourceType.Source).length;
        }

        // this was not here for initial room creation
        if (typeof (Memory.rooms[this.name] as dokRoomMemory).constructionQueue === 'undefined') {
            (Memory.rooms[this.name] as dokRoomMemory).constructionQueue = [];
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

    private InitMemory() {
        (Memory.rooms[this.name] as dokRoomMemory) = {
            owned: false,
            owner: null,
            avoid: false,
            resources: [],
            plans: [],
            constructionQueue: [],
            scouted: true,
            scoutedAt: Game.time,

            roomType: dokRoomType.Base,
            constructionOverlay: false,

            lastActive: Game.time,
            dokRoomUnpacked: true
        };
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

    private QueueForSpawn(creep: typeof dokCreep) {
        Logger.Log(`dokCreep:Spawn:${this.name}`, `${creep.buildName} has been queued for spawn`);

        this.creepSpawnQueue.push({ room: this.name, creep: creep });
    }

    private QueueForSpawnOnce(creep: typeof dokCreep) {
        const existingEntry = this.creepSpawnQueue.find(i => i.creep === creep && i.room === this.name);

        if (typeof existingEntry !== 'undefined')
            return;

        Logger.Log(`dokCreep:Spawn:${this.name}`, `${creep.buildName} has been queued for spawn`);

        this.creepSpawnQueue.push({ room: this.name, creep: creep });
    }

    private PriorityQueueForSpawnOnce(creep: typeof dokCreep) {
        const existingEntry = this.creepSpawnQueue.find(i => i.creep === creep && i.room === this.name);

        if (typeof existingEntry !== 'undefined')
            return;

        Logger.Log(`dokCreep:Spawn:${this.name}`, `${creep.buildName} has been queued for spawn with priority status`);

        this.creepSpawnQueue.unshift({ room: this.name, creep: creep });
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

        const roomMemory = (Memory.rooms[this.name] as dokRoomMemory);

        // get creep counts
        const bootstrapCreeps = this.ownedCreeps.filter(i => i.name.startsWith('bootstrap'));
        const energyMinerCreeps = this.ownedCreeps.filter(i => i.name.startsWith('energyminer'));
        const haulerCreeps = this.ownedCreeps.filter(i => i.name.startsWith('hauler'));
        const servantCreeps = this.ownedCreeps.filter(i => i.name.startsWith('servant'));
        const builderCreeps = this.ownedCreeps.filter(i => i.name.startsWith('builder'));
        const rancherCreeps = this.ownedCreeps.filter(i => i.name.startsWith('rancher'));
        const defenderCreeps = this.ownedCreeps.filter(i => i.name.startsWith('defender'));
        const linkKeeperCreeps = this.ownedCreeps.filter(i => i.name.startsWith('linkkeeper'));

        // check how many creeps that are not bootstrap creeps
        const nonBootstrapCreeps = this.ownedCreeps.filter(i => !i.name.startsWith('bootstrap'));

        // settler creeps require settler flags
        const settlerCreeps = this.ownedCreeps.filter(i => i.name.startsWith('settler'));
        const settlerFlags = this.assignedFlags.filter(i => i.flagRef?.color === COLOR_PURPLE);

        // attack creeps
        const attackCreeps = this.ownedCreeps.filter(i => i.name.startsWith('attacker'));
        const attackFlags = this.assignedFlags.filter(i => i.flagRef?.color === COLOR_RED);

        // construction projects
        const constructionProjects = roomMemory.constructionQueue.filter(i => i.constructionType === ConstructionType.Build);
        const repairProjects = roomMemory.constructionQueue.filter(i => i.constructionType === ConstructionType.Repair);

        // get structures
        const roomStructures = this.dokScreepsRef.GetStructuresByRoom(this.name);

        // get storages in room
        const storages = roomStructures.filter(i => i.structureType === 'storage');
        const links = roomStructures.filter(i => i.structureType === 'link');

        // get rcl
        const rcl = this.roomRef.controller?.level || 1;

        // do logic based on rcl
        if (rcl >= 2) {
            if (bootstrapCreeps.length < 1 && nonBootstrapCreeps.length === 0) {
                this.PriorityQueueForSpawnOnce(dokDefenderCreep);
                return;
            }

            if (this.hostiles.length > 0 && defenderCreeps.length < 4) {
                // double check we have enough energy producers before this action
                if (bootstrapCreeps.length > 0 || energyMinerCreeps.length > 0) {
                    this.PriorityQueueForSpawnOnce(dokDefenderCreep);
                }
            } else if (this.hostiles.length) {
                this.creepSpawnQueue = this.creepSpawnQueue.filter(i => i.creep !== dokDefenderCreep);
            }

            if (rancherCreeps.length < 1 && rcl < 5) {
                this.QueueForSpawnOnce(dokRancherCreep);
            }

            if (rancherCreeps.length < 2 && rcl >= 5) {
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

            // spawn based on construction projects
            if (builderCreeps.length < Math.floor((constructionProjects.length / 5) + 1) && constructionProjects.length > 0 && builderCreeps.length < 4) {
                this.QueueForSpawnOnce(dokBuilderCreep);
            }

            // spawn based on project points
            if (builderCreeps.length < Math.floor(this.constructionProjectsProgress / 5000) && constructionProjects.length > 0 && builderCreeps.length < 4) {
                this.QueueForSpawnOnce(dokBuilderCreep);
            }

            // spawn based on repair projects
            if (builderCreeps.length < 1 && repairProjects.length > 0) {
                this.QueueForSpawnOnce(dokBuilderCreep);
            }

            if (servantCreeps.length < (this.roomRef.controller?.level || 1) && servantCreeps.length < 3) {
                this.QueueForSpawnOnce(dokServantCreep);
            }
            
            if (haulerCreeps.length < Math.floor((this.haulQueue.length / 3) + 1) && this.haulQueue.length > 0 && haulerCreeps.length < 10) {
                this.QueueForSpawnOnce(dokHaulerCreep);
            }

            if (settlerCreeps.length < 1 && settlerFlags.length > 0) {
                this.QueueForSpawnOnce(dokSettlerCreep);
            }

            if (linkKeeperCreeps.length < 1 && storages.length > 0 && links.length >= 2) {
                this.QueueForSpawnOnce(dokLinkKeeperCreep);
            }

            if (attackCreeps.length < 1 * attackFlags.length && attackFlags.length > 0) {
                this.QueueForSpawnOnce(dokAttackerCreep);
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

        if (spawns.length === 0) {
            Logger.Log(`dokRooms:${this.roomRef.name}`, `This room has no spawns, will check if has constructions`);

            if (this.constructionProjects > 0) {
                Logger.Log(`dokRooms:${this.roomRef.name}`, `This room has no spawns, but has constructions. Will ask for help`);

                this.RequestRemoteRoomHelp();

                return;
            }

            return;
        }

        Logger.Log(`dokRooms:${this.roomRef.name}`, `Room spawn status, ${spawnsReady.length}/${spawns.length} ready`);

        const extensions = structures.filter(i => i.structureType === 'extension') as StructureExtension[];

        let standbyEnergy = 0;

        for(const extension of extensions) {
            standbyEnergy += extension.store.energy;
        }

        for (const spawn of spawns) {
            if (this.creepSpawnQueue.length === 0)
                break;

            const creepClass = this.creepSpawnQueue[0];

            if (typeof creepClass === 'undefined')
                break;

            Logger.Log(`dokRooms:${this.roomRef.name}`, `${creepClass.creep.buildName} is first in queue`)

            // get the creep counter
            const creepCounter = this.dokScreepsRef.GetCreepCounter();

            // get initial creep building info
            const creepName = creepClass.creep.buildName;
            const creepNameFull = `${creepName}:${creepCounter}`;
            const bodyStack = creepClass.creep.BuildBodyStack(this.roomRef.controller?.level || 1, standbyEnergy);
            const startingMemory = creepClass.creep.BuildInitialMemory({ fromRoom: creepClass.room });

            // spawn creep
            const spawnCode = spawn.spawnCreep(bodyStack, creepNameFull, {
                energyStructures: [spawn, ...extensions],
                memory: startingMemory
            });

            Logger.Log(`dokRooms:${this.roomRef.name}`, `Spawn request for ${creepClass.creep.buildName} resulted in ${spawnCode}`)

            // bump the counter
            if (spawnCode === OK) {
                this.dokScreepsRef.BumpCreepCounter();

                const creepClassInstance = new creepClass.creep(Game.creeps[creepNameFull], this.dokScreepsRef);

                this.dokScreepsRef.RegisterCreep(creepClassInstance);

                this.creepSpawnQueue.shift();

                this.ownedCreeps.push(creepClassInstance);
            } else if (spawnCode === -6 && this.creepSpawnQueue.length > 2) {
                this.creepSpawnQueueStuck++;
                if (this.creepSpawnQueueStuck > 5) {
                    const failedSpawn = this.creepSpawnQueue.shift();
                    const nextSpawn = this.creepSpawnQueue.shift();

                    if (typeof failedSpawn !== 'undefined' && typeof nextSpawn !== 'undefined') {
                        this.creepSpawnQueue = [ nextSpawn, failedSpawn, ...this.creepSpawnQueue];

                        this.creepSpawnQueueStuck = 0;

                        Logger.Log(`dokRooms:${this.roomRef.name}`, `Spawn queue seemed stuck, doing first shuffle`);
                    }
                }
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

        // reset construction projects progress
        this.constructionProjectsProgress = 0;

        for(const construction of totalConstructionSites) {
            this.AddConstructionProject(construction.id, construction.progressTotal);

            this.constructionProjectsProgress = this.constructionProjectsProgress + (construction.progressTotal - construction.progress);
        }

        // total up our construction projects
        this.constructionProjects = totalConstructionSites.length;

        // keep track of our construction projects
        this.constructionProjectsTracking = totalConstructionSites.map(i => { return { id: i.id, type: i.structureType } });

        // TODO: need to run health checks on build structures, add a repair instruction for builders or a new creep class
        const ownedStructures = this.dokScreepsRef.GetStructuresByRoom(this.name);
        const publicStructures = this.roomRef.find(FIND_STRUCTURES);

        const structures = [...ownedStructures, ...publicStructures];

        for(const structure of structures) {
            // queue objects for repairs
            if (structure.structureType === 'constructedWall') {
                if (structure.hits < 1000) {
                    this.QueueRepairStructure(structure.id, 2000, 3);

                    continue;
                }

                // when we hit rcl 5, start beefing walls up in batches
                if (this.roomRef.controller?.level || 0 >= 5) {
                    if (structure.hits < structure.hitsMax * 0.0092) {
                        this.QueueRepairStructure(structure.id, structure.hitsMax + 2000, 4);
    
                        continue;
                    }
                }

                if (structure.hits < structure.hitsMax * 0.0032) {
                    this.QueueRepairStructure(structure.id, structure.hitsMax * 0.0032, 4);

                    continue;
                }
                
                continue;
            } else if (structure.structureType === 'rampart') {
                if (structure.hits < structure.hitsMax * 0.40) {
                    this.QueueRepairStructure(structure.id, structure.hitsMax * 0.50, 4);
                }

                continue;
            } else if (structure.structureType === 'container') {
                if (structure.hits < structure.hitsMax * 0.50) {
                    this.QueueRepairStructure(structure.id, structure.hitsMax, 3); 
                }

                continue;
            } else if (structure.hits < structure.hitsMax * 0.90) {
                this.QueueRepairStructure(structure.id, structure.hitsMax, 2); 
            }
        }

        // check room for links
        const links = structures.filter(i => i.structureType === 'link');
        const storage = structures.find(i => i.structureType === 'storage');

        if (this.roomLinks.length !== links.length && typeof storage !== 'undefined') {
            this.roomLinks = [];

            for(const link of links) {
                const distance = Distance.GetDistance(link.pos, storage.pos);

                let linkType = 1;

                if (distance <= 2) {
                    linkType = 0;
                }

                this.roomLinks.push({ id: link.id, type: linkType });

                Logger.Log(`RoomScan:${this.name}:LinkCheck`, `Link ${link.id} is link type ${linkType}`)
            }
        }

        // get extensions
        /*const extensions = structures.filter(i => i.structureType === 'extension') as StructureExtension[];
        const extensionsEmpty = extensions.filter(i => i.store.energy === 0);

        if (extensions.length > 0 && extensionsEmpty.length >= extensions.length * 0.5) {
            Logger.Warn(`RoomScan:${this.name}:ExtensionCheck`, `${extensionsEmpty.length}/${extensions.length} are empty, requesting haulers to help out`);
            
            for(const extensionEmpty of extensionsEmpty) {
                this.AddDeliveryToHaulQueue(extensionEmpty.id, 'energy');
            }
        }*/
        
        // get our assigned flags
        this.assignedFlags = this.dokScreepsRef.GetAssignedFlags(this.name);
    }

    public ScanRoomForHostiles() {
        const hostileCreeps = this.roomRef.find(FIND_CREEPS).filter(i => i.owner.username !== Settings.username);
        const hostilePowerCreeps = this.roomRef.find(FIND_POWER_CREEPS).filter(i => i.owner.username !== Settings.username);

        this.hostiles = [...hostileCreeps, ...hostilePowerCreeps];
    }

    public DoTowerTick() {
        const towers = this.dokScreepsRef.GetStructuresByRoom(this.name).filter(i => i.structureType === 'tower') as StructureTower[];

        let hostileTargetRotation = 0;
        let repairOrderRotation = 0;

        const debugTowerVisual = new RoomVisual(this.name);

        for(const tower of towers) {
            if (typeof this.towerEnergySleep[tower.id] === 'undefined') {
                this.towerEnergySleep[tower.id] = 0;
                this.towerLocks[tower.id] = false;
            }

            if (tower.store.energy === 0) {
                debugTowerVisual.text('🪫', tower.pos);

                this.AddDeliveryToHaulQueue(tower.id, 'energy', 0);

                continue;
            }

            // blast hostiles
            if (this.hostiles.length > 0) {
                const hostileTarget = this.hostiles[hostileTargetRotation];

                const blastCode = tower.attack(hostileTarget);

                debugTowerVisual.line(tower.pos, hostileTarget.pos, { color: 'rgba(255, 0, 0, 0.5)' });
                debugTowerVisual.circle(hostileTarget.pos, { fill: 'rgba(255, 0, 0, 0.5)', radius: 0.8 });
                debugTowerVisual.text('💣', hostileTarget.pos);

                if (blastCode === 0) {
                    hostileTargetRotation++;
                    if (hostileTargetRotation >= this.hostiles.length) {
                        hostileTargetRotation = 0;
                    }
                }

                continue;
            }

            if (this.towerLocks[tower.id]) {
                if (tower.store.energy < tower.store.getCapacity('energy')) {
                    debugTowerVisual.text('🔋🔒', tower.pos, { opacity: 0.8 });

                    if (this.towerEnergySleep[tower.id] > 10) {
                        this.AddDeliveryToHaulQueue(tower.id, 'energy', 3);

                        this.towerEnergySleep[tower.id] = 0;
                    }
                    this.towerEnergySleep[tower.id]++;

                    return;
                } else {
                    this.towerLocks[tower.id] = false;
                }
            }

            if (tower.store.energy < tower.store.getCapacity('energy') * 0.75) {
                debugTowerVisual.text('😴', tower.pos, { opacity: 0.8 });

                this.AddDeliveryToHaulQueue(tower.id, 'energy', 3);

                this.towerLocks[tower.id] = true;

                continue;
            }

            const roomCriticalStructures = this.dokScreepsRef.GetStructuresByRoom(this.name).filter(i => i.hits < i.hitsMax * 0.10).sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax );

            if (roomCriticalStructures.length > 0) {
                const criticalStructure = roomCriticalStructures[0];

                debugTowerVisual.line(tower.pos, criticalStructure.pos, { color: 'rgba(255, 99, 71, 0.5)' });
                debugTowerVisual.circle(criticalStructure.pos, { fill: 'rgba(255, 99, 71, 0.5)', radius: 0.8 });
                debugTowerVisual.text('🔨⚠️', criticalStructure.pos);

                const blastCode = tower.repair(criticalStructure);

                return;
            } 

            // do structure repairs from construction queue
            const roomMemory = Memory.rooms[this.name] as dokRoomMemory;
            const repairOrders = roomMemory.constructionQueue.filter(i => i.constructionType === ConstructionType.Repair && i.itemPos.roomName === this.name).sort((a, b) => a.priority - b.priority);

            if (repairOrders.length > 0) {
                const repairTargetOrder = repairOrders[repairOrderRotation];
                const repairTarget = Game.getObjectById(repairTargetOrder.item) as Structure;

                if (repairTarget === null) {
                    this.RemoveFromConstructionQueue(repairTargetOrder.item);

                    continue;
                }

                if (repairTarget.hits >= repairTarget.hitsMax || repairTarget.hits >= repairTargetOrder.points) {
                    this.RemoveFromConstructionQueue(repairTargetOrder.item);

                    continue;
                }

                debugTowerVisual.line(tower.pos, repairTarget.pos, { color: 'rgba(255, 165, 0, 0.5)' });
                debugTowerVisual.circle(repairTarget.pos, { fill: 'rgba(255, 165, 0, 0.5)', radius: 0.8 });
                debugTowerVisual.text('🔨', repairTarget.pos);

                const blastCode = tower.repair(repairTarget);

                if (blastCode === 0) {
                    repairOrderRotation++;
                    if (repairOrderRotation >= repairOrders.length) {
                        repairOrderRotation = 0;
                    }
                }

                return;
            }
        }
    }

    public DoConstructionPlanning(rcl : number | undefined) : Array<{ type: StructureConstant, pos: RoomPosition }> {
        return [];
    }

    public DoConstructionOverlay() {
        const debugOverlay = new RoomVisual(this.name);

        // do not draw visuals if room is a base room
        if (typeof (Memory.rooms[this.name] as dokRoomMemory).roomType === 'undefined' || (Memory.rooms[this.name] as dokRoomMemory).roomType === dokRoomType.Base) {
            debugOverlay.text(`WARNING: Room ${this.name} does not have a room type set.`, 0, 49, { backgroundColor: 'black', color: 'orange', align: 'left' })

            return;
        }

        // should we overlay construction plans
        if (typeof (Memory.rooms[this.name] as any).constructionOverlay !== 'undefined' && (Memory.rooms[this.name] as any).constructionOverlay === true) {
            this.constructionProjectsPlanned.forEach(i => {

            });
        }
    }

    public DoConstructionTick() {
        return;
    }

    public GetAssignedFlags() {
        return this.assignedFlags;
    }

    public GetHostiles() {
        return this.hostiles;
    }

    public GetKnownLinks() {
        return this.roomLinks;
    }

    public DoLinkTransfer() {
        const mainLinkStub = this.roomLinks.find(i => i.type === 0);

        if (typeof mainLinkStub === 'undefined')
            return;

        const mainLink = Game.getObjectById(mainLinkStub.id) as StructureLink;

        if (mainLink === null)
            return;

        let energyTransfer = 0;

        for(const linkStub of this.roomLinks) {
            if (mainLinkStub.id === linkStub.id)
                continue;

            const link = Game.getObjectById(linkStub.id) as StructureLink;

            if (link === null)
                continue;

            if (link.store.energy === 0)
                continue;

            link.transferEnergy(mainLink);

            mainLink.store.energy += link.store.energy;
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number) : boolean {
        if (typeof Game.rooms[this.name] === 'undefined') {
            return false;
        }

        // memory checking
        if (typeof (Memory.rooms[this.name] as dokRoomMemory) === 'undefined') {
            this.InitMemory();
        }

        // track the last time we ticked here
        (Memory.rooms[this.name] as dokRoomMemory).lastActive = Game.time;

        // update room ref
        this.roomRef = Game.rooms[this.name];

        this.DoConstructionOverlay();

        // defend against hostiles
        if (tickNumber % Settings.roomHostileScan) {
            this.ScanRoomForHostiles();
        }

        // do tower tick regardless
        this.DoTowerTick();
        
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

        if (tickNumber % 50) {
            this.DoLinkTransfer();
        }

        if (tickNumber % Settings.roomConstructionTick) {
            this.DoConstructionTick();
        }

        // do things on first tick here
        if (this.firstTick) {
            this.firstTick = false;

            this.ScanRoom();
        }

        return true;
    }

    public TickEssential(tickNumber: number, instanceTickNumber: number) {
        if (tickNumber % Settings.roomHostileScan) {
            this.ScanRoomForHostiles();
        }

        // do tower tick regardless
        this.DoTowerTick();
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

        this.haulQueue.push({ item, itemPos: roomPosition, priority, resource, haulType: HaulType.Pull, addedAt: Game.time });

        this.haulQueue = this.haulQueue.sort((a, b) => a.priority - b.priority);
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

        this.haulQueue.push({ item, itemPos: roomPosition, priority, resource, haulType: HaulType.Deliver, addedAt: Game.time });

        this.haulQueue = this.haulQueue.sort((a, b) => a.priority - b.priority);
    }

    public SearchForPickupMatching(resource: ResourceConstant) {
        const deliveryRequests = this.haulQueue.filter(i => i.haulType === HaulType.Pickup && i.resource === resource || i.haulType === HaulType.Pull && i.resource === resource);

        if (deliveryRequests.length === 0)
            return undefined;

        const deliveryRequest = deliveryRequests.shift();

        this.haulQueue = this.haulQueue.filter(i => i !== deliveryRequest);

        return deliveryRequest;
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

        return haulEntry;
    }

    public AddConstructionProject(item: string, points: number, priority: number = 3, itemPos: RoomPosition | null = null) {
        const roomMemory = Memory.rooms[this.name] as dokRoomMemory;
        
        const existingEntry = roomMemory.constructionQueue.find(i => i.item === item);

        if (typeof existingEntry !== 'undefined')
            return;

        let roomPosition = itemPos;

        if (roomPosition === null) {
            const itemLookup = Game.getObjectById(item) as Resource | Creep | Structure | Ruin;

            if (itemLookup === null)
                throw new Error(`Failed to add item ${item} to haul queue, could not find by id?`);

            roomPosition = itemLookup.pos;
        }

        roomMemory.constructionQueue.push({ item, itemPos: roomPosition, points, priority, addedAt: Game.time, constructionType: ConstructionType.Build });

        roomMemory.constructionQueue = roomMemory.constructionQueue.sort((a, b) => a.priority - b.priority);
    }

    public QueueRepairStructure(item: string, points: number, priority: number = 3, itemPos: RoomPosition | null = null) {
        const roomMemory = Memory.rooms[this.name] as dokRoomMemory;
        
        const existingEntry = roomMemory.constructionQueue.find(i => i.item === item);

        if (typeof existingEntry !== 'undefined')
            return;

        let roomPosition = itemPos;

        if (roomPosition === null) {
            const itemLookup = Game.getObjectById(item) as Resource | Creep | Structure | Ruin;

            if (itemLookup === null)
                throw new Error(`Failed to add item ${item} to haul queue, could not find by id?`);

            roomPosition = itemLookup.pos;
        }

        roomMemory.constructionQueue.push({ item, itemPos: roomPosition, points, priority, addedAt: Game.time, constructionType: ConstructionType.Repair });

        roomMemory.constructionQueue = roomMemory.constructionQueue.sort((a, b) => a.priority - b.priority);
    }

    public PullFromConstructionQueue() {
        const roomMemory = Memory.rooms[this.name] as dokRoomMemory;

        if (roomMemory.constructionQueue.length === 0)
            return undefined;

        const constructionProject = roomMemory.constructionQueue[0];

        return constructionProject;
    }

    public RemoveFromConstructionQueue(item: string) {
        const roomMemory = Memory.rooms[this.name] as dokRoomMemory;
        const constructionQueue = roomMemory.constructionQueue.filter(i => i.item !== item);

        (Memory.rooms[this.name] as dokRoomMemory).constructionQueue = constructionQueue;
    }

    public ClearConstructionQueue() {
        (Memory.rooms[this.name] as dokRoomMemory).constructionQueue = [];
    }

    public QueueHaulRequest(request : HaulQueueEntry) {
        const existingEntry = this.haulQueue.find(i => i.item === request.item);

        if (typeof existingEntry !== 'undefined')
            return;

        const itemLookup = Game.getObjectById(request.item) as Resource | Creep | Structure | Ruin;

        if (itemLookup === null) {
            Logger.Error(`HaulQueue:${this.name}`, `Failed to add item ${request.item} to haul queue, could not find by id?`);

            return;
        }

        this.haulQueue.push(request);
    }

    private CommandeerSpawn(creep : typeof dokCreep, room : string) {
        Logger.Log(`Room:${this.name}`, `Will spawn ${creep.buildName} for room ${room}`);

        const existingEntry = this.creepSpawnQueue.find(i => i.creep === creep && i.room === room);

        if (typeof existingEntry !== 'undefined')
            return;

        this.creepSpawnQueue.push({ room: room, creep: creep });
    }

    private RequestRemoteRoomHelp() {
        if (this.askedForHelp && this.ownedCreeps.length > 0)
            return;

        const ownedRooms = this.dokScreepsRef.GetRooms().filter(i => i.state === RoomState.Controlled && i.name !== this.name).filter(i => {
            return this.dokScreepsRef.GetStructuresByRoom(i.name).filter(i => i.structureType === 'spawn').length > 0;
        });

        if (ownedRooms.length === 0) {
            Logger.Log(`Room:${this.name}`, `Could not ask for help, no other rooms!`);

            return;
        }

        let closerRoom = null;

        if (ownedRooms.length === 1) {
            Logger.Log(`Room:${this.name}`, `Only one other room, will beg for help from them.`);

            closerRoom = ownedRooms[0];
        }

        if (closerRoom === null) {
            const closerRooms = ownedRooms.sort((a, b) => Game.map.getRoomLinearDistance(a.name, this.name) - Game.map.getRoomLinearDistance(b.name, this.name));

            closerRoom = closerRooms[0];
        }

        if (!this.askedForHelp) {
            const constructionProjects = this.roomRef.find(FIND_CONSTRUCTION_SITES);

            for(const construction of constructionProjects) {
                closerRoom.AddConstructionProject(construction.id, construction.progressTotal, 2, construction.pos);
            }
    
            this.askedForHelp = true;
        }

        if (this.ownedCreeps.length === 0) {
            Logger.Log(`Room:${this.name}`, `Will ask ${closerRoom.name} to spawn ${dokBootstrapCreep.buildName}`);

            closerRoom.CommandeerSpawn(dokBootstrapCreep, this.name);
        }
    }
}