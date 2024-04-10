import dokUtil, { dokUtilPathing } from "../dokUtil";
import dokCreepHeavyMiner from "./HeavyMiner";

export enum dokCreepJob {
    Base = 0,

    RoadBuilder = 1,

    HeavyMiner = 2,

    ControllerSlave = 3,

    /**
     * @deprecated
     */
    Unused4 = 4,

    Colonizer = 5,

    /**
     * @deprecated
     */
    Unused6 = 6,

    ConstructionWorker = 7,

    RoomDefender= 8,

    RoomAttacker = 9,

    LinkStorageSlave = 10,

    RemoteConstruction = 11,

    RemoteMiner = 12,

    PowerMiner = 13,

    Healer = 14
}

export enum dokCreepTask {
    Gather = 0,
    Depost = 1
}

export interface dokCreepMemory {
    homeRoom: string;

    job: dokCreepJob;
    task: dokCreepTask;
}

export default class dokCreep {
    protected util: dokUtil;
    protected creepRef: Creep;

    protected memory: dokCreepMemory;

    private rclRecovery: boolean = false;
    private targetGather: string | null = null;

    private myName: string;

    private storedPath: dokUtilPathing | null = null;
    private storedPathRoomSanity: string | null = null;

    private atPositionFor: number = 0;
    private atPosition: RoomPosition | null = null;

    private focusedNearby: string | null = null;

    constructor(util: dokUtil, creep: Creep) {
        this.util = util;
        this.creepRef = creep;

        this.myName = creep.name;

        this.memory = this.ReadMemory();
    }

    private ReadMemory() {
        if (Object.keys(this.creepRef.memory).length === 0) {
            this.creepRef.memory = {};
        }

        return this.creepRef.memory as dokCreepMemory;
    }

    private SaveMemory() {
        this.creepRef.memory = this.memory;
    }

   public GetCurrentMemory() {
        return this.memory;
    }

