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

    Healer = 14,

    PowerHauler = 15,

    FactoryWorker = 16
}

export enum dokCreepTask {
    Gather = 0,
    Deposit = 1
}

export interface dokCreepMemory {
    homeRoom: string;

    job: dokCreepJob;
    task: dokCreepTask;

    aliveFor: number;
}

export default class dokCreep {
    protected util: dokUtil;
    protected creepRef: Creep;

    protected memory: dokCreepMemory;

    private rclRecovery: boolean = false;
    private targetGather: string | null = null;

    private storedPath: dokUtilPathing | null = null;
    private storedPathRoomSanity: string | null = null;

    private atPositionFor: number = 0;
    private atPosition: RoomPosition | null = null;

    private focusedNearby: string | null = null;

    private depositTask: string = '';

    private moveSpammy: RoomPosition | null = null;
    protected moveSpammyDisable: boolean = false;

    constructor(util: dokUtil, creep: Creep) {
        this.util = util;
        this.creepRef = creep;

        this.memory = this.ReadMemory();
    }

    private ReadMemory() {
        if (Object.keys(this.creepRef.memory).length === 0) {
            this.creepRef.memory = {};
        }

        return this.creepRef.memory as dokCreepMemory;
    }

    protected SaveMemory() {
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
            case dokCreepTask.Deposit:
                this.DoBasicDeposit();

                break;
            default:
                break;
        }
    }

    protected CheckIfGatherFull() {
        if (this.creepRef.store.getFreeCapacity() <= 0) {
            this.memory.task = dokCreepTask.Deposit;

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

        // get reference to homeroom in case creep gets off course
        const homeRoom = this.util.GetDokRoom(this.memory.homeRoom)?.GetRef() || this.creepRef.room;

        const currentRoomRcl = (homeRoom.controller?.level || 0);
        
        if (currentRoomRcl < 5) {
            // search for dropped resources first
            const droppedResources = this.util.FindResource<Resource>(homeRoom, FIND_DROPPED_RESOURCES).filter(i => i.resourceType === 'energy');
                    
            if (droppedResources.length > 0) {
                if (this.creepRef.pickup(droppedResources[0]) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(droppedResources[0])
                }

                return;
            }

            // check for tombstones
            const tombstones = this.util.FindResource<Tombstone>(homeRoom, FIND_TOMBSTONES).filter(i => i.store.getUsedCapacity('energy') > 0 && this.util.GetLocksWithoutMe(i, this).length < 1);

            if (tombstones.length > 0) {
                if (this.creepRef.withdraw(tombstones[0], 'energy') === ERR_NOT_IN_RANGE) {
                    this.moveToObject(tombstones[0])
                }

                this.util.PlaceLock(tombstones[0], this);

                return;
            }
        }

        // single scan for all structures
        const structuresHere = this.util.FindResource<Structure>(homeRoom, FIND_STRUCTURES);

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

        if (currentRoomRcl <= 5) {
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
        }

        if (currentRoomRcl < 5) {
            const ruins = this.util.FindResource<Ruin>(homeRoom, FIND_RUINS).filter(i => i.store.getUsedCapacity('energy') > 0 && this.util.GetLocksWithoutMe(i, this).length < 1);

            if (ruins.length > 0) {
                if (this.creepRef.withdraw(ruins[0], 'energy') === ERR_NOT_IN_RANGE) {
                    this.moveToObject(ruins[0])
                }

                this.util.PlaceLock(ruins[0], this);

                return;
            }
        }


        // check for energy sources
        const energySources = this.util.FindResource<Source>(homeRoom, FIND_SOURCES_ACTIVE).filter(i => this.IsTargetedGather(i.id) && this.ComputeLocksOnSource(i)).sort((a, b) => dokUtil.getDistance(a.pos, this.creepRef.pos) - dokUtil.getDistance(b.pos, this.creepRef.pos));

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

            this.depositTask = '';

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

            this.depositTask = '';

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

        // get reference to homeroom in case creep gets off course
        const homeRoom = this.util.GetDokRoom(this.memory.homeRoom)?.GetRef() || this.creepRef.room;

        // single scan for all structures
        const structuresHere = this.util.FindResource<Structure>(homeRoom, FIND_STRUCTURES);

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

        if (this.depositTask === '' || this.depositTask === 'extension') {
            this.depositTask = 'extension';

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
            const constructions = this.util.FindResource<ConstructionSite>(homeRoom, FIND_MY_CONSTRUCTION_SITES).filter(i => (i.structureType === 'extension' || i.structureType === 'tower'));

            if (constructions.length > 0) {
                if (this.creepRef.build(constructions[0]) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(constructions[0])
                }

                return;
            }

            // should we auto build some extensions?
            const rclConstructionLimits = dokUtil.getRclLimits(homeRoom.controller?.level || 0);
            const towers = structuresHere.filter(i => i.structureType === 'tower') as StructureTower[];

            if (towers.length < rclConstructionLimits.towers && constructions.length === 0) {
                if (this.CheckIfGatherNotFull())
                    return;

                if (spawns.length <= 0)
                    return;

                this.creepRef.say('Build T', false);

                const buildableAreas = dokUtil.GetFreeSlots(homeRoom, spawns[0], 8, 1, ['swamp']);

                const placeableArea = buildableAreas.filter((plotScan) => {
                    if (plotScan.code === 0) {
                        new RoomVisual(homeRoom.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                        return false;
                    }

                    new RoomVisual(homeRoom.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#ff4f00' });

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

                // TODO: move this into room controller
                this.creepRef.say('Build E', false);

                const buildableAreas = dokUtil.GetFreeSlots(homeRoom, spawns[0], 8, 0, ['swamp']);

                const placeableArea = buildableAreas.filter((plotScan) => {
                    if (plotScan.code === 0) {
                        new RoomVisual(homeRoom.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                        return false;
                    }

                    if (plotScan.pos.x % 3 === 0) {
                        new RoomVisual(homeRoom.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                        return false;
                    }

                    if (plotScan.pos.y % 4 === 0) {
                        new RoomVisual(homeRoom.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                        return false;
                    }

                    new RoomVisual(homeRoom.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#ff4f00' })

                    return true;
                }).sort((a, b) => dokUtil.getDistance(a.pos, spawns[0].pos) - dokUtil.getDistance(b.pos, spawns[0].pos));

                if (this.creepRef.pos.getRangeTo(placeableArea[0].pos) > 0) {
                    this.moveToObject(placeableArea[0].pos);

                    this.creepRef.room.createConstructionSite(placeableArea[0], 'extension');

                    return;
                }
            }
        }

        if ((homeRoom.controller?.level || 1) >= 8) {
            this.creepRef.say(`⏱️🪫`);

            return;
        }

        // check to make sure energy is full before going to controller
        if (this.creepRef.store.getFreeCapacity() > 0 && this.depositTask === 'extension') {
            this.creepRef.say('Refill');

            this.memory.task = dokCreepTask.Gather;

            return;
        }

        this.depositTask = 'controller';

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

        if (this.moveSpammy === null || position !== null && !dokUtil.posEqual(this.moveSpammy, position)) {
            this.moveSpammy = position;
        }

        if (this.atPosition !== null && dokUtil.posEqual(this.creepRef.pos, this.atPosition) && this.creepRef.fatigue === 0) {
            this.atPositionFor++;
            
            if (this.atPositionFor >= 5) {
                this.creepRef.say('Stuck!?');
                
                this.atPositionFor = 0;
                this.storedPath = null;
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
        if (this.storedPath !== null && dokUtil.posEqual(dokUtil.convertDokPosToPos(this.storedPath.to), position)) {
            this.creepRef.moveByPath(this.storedPath.path);

            return;
        }

        const fetchedPath = this.util.GetSuggestedPath(position, this.creepRef.pos, { ignoreRoads: ignores, ignoreCreeps: ignores });

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
            this.util.RemoveCreepFromRuntime(this);

            return;
        }

        if (this.creepRef.spawning)
            return;

        if (this.moveSpammy !== null && this.moveSpammyDisable === false) {
            if (dokUtil.getDistanceLong(this.moveSpammy, this.creepRef.pos) > 4) {
                this.moveToObject(this.moveSpammy);

                this.creepRef.say(`🐟`);

                return;
            }
        }

        this.DoCreepWork();

        // tick alive for
        this.memory.aliveFor++;

        this.SaveMemory();
    }
}