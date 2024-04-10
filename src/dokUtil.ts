import dokCreep, { dokCreepJob, dokCreepMemory } from "./creeps/Base";
import dokCreepColonizer from "./creeps/Colonizer";
import dokCreepConstructionWorker from "./creeps/ConstructionWorker";
import dokCreepControllerSlave from "./creeps/ControllerSlave";
import dokCreepDefender from "./creeps/Defender";
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

export interface dokUtilPlots {
    pos: RoomPosition
    code: number
    object: null | Terrain | Structure | StructureConstant
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

    from: RoomPosition;
    to: RoomPosition;
    path: PathStep[];
}

export default class dokUtil {
    private rooms: Array<dokRoom>;
    private creeps: Array<dokCreep>;
    private memory: dokUtilMemory;

    // keep track of how long this instace has been alive
    private ticksAlive: number = 0;

    private pathing: Array<dokUtilPathing> = [];

    constructor() {
        this.memory = this.ReadMemory();
        this.creeps = this.GetCreeps();
        this.rooms = this.GetRooms();
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
        if (typeof this.memory.locks !== 'undefined') {
            this.memory.locks = this.memory.locks.filter(lock => {
                const creep = this.creeps.find(i => i.GetId() === lock.creep);

                if (typeof creep === 'undefined') {
                    console.log(`[dokUtil] ghost lock for creep ${lock.creep} removed`)

                    return false;
                }
                
                return true;
            })
        }
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

        const existingPath = this.pathing.find(i => (i.from === pos1 && i.to === pos2) || (i.from === pos2 && i.to === pos1));

        if (typeof existingPath !== 'undefined') {
            existingPath.lastUsed = timeNow;
            existingPath.used++;

            return existingPath;
        }
            
        // generate new path
        const gamePath = pos2.findPathTo(pos1, { ignoreCreeps: opts.ignoreRoads, ignoreRoads: opts.ignoreRoads });

        const dokPath: dokUtilPathing = {
            created: timeNow,
            lastUsed: timeNow,
            used: 1,

            to: pos1,
            from: pos2,
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
        for(const creep of this.creeps) {
            try {
                creep.Tick();
            }
            catch(e) {
                console.log(`[dokUtil] Failed to tick creep, error:\n${e}\n\nRemoved from creep array`);

                this.creeps = this.creeps.filter(i => i !== creep);
            }
        }
    }

    private TickRooms() {
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

    public FindResource<T>(room: Room, filterBy: FindConstant) : Array<T> {
        const searchResults = room.find(filterBy);

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
                console.log(`[dokUtil] Creep ${creepMemKey} is considered dead...`);

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

    public TickConditionalFlags() {
        if (!this.RunEveryTicks(15))
            return;

        const flags = this.GetFlagArray();

        if (typeof flags.find(i => i.name.startsWith('Mines Remove')) !== 'undefined') {
            for(const flag of flags.filter(i => i.name.includes('Mine'))) {
                flag.remove();
            }
        }
    }

    public DebugOverlay() {
        new RoomVisual().text(`CPU Bucket: ${Game.cpu.bucket}`, 0, 0, { align: 'left' });
        new RoomVisual().text(`Creeps: ${this.creeps.length}`, 0, 1, { align: 'left' });
        new RoomVisual().text(`Rooms: ${this.rooms.length}`, 0, 2, { align: 'left' });
        new RoomVisual().text(`Pathing: ${this.pathing.length}`, 0, 3, { align: 'left' });
        new RoomVisual().text(`Tick: ${this.memory.ticks} (iat: ${this.ticksAlive})`, 0, 4, { align: 'left' });
    }

    public Tick() {
        // Read memory
        this.ReadMemory();

        // bump counters
        this.BumpCounters();

        // tick all active rooms
        this.TickRooms();

        // get all of our creeps and tick
        this.TickCreeps();

        // Clean dead memory
        this.CleanDeadMemory();

        // Tick conditional flags
        this.TickConditionalFlags();

        // clean dirty pathing
        this.CleanUnusedPaths();

        // commit memory
        this.SaveMemory();

        // pixel generation
        if (Game.cpu.bucket >= 10000) {
            Game.cpu.generatePixel();
        }

        // show debug overlay
        this.DebugOverlay();
    }

    // Static methods
    private static instance: dokUtil;

    public static signText: string = "I eat pants for a living.";

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

    public static posEqual(pos1: RoomPosition, pos2: RoomPosition) {
        if (pos1.x === pos2.x && pos1.y === pos2.y && pos1.roomName == pos2.roomName)
            return true;

        return false;
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