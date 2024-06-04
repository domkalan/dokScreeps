import dokCreep, { dokCreepJob, dokCreepMemory } from "./creeps/Base";
import dokCreepColonizer from "./creeps/Colonizer";
import dokCreepConstructionWorker from "./creeps/ConstructionWorker";
import dokCreepControllerSlave from "./creeps/ControllerSlave";
import dokCreepDefender from "./creeps/Defender";
import { dokCreepFactoryWorker } from "./creeps/FactoryWorker";
import dokCreepPowerHauler from "./creeps/Hauler";
import { dokCreepHealer } from "./creeps/Healer";
import dokCreepHeavyMiner from "./creeps/HeavyMiner";
import dokCreepLinkStorageSlave from "./creeps/LinkStorageSlave";
import dokCreepOffenseCreep from "./creeps/OffenseCreep";
import dokCreepPowerMiner from "./creeps/PowerMiner";
import dokCreepRemoteConstruction from "./creeps/RemoteConstruction";
import dokCreepRemoteMiner from "./creeps/RemoteMiner";
import dokCreepRoadBuilder from "./creeps/RoadBuilder";
import dokRoom from "./dokRoom";

export type dokUtilMemory = {
    ticks: number;

    locks: Array<{ item: string, creep: string }>;
    seats: Array<{ item: string, seats: number }>;
}

export interface dokUtilCacheResource {
    room: string;
    filter: any;
    resources: any[];
    addedAt: number;
}

export interface dokUtilPlots {
    pos: RoomPosition
    code: number
    object: null | Terrain | Structure | StructureConstant
}

export interface dokUtilPosition {
    x: number;
    y: number;
    room: string;
}

export interface dokUtilAutoRoad {
    pos: RoomPosition,
    built: boolean
}

export interface dokUtilRCLLimit {
    roads: number;
    containers: number;
    spawns: number;
    extensions: number;
    ramparts: number;
    walls: number;
    towers: number;
    storage: number;
    links: number;
    extractor: number;
    labs: number;
    terminal: number;
    factory: number;
    observer: number;
    powerspawn: number;
    nuker: number;
}

export interface dokUtilItemSeats {
    item: string,
    seats: number
}

export interface dokUtilPathing {
    used: number;
    created: number;
    lastUsed: number;

    from: dokUtilPosition;
    to: dokUtilPosition;
    path: PathStep[];
}

export default class dokUtil {
    private rooms: Array<dokRoom>;
    private creeps: Array<dokCreep>;
    private memory: dokUtilMemory;

    // keep track of how long this instace has been alive
    private ticksAlive: number = 0;

    private lastCreepTicked: number = 0;

    private pathing: Array<dokUtilPathing> = [];

    private cachedResource: Array<dokUtilCacheResource> = [];

    private conditionalTickingBase: number = 0;

    constructor() {
        this.memory = this.ReadMemory();
        this.creeps = this.GetCreeps();
        this.rooms = this.GetRooms();

        console.log(`[dokUtil] started at ${new Date(Date.now()).toString()}`)
    }

    private ReadMemory() {
        if (this.memory)
            return this.memory;

        if (typeof (Memory as any)['dokUtil'] === 'undefined') {
            this.memory = {
                ticks: 0,
                locks: [],
                seats: []
            };

            return (Memory as any)['dokUtil'] as dokUtilMemory;
        }

        this.memory = (Memory as any)['dokUtil'];

        return this.memory;
    }

    private SaveMemory() {
        (Memory as any)['dokUtil'] = this.memory;
    }

    private GetCreeps() {
        const creepArray: Array<dokCreep> = [];

        for(const creepKey in Game.creeps) {
            const creep = Game.creeps[creepKey];

            // Only tick on our own spawns
            if (!creep.my) {
                continue;
            }

            creepArray.push(this.ParseCreep(creepKey));
        }

        return creepArray;
    }

