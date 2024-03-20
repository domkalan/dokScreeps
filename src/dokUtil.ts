import dokCreep, { dokCreepJob, dokCreepMemory } from "./creeps/Base";
import dokCreepColonizer from "./creeps/Colonizer";
import dokCreepConstructionWorker from "./creeps/ConstructionWorker";
import dokCreepControllerSlave from "./creeps/ControllerSlave";
import dokCreepDefender from "./creeps/Defender";
import dokCreepHeavyMiner from "./creeps/HeavyMiner";
import dokCreepLinkStorageSlave from "./creeps/LinkStorageSlave";
import dokCreepRemoteConstructionWorker from "./creeps/RemoteConstructionWorker";
import dokCreepRemoteMiner from "./creeps/RemoteMiner";
import dokCreepRoadBuilder from "./creeps/RoadBuilder";
import dokCreepRoomReserver from "./creeps/RoomReserver";
import dokCreepScout from "./creeps/Scout";
import dokRoom, { dokRoomScoutPlan } from "./dokRoom";

export interface dokCache {
    room: string;
    filter: FindConstant;
    resource: any;
}
export type dokUtilMemory = {
    ticks: number;

    locks: Array<{ item: string, creep: string }>
    seats: Array<{ item: string, seats: number }>

    worldOverlay: boolean

    nextSelectedRoom?: string | null

    lastReportSent?: number | null
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

export default class dokUtil {
    private rooms: Array<dokRoom>;
    private creeps: Array<dokCreep>;
    private memory: dokUtilMemory;
    private cached: Array<dokCache> = [];
    private cachedValidFor: number = 0;
    private cacheTimesOutAt: number = 0;
    private spawnerNames: Array<string> = [
        'Target',
        'Braken',
        'Boston',
        'Bruce',
        'Huel',
        'Kitty',
        'Candy',
        'James',
        'Edward',
        'Beans',
        'Bakers',
        'Jack',
        'Eddie',
        'Nina',
        'Red',
        'Joe',
        'Tina',
        'Soup',
        'Wombo'
    ];

    private cachedScoutPlans: Array<{ plan: dokRoomScoutPlan, room: string }> | undefined;
    private cachedScoutPlansAt: number = 0;

    // keep track of how long this instace has been alive
    private ticksAlive: number = 0;

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
                seats: [],
                worldOverlay: false,
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
            case dokCreepJob.Scout:
                creepInstance = new dokCreepScout(this, creep);

                break;
            case dokCreepJob.Colonizer:
                creepInstance = new dokCreepColonizer(this, creep);

                break;
            case dokCreepJob.RoomReserver:
                creepInstance = new dokCreepRoomReserver(this, creep);

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
            case dokCreepJob.RemoteConstructionWorker:
                creepInstance = new dokCreepRemoteConstructionWorker(this, creep);

                break;
            case dokCreepJob.RemoteMiner:
                creepInstance = new dokCreepRemoteMiner(this, creep);

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

        for(const spawnKey in Game.spawns) {
            const spawn = Game.spawns[spawnKey];

            // Only tick on our own spawns
            if (!spawn.my) {
                continue;
            }

            const roomInstance = new dokRoom(this, spawn.room);

            // since this our spawn, we own the room?
            roomArray.push(roomInstance);
        }

        return roomArray;
    }

    public AddRoom(room : Room) {
        if (typeof this.rooms === 'undefined')
            return;

        const roomExists = this.rooms.find(i => i.GetName() === room.name);

        if (typeof roomExists !== 'undefined')
            return;

        const roomInstance = new dokRoom(this, room);

        this.rooms.push(roomInstance);

        Game.notify(`Congrats, room ${room.name} has been added to the controllable rooms!`);
    }

    public GetKnownCreeps() {
        return this.creeps;
    }

    public GetManagedRooms() {
        return this.rooms;
    }

    public GetCachedResources() {
        return this.cached;
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

    private TickCreeps() {
        /*this.creeps.forEach(creep => {
            try {
                creep.Tick();
            }
            catch(e) {
                console.log(`[dokUtil] Failed to tick creep, error:\n${e}\n\nRemoved from creep array`);

                this.creeps = this.creeps.filter(i => i !== creep);
            }
        })*/
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

    public FindCached<T>(room: Room, filterBy: FindConstant) : Array<T> {
        if (this.cached.length > 0 && this.cacheTimesOutAt !== 0) {
            const cachedResources = this.cached.filter(i => i.filter === filterBy && i.room === room.name);

            if (cachedResources.length > 0) {
                return cachedResources.map(i => i.resource);
            }
        }

        const searchResults = room.find(filterBy);

        for(const entry of searchResults) {
            this.cached.push({ room: room.name, filter: filterBy, resource: entry });
        }

        return searchResults as Array<T>;
    }

    public VoidCache() {
        if (this.cacheTimesOutAt === 0 && this.cached.length > 0) {
            this.cached = [];

            return;
        }

        if (this.cachedValidFor > this.cacheTimesOutAt)
            this.cached = [];

        this.cachedValidFor++;
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

    public Tick() {
        // Read memory
        this.ReadMemory();

        // Void cache
        this.VoidCache();

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

        // commit memory
        this.SaveMemory();
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

    public static GetPosPathBetween(room: Room, start: { pos: RoomPosition }, end: { pos: RoomPosition }) : Array<RoomPosition> {
        let currentLocation = start;

        const pathing: Array<RoomPosition> = [];
        
        while(true) {
            const slots = dokUtil.GetFreeSlots(room, currentLocation, 1, 0, [ 'road', 'rampart', 'swamp' ]).filter(i => i.code === 1).sort((a, b) => dokUtil.getDistance(a.pos, end.pos) - dokUtil.getDistance(b.pos, end.pos));

            if (slots.length === 0)
                break;

            let slot = slots[0];
            let autoSlot = 0;
            let autoSlotPop = false;

            while (slot.pos.x === currentLocation.pos.x && slot.pos.y === currentLocation.pos.y) {
                autoSlot++;
                if (autoSlot >= slots.length)
                    break;

                slot = slots[autoSlot];
            }

            if (autoSlot > 0 && !autoSlotPop)
                pathing.pop();

            pathing.push(slot.pos);

            currentLocation = slot;

            if (slot.pos.getRangeTo(end) <= 1) {
                break;
            }
        }

        pathing.forEach(slot => {
            new RoomVisual(room.name).circle(slot.x, slot.y, { fill: '#ff4f00' })
        });

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