    public DoCreepWork() {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                this.DoBasicGather();

                break;
            case dokCreepTask.Depost:
                this.DoBasicDeposit();

                break;
            default:
                break;
        }
    }

    protected CheckIfGatherFull() {
        if (this.creepRef.store.getFreeCapacity() <= 0) {
            this.memory.task = dokCreepTask.Depost;

            this.creepRef.say('Deposit', false);

            this.util.ReleaseLocks(this);

            this.targetGather = null;

            return true;
        }

        return false;
    }

    protected IsTargetedGather(itemId: string) {
        if (this.targetGather === null) {
            return true;
        }

        if (this.targetGather === itemId) {
            return true;
        }

        return false;
    }

    protected ComputeLocksOnSource(i: Source) : boolean { 
        const locksPlaced = this.util.GetLocksWithoutMe(i, this);
        const maximumSlots = this.util.GetSeatsForItem(this.creepRef.room, i);

        if (locksPlaced.length >= maximumSlots) {
            return false;
        }

        return true;
    };

    protected DoBasicGather() {
        if (this.CheckIfGatherFull())
            return;
        
        // search for dropped resources first
        const droppedResources = this.util.FindResource<Resource>(this.creepRef.room, FIND_DROPPED_RESOURCES).filter(i => i.resourceType === 'energy');
                
        if (droppedResources.length > 0) {
            if (this.creepRef.pickup(droppedResources[0]) === ERR_NOT_IN_RANGE) {
                this.moveToObject(droppedResources[0])
            }

            return;
        }

        // check for tombstones
        const tombstones = this.util.FindResource<Tombstone>(this.creepRef.room, FIND_TOMBSTONES).filter(i => i.store.getUsedCapacity('energy') > 0 && this.util.GetLocksWithoutMe(i, this).length < 1);

        if (tombstones.length > 0) {
            if (this.creepRef.withdraw(tombstones[0], 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(tombstones[0])
            }

            this.util.PlaceLock(tombstones[0], this);

            return;
        }

        // single scan for all structures
        const structuresHere = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES);

        // check for stored energy
        const containerResource = (structuresHere as StructureContainer[]).filter(i => i.structureType === 'container' && this.IsTargetedGather(i.id) && i.store.energy >= 50 && this.util.GetLocksWithoutMe(i, this).length < 2);
        const storageResources = (structuresHere as StructureStorage[]).filter(i => i.structureType === 'storage' && this.IsTargetedGather(i.id) && i.store.energy > 0 && this.util.GetLocksWithoutMe(i, this).length < 5);
        const storedResources: Array<StructureContainer | StructureStorage> = containerResource.concat((storageResources as any)).sort((a, b) => a.store.energy - b.store.energy);

        if (storedResources.length > 0) {
            this.targetGather = storedResources[0].id;

            this.util.PlaceLock({ id: storedResources[0].id }, this);

            if (this.creepRef.withdraw(storedResources[0], 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(storedResources[0])
            }

            return;
        }

        // check for heavy miners without links
        const heavyMiners = this.util.GetKnownCreeps().filter(i => i.GetCurrentMemory().job === dokCreepJob.HeavyMiner && this.memory.homeRoom === i.memory.homeRoom && (i as dokCreepHeavyMiner).canTakeFrom && this.IsTargetedGather(i.GetId()) && this.util.GetLocksWithoutMe({ id: i.GetId() }, this).length === 0 && i.creepRef.store.energy >= 200).sort((a, b) => dokUtil.getDistance(a.creepRef.pos, this.creepRef.pos) - dokUtil.getDistance(b.creepRef.pos, this.creepRef.pos));

        if (heavyMiners.length > 0) {
            this.targetGather = heavyMiners[0].GetId();

            this.util.PlaceLock({ id: heavyMiners[0].GetId() }, this);

            if (this.creepRef.pos.getRangeTo(heavyMiners[0].creepRef) > 1) {
                this.moveToObject(heavyMiners[0].creepRef)
            } else {
                const heavyMiner = heavyMiners[0] as dokCreepHeavyMiner;

                this.creepRef.say('Give', false);

                heavyMiner.RequestTransfer(this.creepRef.id);
            }

            return;
        }

        // check for energy sources
        const energySources = this.util.FindResource<Source>(this.creepRef.room, FIND_SOURCES_ACTIVE).filter(i => this.IsTargetedGather(i.id) && this.ComputeLocksOnSource(i)).sort((a, b) => dokUtil.getDistance(a.pos, this.creepRef.pos) - dokUtil.getDistance(b.pos, this.creepRef.pos));

        if (energySources.length > 0) {
            this.targetGather = energySources[0].id;
            
            this.util.PlaceLock(energySources[0], this);

            if (this.creepRef.harvest(energySources[0]) === ERR_NOT_IN_RANGE) {
                this.moveToObject(energySources[0])
            }

            return;
        }

        if (this.targetGather !== null) {
            this.targetGather = null;

            this.creepRef.say('Target?', false);
        }

        this.creepRef.say(`⚡🤷`, false);
    }

    protected CheckIfDepositEmpty() {
        if (this.creepRef.store.getUsedCapacity('energy') <= 0) {
            this.memory.task = dokCreepTask.Gather;

            this.creepRef.say('Gather', false);

            this.util.ReleaseLocks(this);

            if (this.rclRecovery)
                this.rclRecovery = false;

            return true;
        }

        return false;
    }

    protected CheckIfGatherNotFull() {
        // only proceded if you are charged
        if (this.creepRef.store.getUsedCapacity() < this.creepRef.store.getCapacity()) {
            this.memory.task = dokCreepTask.Gather;

            this.creepRef.say('Gather', false);

            this.util.ReleaseLocks(this);

            if (this.rclRecovery)
                this.rclRecovery = false;

            return true;
        }

        return false;
    }

    protected DoBasicDeposit() {
        if (this.CheckIfDepositEmpty())
            return;

        // single scan for all structures
        const structuresHere = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES);

        // check on controller
        const controllers = structuresHere.filter(i => i.structureType === 'controller') as StructureController[];

        // watch the controller so it dosent downgrade
        if (controllers.length > 0 && (controllers[0].ticksToDowngrade < 1200 * controllers[0].level || this.rclRecovery)) {
            this.rclRecovery = true;

            if (this.creepRef.upgradeController(controllers[0]) === ERR_NOT_IN_RANGE) {
                this.creepRef.say('Save RCL!', false);

                this.moveToObject(controllers[0])
            }

            return;
        }

        // get extensions in the room
        const extensions = structuresHere.filter(i => i.structureType === 'extension') as StructureExtension[];
        const extensionsEmpty = extensions.filter(i => i.store.energy < i.store.getCapacity('energy') && this.util.GetLocksWithoutMe(i, this).length < 1).sort((a, b) => dokUtil.getDistance(this.creepRef.pos, a.pos) - dokUtil.getDistance(this.creepRef.pos, b.pos));

        if (this.focusedNearby !== null) {
            const emptyExtension = extensionsEmpty.find(i => i.id === this.focusedNearby);

            if (typeof emptyExtension !== 'undefined') {
                if (this.creepRef.transfer(emptyExtension, 'energy') === ERR_NOT_IN_RANGE) {
                    this.moveToObject(emptyExtension)
                }

                return;
            }
        }
        
        if (extensionsEmpty.length > 0) {
            if (this.creepRef.transfer(extensionsEmpty[0], 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(extensionsEmpty[0])
            }

            this.util.PlaceLock(extensionsEmpty[0], this);

            this.focusedNearby = extensionsEmpty[0].id;

            return;
        }

        // get the spawns
        const spawns = structuresHere.filter(i => i.structureType === 'spawn') as StructureSpawn[];
        const spawnsEmpty = spawns.filter(i => i.store.energy < i.store.getCapacity('energy') && this.util.GetLocksWithoutMe(i, this).length < 1);

        if (spawnsEmpty.length > 0) {
            if (this.creepRef.transfer(spawnsEmpty[0], 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(spawnsEmpty[0])
            }

            this.util.PlaceLock(spawnsEmpty[0], this);

            return;
        }

        // get the constructions
        const constructions = this.util.FindResource<ConstructionSite>(this.creepRef.room, FIND_MY_CONSTRUCTION_SITES).filter(i => (i.structureType === 'extension' || i.structureType === 'tower') &&  this.util.GetLocksWithoutMe(i, this).length < 1);

        if (constructions.length > 0) {
            if (this.util.GetLocksWithoutMe(constructions[0], this).length === 0) {
                this.util.PlaceLock(constructions[0], this);

                if (this.creepRef.build(constructions[0]) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(constructions[0])
                }

                return;
            }
        }

        // should we auto build some extensions?
        const rclConstructionLimits = dokUtil.getRclLimits(this.creepRef.room.controller?.level || 0);
        const towers = structuresHere.filter(i => i.structureType === 'tower') as StructureTower[];

        if (towers.length < rclConstructionLimits.towers && constructions.length === 0) {
            if (this.CheckIfGatherNotFull())
                return;

            if (spawns.length <= 0)
                return;

            this.creepRef.say('Build T', false);

            const buildableAreas = dokUtil.GetFreeSlots(this.creepRef.room, spawns[0], 8, 1, ['swamp']);

            const placeableArea = buildableAreas.filter((plotScan) => {
                if (plotScan.code === 0) {
                    new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                    return false;
                }

                new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#ff4f00' });

                return true;
            }).sort((a, b) => dokUtil.getDistance(b.pos, spawns[0].pos) - dokUtil.getDistance(a.pos, spawns[0].pos));

            if (this.creepRef.pos.getRangeTo(placeableArea[0].pos) > 0) {
                this.moveToObject(placeableArea[0].pos);

                this.creepRef.room.createConstructionSite(placeableArea[0], 'tower');

                return;
            }
        }

        if (extensions.length < rclConstructionLimits.extensions && constructions.length === 0) {
            if (this.CheckIfGatherNotFull())
                return;

            if (spawns.length <= 0)
                return;

            this.creepRef.say('Build E', false);

            const buildableAreas = dokUtil.GetFreeSlots(this.creepRef.room, spawns[0], 8, 0, ['swamp']);

            const placeableArea = buildableAreas.filter((plotScan) => {
                if (plotScan.code === 0) {
                    new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                    return false;
                }

                if (plotScan.pos.x % 3 === 0) {
                    new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                    return false;
                }

                if (plotScan.pos.y % 4 === 0) {
                    new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                    return false;
                }

                new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#ff4f00' })

                return true;
            }).sort((a, b) => dokUtil.getDistance(a.pos, spawns[0].pos) - dokUtil.getDistance(b.pos, spawns[0].pos));

            if (this.creepRef.pos.getRangeTo(placeableArea[0].pos) > 0) {
                this.moveToObject(placeableArea[0].pos);

                this.creepRef.room.createConstructionSite(placeableArea[0], 'extension');

                return;
            }
        }

        if (controllers.length > 0) {
            if (this.creepRef.upgradeController(controllers[0]) === ERR_NOT_IN_RANGE) {
                this.moveToObject(controllers[0]);
            }

            return;
        }
    }

    protected moveToObject(obj : RoomPosition | { pos: RoomPosition; id: string; }) {
        //this.creepRef.moveTo(obj, { reusePath: 10 });
        this.moveToObjectViaPath(obj);
    }

    protected moveToObjectFar(obj : RoomPosition | { pos: RoomPosition; id: string; }) {
        this.moveToObjectViaPath(obj, true);
    }

    protected moveToObjectViaPath(obj : RoomPosition | { pos: RoomPosition; id: string; }, ignores: boolean = false) {
        let position: RoomPosition | null = null;

        // get target pos position
        if (typeof (obj as any).pos !== 'undefined') {
            position = (obj as any).pos;
        } else if (typeof (obj as any).x !== 'undefined' && typeof (obj as any).y !== 'undefined') {
            position = obj as RoomPosition;
        }

        if (this.atPosition !== null && dokUtil.posEqual(this.creepRef.pos, this.atPosition)) {
            this.atPositionFor++;
            
            if (this.atPositionFor >= 10) {
                this.creepRef.say('Stuck!');
                
                this.atPositionFor = 0;
                this.storedPath = null;
            } else if (this.atPositionFor > 2) {
                this.creepRef.say(`Stalled ${this.atPositionFor}`);
            }
        } else {
            this.atPositionFor = 0;
            this.atPosition = this.creepRef.pos;
        }
            

        // if not able to get position, fallback to heavy cpu move to :(
        if (position === null) {
            console.log(`[dokUtil][creep:${this.creepRef.id}][pathing] failed to gen path, falling back to moveTo`)

            this.creepRef.moveTo(obj, { reusePath: 100, ignoreCreeps: true, ignoreRoads: true });

            return;
        }

        // if room has changed for our creep, we need to regenerate pathing
        if (this.creepRef.room.name !== this.storedPathRoomSanity) {
            this.storedPath = null;
        }

        // do we already have a path stored?
        if (this.storedPath !== null && dokUtil.posEqual(this.storedPath.to, position)) {
            this.creepRef.moveByPath(this.storedPath.path);

            return;
        }

        const fetchedPath = this.util.GetSuggestedPath(position, this.creepRef.pos, { ignoreCreeps: ignores, ignoreRoads: ignores });

        this.storedPath = fetchedPath;
        this.storedPathRoomSanity = this.creepRef.room.name;
        this.atPosition = this.creepRef.pos;

        this.creepRef.moveByPath(fetchedPath.path);
    }

    private RelinkRef() {
        this.creepRef = Game.creeps[this.creepRef.name];
    }

    public GetName() {
        return this.creepRef.name;
    }

    public GetId() {
        return this.creepRef.id;
    }

    public GetRoom() {
        return this.creepRef.room.name;
    }

    public GetJob() {
        return this.memory.job;
    }

    public GetRef() {
        return this.creepRef;
    }

    public Tick() {
        this.RelinkRef();

        if (typeof this.creepRef === 'undefined') {
            console.log(`[dokUtil] creep ${this.myName} has died!`)

            this.util.RemoveCreepFromRuntime(this);

            return;
        }

        if (this.creepRef.spawning)
            return;

        this.DoCreepWork();

        this.SaveMemory();
    }
}