    private ParseCreep(creepKey: string) {
        const creep = Game.creeps[creepKey];
        const creepMemory: dokCreepMemory = Memory.creeps[creepKey] as any || {};

        let creepInstance : dokCreep;

        switch(creepMemory.job) {
            case dokCreepJob.Base:
                creepInstance = new dokCreep(this, creep);

                break;
            case dokCreepJob.RoadBuilder:
                creepInstance = new dokCreepRoadBuilder(this, creep);

                break;
            case dokCreepJob.HeavyMiner:
                creepInstance = new dokCreepHeavyMiner(this, creep);

                break;
            case dokCreepJob.ControllerSlave:
                creepInstance = new dokCreepControllerSlave(this, creep);

                break;
            case dokCreepJob.Colonizer:
                creepInstance = new dokCreepColonizer(this, creep);

                break;
            case dokCreepJob.ConstructionWorker:
                creepInstance = new dokCreepConstructionWorker(this, creep);

                break;
            case dokCreepJob.RoomDefender:
                creepInstance = new dokCreepDefender(this, creep);

                break;
            case dokCreepJob.LinkStorageSlave:
                creepInstance = new dokCreepLinkStorageSlave(this, creep);

                break;
            case dokCreepJob.RemoteMiner:
                creepInstance = new dokCreepRemoteMiner(this, creep);

                break;
            case dokCreepJob.RemoteConstruction:
                creepInstance = new dokCreepRemoteConstruction(this, creep);

                break;
            case dokCreepJob.Healer:
                creepInstance = new dokCreepHealer(this, creep);

                break;
            case dokCreepJob.PowerMiner:
                creepInstance = new dokCreepPowerMiner(this, creep);

                break;
            case dokCreepJob.RoomAttacker:
                creepInstance = new dokCreepOffenseCreep(this, creep);

                break;
            case dokCreepJob.PowerHauler:
                creepInstance = new dokCreepPowerHauler(this, creep);

                break;
            case  dokCreepJob.FactoryWorker:
                creepInstance = new dokCreepFactoryWorker(this, creep);

                break;
            default:
                creepInstance = new dokCreep(this, creep);

                break;
        }

        return creepInstance;
    }

    public AddCreepToRuntime(creepKey: string) {
        const creep = this.ParseCreep(creepKey);

        this.creeps.push(creep);
    }

    public RemoveCreepFromRuntime(creep: dokCreep) {
        this.creeps = this.creeps.filter(i => i !== creep);
    }

    private GetRooms() {
        const roomArray: Array<dokRoom> = [];

        for(const roomKey in Game.rooms) {
            const room = Game.rooms[roomKey];

            if (room.controller?.owner?.username !== 'dokman')
                continue;

            const roomInstance = new dokRoom(this, room);

            roomArray.push(roomInstance);
        }

        return roomArray;
    }

    public RefreshRooms() {
        this.rooms = this.GetRooms();
    }

    public GetKnownCreeps() {
        return this.creeps;
    }

    public GetManagedRooms() {
        return this.rooms;
    }

    public GetTickCount() {
        return this.memory.ticks;
    }

    public GetInstanceAliveTicks() {
        return this.ticksAlive;
    }

    public RunEveryTicks(num : number) {
        return this.memory.ticks % num == 0;
    }

    public RunEveryAliveTicks(num : number) {
        return this.ticksAlive % num == 0;
    }

    public PlaceLock(item: { id: string }, creep: dokCreep) {
        if (typeof this.memory.locks === 'undefined') {
            this.memory.locks = [];
        };

        if (this.memory.locks.filter(i => i.creep === creep.GetId() && i.item === item.id).length > 0)
            return true;

        this.memory.locks.push({ item: item.id, creep: creep.GetId() });

        return true;
    }

    public GetLocks(item: { id: string }) {
        if (typeof this.memory.locks === 'undefined') {
            return []
        };

        return this.memory.locks.filter(i => i.item === item.id);
    }

    public GetLocksWithoutMe(item: { id : string }, creep : dokCreep) {
        return this.memory.locks.filter(i => i.item === item.id && i.creep !== creep.GetId());
    }

    public ReleaseLocks(creep: dokCreep) {
        if (typeof this.memory.locks === 'undefined') {
            return true;
        };

        this.memory.locks = this.memory.locks.filter(i => i.creep !== creep.GetId())
    }

    public RemoveDeadLocks() {
        let cleanedLocks = 0;

        if (typeof this.memory.locks !== 'undefined') {
            this.memory.locks = this.memory.locks.filter(lock => {
                const creep = this.creeps.find(i => i.GetId() === lock.creep);

                if (typeof creep === 'undefined') {
                    cleanedLocks++;
                    return false;
                }
                
                return true;
            })
        }

        console.log(`[dokUtil][locks] ${cleanedLocks} ghost lock(s) have been cleaned`)
    }

    public GetSeatsForItem(room: Room, item: { id: string, pos: RoomPosition }) : number {
        if (typeof this.memory.seats === 'undefined') {
            this.memory.seats = [];
        }

        const locksItem = this.memory.seats.find(i => i.item === item.id);

        if (typeof locksItem === 'undefined') {
            const slotsOnItem = dokUtil.GetFreeSlots(room, item, 1, 0, ['swamp', 'road']);

            slotsOnItem.forEach(i => {
                if (i.code === 0) {
                    new RoomVisual(room.name).circle(i.pos.x, i.pos.y, { fill: '#000000', opacity: 0.1 });

                    return;
                }

                new RoomVisual(room.name).circle(i.pos.x, i.pos.y, { fill: '#ff4f00' });
            });

            const seatsOnItem = slotsOnItem.filter(i => i.code === 1);

            console.log(`[dokUtil] item ${item.id} in room ${room.name} has ${seatsOnItem.length} seat(s)`)

            this.memory.seats.push({ item: item.id, seats: seatsOnItem.length });

            return seatsOnItem.length;
        }

        return locksItem.seats;
    }

    public GetSuggestedPath(pos1: RoomPosition, pos2: RoomPosition, opts: { ignoreCreeps?: boolean, ignoreRoads?: boolean } = { ignoreCreeps: false, ignoreRoads: false }) : dokUtilPathing {
        const timeNow = Math.floor(Date.now() / 1000);

        const pos1dp = dokUtil.convertPosToDokPos(pos1);
        const pos2dp = dokUtil.convertPosToDokPos(pos2);

        const existingPath = this.pathing.find(i => (i.from === pos1dp && i.to === pos2dp) || (i.from === pos2dp && i.to === pos1dp));

        if (typeof existingPath !== 'undefined') {
            existingPath.lastUsed = timeNow;
            existingPath.used++;

            return existingPath;
        }
            
        // generate new path
        const gamePath = pos2.findPathTo(pos1, { 
            ignoreCreeps: opts.ignoreCreeps,
            /*ignoreRoads: opts.ignoreRoads*/
        });

        const dokPath: dokUtilPathing = {
            created: timeNow,
            lastUsed: timeNow,
            used: 1,

            to: pos1dp,
            from: pos2dp,
            path: gamePath
        };

        this.pathing.push(dokPath);

        return dokPath;
    }

    protected CleanUnusedPaths() {
        if (!this.RunEveryTicks(50))
            return;

        if (this.pathing.length >= this.rooms.length * 200) {
            this.pathing = [];

            Game.notify(`Pathing reset due to value being at or above 300 stored paths.`);

            console.log(`[dokUtil][pathing] all paths have been cleared`);

            return;
        }

        const expiredTime = Math.floor(Date.now() / 1000) - 300;
        
        const pathsBefore = this.pathing.length;

        this.pathing = this.pathing.filter(i => i.lastUsed > expiredTime);

        const pathsAfter = this.pathing.length;
        const cleanedPaths = (pathsBefore - pathsAfter);

        if (cleanedPaths > 0) {
            console.log(`[dokUtil][pathing] ${cleanedPaths} path(s) have been cleaned`);
        }
    }

    private TickCreeps() {
        if (typeof Game.flags['SkipCreepTick'] !== 'undefined')
            return;

        // if low on CPU, do conditional ticking
        if (Game.cpu.bucket <= 500) {
            const attackingCreeps = this.creeps.filter(i => [dokCreepJob.RoomAttacker, dokCreepJob.RoomDefender].includes(i.GetJob()));

            if (attackingCreeps.length > 0) {
                this.conditionalTickingBase++;

                if (this.conditionalTickingBase > 10) {
                    this.conditionalTickingBase = 0;

                    console.log(`[dokUtil] conditional ticking on base creeps only`);

                    const baseCreeps = this.creeps.filter(i => i.GetJob() === dokCreepJob.Base);

                    for(const creep of baseCreeps) {
                        try {
                            creep.Tick();
                        }
                        catch(e) {
                            console.log(`[dokUtil][Creep] Failed to tick creep:${creep.GetName()}, error:\n${e}\n\nFlushing memory`);
            
                            this.creeps = this.creeps.filter(i => i !== creep);
                        }
                    }
                }

                console.log(`[dokUtil] conditional ticking on attacking creeps only`);

                for(const creep of attackingCreeps) {
                    try {
                        creep.Tick();
                    }
                    catch(e) {
                        console.log(`[dokUtil][Creep] Failed to tick creep:${creep.GetName()}, error:\n${e}\n\nFlushing memory`);
        
                        this.creeps = this.creeps.filter(i => i !== creep);
                    }
                }

                return;
            }

            const limitCreepTicks = Math.floor(this.creeps.length / Game.gcl.level);
            let creepsTicked = 0;

            console.log(`[dokUtil] conditional ticking on creeps ${this.lastCreepTicked} - ${this.lastCreepTicked + limitCreepTicks} in batches of ${limitCreepTicks}`)

            while(true) {
                try {
                    this.creeps[this.lastCreepTicked].Tick();
                    this.lastCreepTicked++;
                }
                catch(e) {
                    console.log(`[dokUtil] Failed to tick creep:${this.creeps[this.lastCreepTicked].GetName()}, error:\n${e}\n\nRemoved from creep array`);
    
                    this.creeps = this.creeps.filter(i => i !== this.creeps[this.lastCreepTicked]);
                }

                if (this.lastCreepTicked >= this.creeps.length - 1)
                    this.lastCreepTicked = 0;

                // keep track of how many we are ticking
                creepsTicked++;
                if (creepsTicked >= limitCreepTicks)
                    break;
            }

            return;
        }

        if (typeof Game.flags['SkipNonAttackCreepTick'] !== 'undefined') {
            this.creeps.filter(i => i.GetJob() === dokCreepJob.RoomAttacker).forEach(creep => {
                try {
                    creep.Tick();
                }
                catch(e) {
                    console.log(`[dokUtil][Creep] Failed to tick creep:${creep.GetName()}, error:\n${e}\n\nFlushing memory`);
    
                    this.creeps = this.creeps.filter(i => i !== creep);
                }
            })
        }

        this.creeps.forEach(creep => {
            try {
                creep.Tick();
            }
            catch(e) {
                console.log(`[dokUtil][Creep] Failed to tick creep:${creep.GetName()}, error:\n${e}\n\nFlushing memory`);

                this.creeps = this.creeps.filter(i => i !== creep);
            }
        })
    }

    private TickRooms() {
        if (typeof Game.flags['SkipRoomTick'] !== 'undefined')
            return;

        this.rooms.forEach(room => {
            room.Tick();
        });
    }

    private BumpCounters() {
        if (typeof this.memory.ticks === 'undefined') {
            this.memory.ticks = 0;
        }

        this.memory.ticks++;
        this.ticksAlive++;
    }

    public FindResource<T>(room: Room, filterBy: FindConstant, cacheAge: number = 4) : Array<T> {
        const cached = this.cachedResource.find(i => i.room === room.name && i.filter === filterBy && i.addedAt + cacheAge > this.memory.ticks);

        if (typeof cached !== 'undefined') {
            return cached.resources as Array<T>;
        }

        const searchResults = room.find(filterBy);

        this.cachedResource.push({
            room: room.name,
            filter: filterBy,
            resources: searchResults,
            addedAt: this.memory.ticks
        });

        this.cachedResource = this.cachedResource.filter(i => i.addedAt + 4 > this.memory.ticks);

        return searchResults as Array<T>;
    }

    public GetDokRoom(name: string) : dokRoom | undefined {
        return this.rooms.find(i => i.GetName() === name);
    }

    public GetDokRooms() {
        return this.rooms;
    }

    public GetDokCreeps() {
        return this.creeps;
    }

    public GetDokCreep(id: string) {
        return this.creeps.find(i => i.GetId() === id);
    }

    public CleanDeadMemory() {
        if (!this.RunEveryTicks(100))
            return;

        // Clean dead creeps memory
        for(const creepMemKey in Memory.creeps) {
            if (typeof Game.creeps[creepMemKey] === 'undefined') {
                delete Memory.creeps[creepMemKey];
            }
        }

        this.RemoveDeadLocks();
    }

    public GetFlagArray() {
        const flagArray : Array<Flag> = [];

        for(const flagKey in Game.flags) {
            const flag = Game.flags[flagKey];

            flagArray.push(flag);
        }

        return flagArray;
    }

    public RunScanOnRoom(room: Room, creepScanning: dokCreep) {
        console.log(`[dokUtil] running room scan on ${room.name}`);

        const roomFlags = this.GetFlagArray();
        const roomFlagNames = roomFlags.map(i => i.name);

        const roomStructures = room.find(FIND_STRUCTURES);

        const powerBank = roomStructures.find(i => i.structureType === 'powerBank') as StructurePowerBank | undefined;

        if (typeof powerBank !== 'undefined' && powerBank.ticksToDecay >= 4800 && powerBank.power >= 3000) {
            if (!roomFlagNames.includes(`${creepScanning.GetCurrentMemory().homeRoom} PowerMine`)) {
                room.createFlag(powerBank.pos, `${creepScanning.GetCurrentMemory().homeRoom} PowerMine 1`);
            }
        }
    }

    public TickConditionalFlags() {
        if (!this.RunEveryTicks(15))
            return;

        const flags = this.GetFlagArray();

        if (typeof flags.find(i => i.name.startsWith('MinesRemove')) !== 'undefined') {
            for(const flag of flags.filter(i => i.name.includes('Mine'))) {
                flag.remove();
            }
        }

        if (typeof flags.find(i => i.name.startsWith('AttackRemove')) !== 'undefined') {
            for(const flag of flags.filter(i => i.name.includes('Attack'))) {
                flag.remove();
            }
        }

        if (typeof flags.find(i => i.name.startsWith('AttackersDisband')) !== 'undefined') {
            for(const creep of this.creeps.filter(i => i.GetJob() === dokCreepJob.RoomAttacker || i.GetName().includes('Attacker'))) {
                creep.GetRef().suicide();
            }

            Game.flags['AttackersDisband'].remove();
        }

        const killCreepsRoomFlag = flags.find(i => i.name.startsWith('KillCreepsInRoom'));
        if (typeof killCreepsRoomFlag !== 'undefined') {
            const roomInstance = this.rooms.find(i => i.GetName() === killCreepsRoomFlag.pos.roomName);

            if (typeof roomInstance !== 'undefined') {
                const creepsHere = this.creeps.filter(i => i.GetCurrentMemory().homeRoom === killCreepsRoomFlag.pos.roomName);

                for(const creep of creepsHere) {
                    creep.GetRef().suicide();
                }

                killCreepsRoomFlag.remove();
            }
        }

        const killAllCreepsFlag = flags.find(i => i.name.startsWith('KillAllCreeps'));
        if (typeof killAllCreepsFlag !== 'undefined') {
                for(const creep of this.creeps) {
                    creep.GetRef().suicide();
                }

                killAllCreepsFlag.remove();
        }

        const leaveRoomFlag = flags.find(i => i.name.startsWith('LeaveRoom'));
        if (typeof leaveRoomFlag !== 'undefined') {
            const roomInstance = this.rooms.find(i => i.GetName() === leaveRoomFlag.pos.roomName);

            if (typeof roomInstance !== 'undefined') {
                const creepsHere = this.creeps.filter(i => i.GetCurrentMemory().homeRoom === leaveRoomFlag.pos.roomName);

                for(const creep of creepsHere) {
                    creep.GetRef().suicide();
                }
    
                const myStructuresHere = roomInstance.GetRef().find(FIND_MY_STRUCTURES);

                for(const structure of myStructuresHere) {
                    structure.destroy();
                }

                const publicStructuresHere = roomInstance.GetRef().find(FIND_STRUCTURES);

                const publicRoads = publicStructuresHere.filter(i => i.structureType === 'road');

                for(const road of publicRoads) {
                    road.destroy();
                }

                const publicBins = publicStructuresHere.filter(i => i.structureType === 'container');

                for(const bin of publicBins) {
                    bin.destroy();
                }

                const publicWalls = publicStructuresHere.filter(i => i.structureType === 'constructedWall');

                for(const wall of publicWalls) {
                    wall.destroy();
                }

                const controller = roomInstance.GetRef().controller;

                if (typeof controller !== 'undefined') {
                    controller.unclaim();

                    this.rooms = this.rooms.filter(i => i.GetName() !== leaveRoomFlag.pos.roomName)
                }

                Game.notify(`dokUtil has been instructed to leave room ${leaveRoomFlag.pos.roomName}.`);

                leaveRoomFlag.remove();
            }
        }
    }

    public DebugOverlay() {
        new RoomVisual().text(`Bucket: ${Game.cpu.bucket}`, 0, 0, { align: 'left' });
        new RoomVisual().text(`Creeps: ${this.creeps.length}`, 0, 1, { align: 'left' });
        new RoomVisual().text(`Rooms: ${this.rooms.length}/${Game.gcl.level}`, 0, 2, { align: 'left' });
        new RoomVisual().text(`Pathing: ${this.pathing.length}`, 0, 3, { align: 'left' });
        new RoomVisual().text(`Flags: ${Object.keys(Game.flags).length}`, 0, 4, { align: 'left' });
        new RoomVisual().text(`Resources_Cached: ${this.cachedResource.length}`, 0, 5, { align: 'left' });
        new RoomVisual().text(`Locks: ${this.memory.locks.length}`, 0, 6, { align: 'left' });
        new RoomVisual().text(`Tick: ${this.memory.ticks} (iat: ${this.ticksAlive})`, 0, 7, { align: 'left' });
        
        if (Game.cpu.bucket < 500) {
            new RoomVisual().text(`LOW CPU!`, 0, 8, { align: 'left', color: 'red', backgroundColor: 'black' });
        }
    }

    public Tick() {
        // pixel generation
        if (Game.cpu.bucket >= 10000 && typeof Game.flags['SkipPixelGen'] === 'undefined') {
            Game.cpu.generatePixel();

            return;
        }

        // Read memory
        this.ReadMemory();

        // bump counters
        this.BumpCounters();

        // Tick conditional flags
        this.TickConditionalFlags();

        // tick all active rooms
        this.TickRooms();

        // Tick all creeps
        this.TickCreeps();

        // Clean dead memory
        this.CleanDeadMemory();

        // clean dirty pathing
        this.CleanUnusedPaths();

        // commit memory
        this.SaveMemory();

        // show debug overlay
        this.DebugOverlay();
    }

    // Static methods
    private static instance: dokUtil;

    public static signText: string = "dokman was here";

    public static ProcessTick() {
        if (!this.instance) {
            this.instance = new dokUtil();
        }

        this.instance.Tick();
    }

    public static GetPosPathBetween(start: { pos: RoomPosition }, end: { pos: RoomPosition }) : Array<RoomPosition> {
        const pathing: Array<RoomPosition> = [];

        const path = start.pos.findPathTo(end, { ignoreCreeps: true });

        for(const point of path) {
            pathing.push(new RoomPosition(point.x, point.y, start.pos.roomName));
        }

        return pathing;
    }

    public static GetFreeSlots(room : Room, object : Structure | Resource | { pos: RoomPosition }, area : number, structureArea: number = 0, ignore: Array<StructureConstant | Terrain> = []) : Array<dokUtilPlots> {
        // area of 1 is a 3x3 grid.
        const terrain = Game.map.getRoomTerrain(room.name)

        let openSpots: Array<dokUtilPlots> = []
        
        let x = 0 - area
        let y = 0 - area

        while (x <= area) {
            while (y <= area) {
                const roomPos = new RoomPosition(object.pos.x + x, object.pos.y + y, room.name);

                const terrainHit = terrain.get(object.pos.x + x, object.pos.y + y);

                switch(terrainHit) {
                    case TERRAIN_MASK_WALL:
                        if (ignore.includes('wall')) {
                            const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                            const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                    
                            if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType })
                            } else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType })
                            } else {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null })
                            }
                            
                            break;
                        }

                        openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: 'wall' })

                        break
                    case TERRAIN_MASK_SWAMP:
                        if (ignore.includes('swamp')) {
                            const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                            const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                    
                            if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType })
                            } else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType })
                            } else {
                                openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null })
                            }
                            
                            break;
                        }

                        openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: 'swamp' })

                        break
                    case 0:
                        const item = roomPos.findInRange(FIND_STRUCTURES, structureArea);
                        const constructions = roomPos.findInRange(FIND_CONSTRUCTION_SITES, structureArea);
                
                        if (item.length > 0 && !ignore.includes(item[0].structureType)) {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: item[0].structureType })
                        } else if (constructions.length > 0 && !ignore.includes(constructions[0].structureType)) {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 0, object: constructions[0].structureType })
                        } else {
                            openSpots.push({ pos: new RoomPosition(object.pos.x + x, object.pos.y + y, room.name), code: 1, object: null })
                        }

                        break;
                    }
                y += 1
            }
            y = 0 - area
            x += 1
        }

        return openSpots
    }

    public static getDistance(pos1: RoomPosition, pos2: RoomPosition) {
        var a = pos1.x - pos2.x;
        var b = pos1.y - pos2.y;

        let distance = Math.sqrt( a*a + b*b );

        if (distance < 0)
            distance = distance * -1;

        return distance;
    }

    public static getDistanceLong(pos1: RoomPosition, pos2: RoomPosition) {
        if (pos1.roomName !== pos2.roomName) {
            return 100;
        }

        var a = pos1.x - pos2.x;
        var b = pos1.y - pos2.y;

        let distance = Math.sqrt( a*a + b*b );

        if (distance < 0)
            distance = distance * -1;

        return distance;
    }

    public static posEqual(pos1: RoomPosition, pos2: RoomPosition) {
        if (pos1.x === pos2.x && pos1.y === pos2.y && pos1.roomName == pos2.roomName)
            return true;

        return false;
    }

    public static genRandomNumber(min: number, max: number) : number {
        return Math.floor(Math.random() * (max - min) + min)
    }

    public static runEvery(ticks: number, num : number) : boolean {
        return ticks % num == 0;
    }

    public static convertPosToDokPos(pos : RoomPosition) : dokUtilPosition {
        return { x: pos.x, y: pos.y, room: pos.roomName }
    }

    public static convertDokPosToPos(pos : dokUtilPosition) : RoomPosition {
        return new RoomPosition(pos.x, pos.y, pos.room);
    }

    public static getRclLimits(rcl: number) {
        const roomLimits: dokUtilRCLLimit = {
            roads: 0,
            containers: 0,
            spawns: 0,
            extensions: 0,
            ramparts: 0,
            walls: 0,
            towers: 0,
            storage: 0,
            links: 0,
            extractor: 0,
            labs: 0,
            terminal: 0,
            factory: 0,
            observer: 0,
            powerspawn: 0,
            nuker: 0
        };

        if (rcl >= 0) {
            roomLimits.roads = Infinity;
            roomLimits.containers = 5;
        }

        if (rcl >= 1) {
            roomLimits.spawns = 1;
        }

        if (rcl >= 2) {
            roomLimits.extensions = 5;
            roomLimits.ramparts = Infinity;
            roomLimits.walls = Infinity;
        }

        if (rcl >= 3) {
            roomLimits.extensions = 10;
            roomLimits.towers = 1;
        }

        if (rcl >= 4) {
            roomLimits.extensions = 20;
            roomLimits.storage = 1;
        }

        if (rcl >= 5) {
            roomLimits.extensions = 30;
            roomLimits.towers = 2;
            roomLimits.links = 2;
        }

        if (rcl >= 6) {
            roomLimits.extensions = 40;
            roomLimits.links = 3;
            roomLimits.labs = 3;
            roomLimits.terminal = 1;
        }

        if (rcl >= 7) {
            roomLimits.extensions = 50;
            roomLimits.spawns = 2;
            roomLimits.towers = 3;
            roomLimits.links = 4;
            roomLimits.extractor = 1;
            roomLimits.labs = 6;
            roomLimits.factory = 1;
        }

        if (rcl >= 8) {
            roomLimits.extensions = 60;
            roomLimits.spawns = 3;
            roomLimits.towers = 6;
            roomLimits.links = 6;
            roomLimits.labs = 10;
            roomLimits.observer = 1;
            roomLimits.powerspawn = 1;
            roomLimits.nuker = 1;
        }

        return roomLimits;
    }
}