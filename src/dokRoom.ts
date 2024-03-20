import { dokCreepJob, dokCreepMemory } from "./creeps/Base";
import dokTower from "./dokTower";
import dokUtil from "./dokUtil";

export interface dokRoomScoutPlan {
    room: string,
    priorRoom: string | null,

    seenAt: number,
    lastVisited: number,

    hostile: boolean,

    threatRating: number | null,
    baseRating: number | null,
    profitabilityRating: number | null,

    roomOwner: string | null,
    roomLevel: number | null,
    roomSafeMode: boolean,
    roomOwnable: boolean,
    roomType: RoomStatus,

    myRoom: boolean,

    inaccessible: boolean,
    inaccessibleAt: number,

    accessAttempts: number
}

export interface dokRoomReserve {
    flags: Array<string>,
    room: string,
    ticks: number,
    locked?: boolean
}

export interface dokRoomMemory {
    spawnCount: number;

    lastSpawnJobCode?: string;
    lastSpawnEnergyReady?: number;
    lastSpawnEnergyCost?: number;
    lastSpawnPos?: RoomPosition;

    roadsPlan?: Array<RoomPosition>;
    roadsPlanLastRan?: number;

    colonizeRoom?: string;
    colonizeRoomController?: boolean;

    reserveRoomTicks?: Array<dokRoomReserve>
}

export default class dokRoom {
    private util: dokUtil;
    private roomRef: Room;

    private memory: dokRoomMemory;

    private towers: Array<dokTower> = [];

    constructor(util : dokUtil, room: Room) {
        this.util = util;
        this.roomRef = room;

        this.memory = this.ReadMemory();
    }

    private ReadMemory() {
        if (Object.keys(this.roomRef.memory).length === 0) {
            this.roomRef.memory = {};
        }

        return this.roomRef.memory as dokRoomMemory;
    }

    private SaveMemory() {
        this.roomRef.memory = this.memory;
    }

    private CalculateReserveFlags(flags : Array<Flag>) : Array<Flag> {
        const reserveFlags = flags.filter(i => i.name.startsWith(this.roomRef.name + ' Reserve'));
        
        if (typeof this.memory.reserveRoomTicks === 'undefined') {
            return reserveFlags;
        }

        const reserveFlagsLow = reserveFlags.filter(i => {
            const reserveTicksEntry = this.memory.reserveRoomTicks?.find(iz => iz.flags.includes(i.name));

            if (typeof reserveTicksEntry === 'undefined') {
                return true;
            }

            if (reserveTicksEntry.locked) {
                return false;
            }

            return true;
        });

        return reserveFlagsLow;
    }

    private CalculateRemoteConstructionFlags(flags : Array<Flag>) : Array<Flag> {
        const reserveFlags = flags.filter(i => i.name.startsWith(this.roomRef.name + ' Construct'));
        
        return reserveFlags;
    }

    private CalculateRemoteMinerFlags(flags : Array<Flag>) : Array<Flag> {
        const reserveFlags = flags.filter(i => i.name.startsWith(this.roomRef.name + ' Mine'));
        
        return reserveFlags;
    }

    private NextCreepJob() : dokCreepJob | null {
        const rclLevel = this.roomRef.controller?.level || 0;
        const rclLimits = dokUtil.getRclLimits(this.roomRef.controller?.level || 0);

        // how much extensions do we have
        const publicStructures = this.util.FindCached<Structure>(this.roomRef, FIND_STRUCTURES).filter(i => ['road', 'constructedWall', 'storage', 'link'].includes(i.structureType));
        const publicStructuresDamaged = publicStructures.filter(i => i.hits <= i.hitsMax * 0.50);
        const structures = this.util.FindCached<Structure>(this.roomRef, FIND_MY_STRUCTURES);
        const extensions = structures.filter(i => i.structureType === 'extension') as Array<StructureExtension>;
        const sources = this.util.FindCached<Source>(this.roomRef, FIND_SOURCES);
        const constructions = this.util.FindCached<ConstructionSite>(this.roomRef, FIND_MY_CONSTRUCTION_SITES);
        const storages = publicStructures.filter(i => i.structureType === 'storage');
        const links = publicStructures.filter(i => i.structureType === 'link');
        const flags = this.util.GetFlagArray();

        // filter resources here
        const towersHere = structures.filter(i => i.structureType === 'tower') as Array<StructureTower>;

        // filter hostiles here
        const hostiles = this.util.FindCached<Creep>(this.roomRef, FIND_HOSTILE_CREEPS);
        const hostilePower = this.util.FindCached<PowerCreep>(this.roomRef, FIND_HOSTILE_POWER_CREEPS);

        // get all creeps that born from this room
        const creepsFromRoom = this.util.GetKnownCreeps().filter(i => i.GetCurrentMemory().homeRoom === this.roomRef.name);

        // get base creeps
        const baseCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.Base);

        // road builder creeps
        const roadCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.RoadBuilder);

        // heavy miners
        const heavyMinerCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.HeavyMiner);

        // controller slave
        const controllerSlaveCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.ControllerSlave);

        // scout creeps
        const scoutCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.Scout);

        // colonizer creeps
        const colonizerCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.Colonizer);

        // room reserver
        const reserveFlags = this.CalculateReserveFlags(flags);
        const reserveCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.RoomReserver);

        // construction creeps
        const constructionCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.ConstructionWorker);

        // storage slaves
        const storageSlave = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.LinkStorageSlave);

        // remote construction creeps
        const constructionFlags = this.CalculateRemoteConstructionFlags(flags);
        const remoteConstructionCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.RemoteConstructionWorker);

        // remote miner flags
        const minerFlags = this.CalculateRemoteMinerFlags(flags);
        const remoteMinerCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.RemoteMiner);
        let minerFlagLimits = 0;

        for(const flag of minerFlags) {
            const flagObj = flag.name.replace(`${this.roomRef.name} Mine `, '').split(' ');

            if (flagObj.length === 2) {
                minerFlagLimits += Number(flagObj[1]);
            } else {
                minerFlagLimits += 1;
            }
        }

        let colonyPlan = false;
        let colonyLimit = 1;
        if (typeof this.memory.colonizeRoom !== 'undefined') {
            colonyPlan = true;

            if (typeof this.memory.colonizeRoomController !== 'undefined') {
                colonyLimit = 3;
            }
        }

        let roadBuilderLimit = 1;
        if (towersHere.length > roadBuilderLimit) {
            roadBuilderLimit = towersHere.length;
        }

        // if we have hostiles, go into defenense mode
        if (hostiles.length > 0 || hostilePower.length > 0) {
            return dokCreepJob.RoomDefender;
        }
        
        // start with 2
        if (rclLevel === 1 && baseCreeps.length < 2) {
            return dokCreepJob.Base;
        }

        // then rely on the room
        if (baseCreeps.length < rclLevel) {
            return dokCreepJob.Base;
        }

        if (rclLevel >= 2 && rclLimits.extensions >= 5 && roadCreeps.length < roadBuilderLimit) {
            return dokCreepJob.RoadBuilder;
        }

        if (heavyMinerCreeps.length > 0 && controllerSlaveCreeps.length < 2) {
            return dokCreepJob.ControllerSlave;
        }

        if (extensions.length > 5 && heavyMinerCreeps.length < sources.length) {
            return dokCreepJob.HeavyMiner;
        }

        if (rclLevel >= 4 && (constructions.length > 0 || publicStructuresDamaged.length > 0) && constructionCreeps.length < 1) {
            return dokCreepJob.ConstructionWorker;
        }

        if (colonyPlan && colonizerCreeps.length < colonyLimit) {
            return dokCreepJob.Colonizer;
        }

        if (reserveFlags.length > 0 && reserveCreeps.length < reserveFlags.length) {
            return dokCreepJob.RoomReserver;
        }

        if (links.length >= 2 && storages.length >= 1 && storageSlave.length < 1) {
            return dokCreepJob.LinkStorageSlave;
        }

        if (constructionFlags.length > remoteConstructionCreeps.length) {
            return dokCreepJob.RemoteConstructionWorker;
        }

        if (minerFlagLimits > remoteMinerCreeps.length) {
            return dokCreepJob.RemoteMiner;
        }

        return null;
    }

    private AttemptBodyBoost(body: BodyPartConstant[], energy: number, maxStack: number = Infinity, minStack: number = 0, currentStack = 0) : BodyPartConstant[] {
        if (currentStack >= maxStack)
            return body;

        const bodyBoost = body.concat(body);

        if (this.CalcBodyCost(bodyBoost) > energy && currentStack >= minStack) {
            return body;
        }

        return this.AttemptBodyBoost(bodyBoost, energy, maxStack, currentStack++);
    }

    private CreepBodyType(job: dokCreepJob, energy: number) : BodyPartConstant[] {
        const rclLevel = this.roomRef.controller?.level || 0;

        let bodyType : Array<BodyPartConstant> = [WORK, CARRY, MOVE];
        let bodyMaxStack = Infinity;
        let bodyMinStack = 0;

        // we NEED heavier workers for rcl 5
        if (rclLevel >= 5)
            bodyMinStack = 1;

        // heavy miners have a special job
        if (job === dokCreepJob.HeavyMiner) {
            bodyType = [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE]
        }

        // scouts are expendable, some of you will die, but that is a sacrafice i am willing to make
        if (job === dokCreepJob.Scout) {
            return [MOVE]
        }

        if (job === dokCreepJob.LinkStorageSlave) {
            return [MOVE, CARRY];
        }

        if (job === dokCreepJob.RemoteConstructionWorker || job === dokCreepJob.RemoteMiner) {
            return [MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, WORK, MOVE];
        }

        // room reservers have a special job, but they can also stack
        if (job === dokCreepJob.RoomReserver) {
            bodyMaxStack = 2;
            bodyType = [CLAIM, MOVE, CLAIM, MOVE];
        }

        // colonizers are a very special job depending on the current colonize state, they dont stack
        if (job === dokCreepJob.Colonizer) {
            if (typeof this.memory.colonizeRoomController === 'undefined')
                return [TOUGH, CARRY, WORK, CLAIM, MOVE, MOVE, MOVE, MOVE, MOVE];

            return [TOUGH, CARRY, CARRY, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE];
        }

        // Special job code for room defenders
        if (job === dokCreepJob.RoomDefender) {
            return [TOUGH, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE];
        }

        return this.AttemptBodyBoost(bodyType, energy, bodyMaxStack, bodyMinStack);
    }

    private MonitorSpawn() {
        if (typeof this.memory.lastSpawnJobCode !== 'undefined') {
            if (this.memory.lastSpawnEnergyCost === -1) {
                new RoomVisual(this.roomRef.name).text(`⌛ ${this.memory.lastSpawnEnergyReady}`, this.memory.lastSpawnPos?.x || 0, (this.memory.lastSpawnPos?.y || 0) + 1.45, { align: 'center' });
            } else {
                new RoomVisual(this.roomRef.name).text(`${this.memory.lastSpawnJobCode} ${this.memory.lastSpawnEnergyReady}/${this.memory.lastSpawnEnergyCost}`, this.memory.lastSpawnPos?.x || 0, (this.memory.lastSpawnPos?.y || 0) + 1.45, { align: 'center' });
            }
        }

        const hostiles = this.util.FindCached<Creep>(this.roomRef, FIND_HOSTILE_CREEPS);
        const hostilePower = this.util.FindCached<PowerCreep>(this.roomRef, FIND_HOSTILE_POWER_CREEPS);

        const hostilesHere : Array<Creep | PowerCreep> = hostilePower.concat(hostiles as any).sort((a, b) => b.hits - a.hits);

        if (!this.util.RunEveryTicks(15) || hostilesHere.length !== 0)
            return;

        // get room spawner
        const spawner = this.util.FindCached<StructureSpawn>(this.roomRef, FIND_MY_SPAWNS);

        if (spawner.length === 0)
            return;

        // single select our spawner
        const spawn = spawner[0];

        // dont focus if we are spawning something
        if (spawn.spawning) {
            return;
        }
        
        // const get all energy sources
        const extensions = this.util.FindCached<StructureExtension>(this.roomRef, FIND_MY_STRUCTURES).filter(i => i.structureType === 'extension');

        // get the energy on standby
        let energyReady = spawn.store.energy;

        for(const extension of extensions) {
            energyReady += extension.store.getUsedCapacity('energy');
        }

        // what job should we run next
        const nextJob = this.NextCreepJob();

        // if no jobs, wait for work
        if (nextJob === null) {
            this.memory.lastSpawnEnergyCost = -1;
            this.memory.lastSpawnEnergyReady = energyReady;

            return;
        }

        // what body parts are needed for job
        const bodyParts = this.CreepBodyType(nextJob, energyReady);

        // if no body parts...?
        if (bodyParts.length === 0)
            return;

        // init the spawn counter
        if (typeof this.memory.spawnCount === `undefined`)
            this.memory.spawnCount = 0;

        // get our job code into text
        const jobCode = this.GetJobCode(nextJob);

        // calc the cost of the body
        const bodyCost = this.CalcBodyCost(bodyParts);

        // output for debug
        this.memory.lastSpawnEnergyCost = bodyCost;
        this.memory.lastSpawnEnergyReady = energyReady;
        this.memory.lastSpawnJobCode = jobCode;
        this.memory.lastSpawnPos = spawn.pos;

        // if we have enough energy
        if (energyReady < bodyCost) {
            return;
        }

        // debug when we spawn
        new RoomVisual(this.roomRef.name).text('✅', this.memory.lastSpawnPos?.x || 0, (this.memory.lastSpawnPos?.y || 0) + 2.45, { align: 'center' });

        // etablish base memory
        const spawnMemory: dokCreepMemory = {
            homeRoom: this.roomRef.name,

            job: nextJob,
            task: 0
        };

        const creepName = `${spawn.name}:${jobCode}:${this.memory.spawnCount}`;

        // attempt spawn
        const spawnCode = spawn.spawnCreep(bodyParts, creepName, {
            memory: spawnMemory,
            energyStructures: [ spawn as any ].concat(extensions)
        });

        // if spawn worked, then yes :)
        if (spawnCode === OK) {
            this.util.AddCreepToRuntime(creepName);

            this.memory.spawnCount++;
            if (this.memory.spawnCount > 1000)
                this.memory.spawnCount = 0;
        }
    }

    private CalcBodyCost(body : BodyPartConstant[]) {
        let sum = 0;
    
        for(var i = 0; i < body.length; i++) {
            sum += BODYPART_COST[body[i]];
        }

        return sum;
    }

    private GetJobCode(job : dokCreepJob) {
        switch(job) {
            case dokCreepJob.Base:
                return 'Basic';
            case dokCreepJob.RoadBuilder:
                return 'Road Builder';
            case dokCreepJob.HeavyMiner:
                return 'Heavy Miner';
            case dokCreepJob.ControllerSlave:
                return 'Controller Slave';
            case dokCreepJob.Scout:
                return 'Scout';
            case dokCreepJob.Colonizer:
                return 'Colonizer';
            case dokCreepJob.RoomReserver:
                return 'Reserver';
            case dokCreepJob.ConstructionWorker:
                return 'Construction';
            case dokCreepJob.RoomDefender:
                return 'Defender';
            case dokCreepJob.RoomAttacker:
                return 'Attacker';
            case dokCreepJob.LinkStorageSlave:
                return 'LinkStorage Slave'
            case dokCreepJob.RemoteConstructionWorker:
                return 'RemoteConstruction'
            case dokCreepJob.RemoteMiner:
                return 'RemoteMiner';
            default:
                return 'Unknown'
        }
    }

    private RelinkRef() {
        this.roomRef = Game.rooms[this.roomRef.name];
    }

    private DoTicksOnTowers() {
        const towers = this.util.FindCached<StructureTower>(this.roomRef, FIND_MY_STRUCTURES).filter(i => i.structureType === 'tower');

        if (towers.length !== this.towers.length) {
            this.towers = [];

            for(const tower of towers) {
                const dokTowerInstance = new dokTower(this.util, this, tower);

                this.towers.push(dokTowerInstance);

                dokTowerInstance.Tick();
            }

            return;
        }

        for(const tower of this.towers) {
            const towerRef = towers.find(i => i.id === tower.GetId());

            if (!towerRef) {
                console.log(`[dokUtil][dokRoom] tower ${tower.GetId()} does not exist anymore?`);

                continue;
            }

            tower.RelinkRef(towerRef);

            tower.Tick();
        }
    }

    private GenerateRoadsPlan() : RoomPosition[] {
        let roadsPlan: Array<RoomPosition> = [];

        const controllers = this.util.FindCached<Structure>(this.roomRef, FIND_MY_STRUCTURES).filter(i => i.structureType === 'controller');

        if (controllers.length === 0)
            return [];

        const spawns = this.util.FindCached<Structure>(this.roomRef, FIND_MY_STRUCTURES).filter(i => i.structureType === 'spawn');

        if (spawns.length === 0)
            return [];

        const controller = controllers[0];
        const spawn = spawns[0];

        const mainRoad = dokUtil.GetPosPathBetween(this.roomRef, controller, spawn);

        // generate a road around spawn
        roadsPlan.push(new RoomPosition(spawn.pos.x, spawn.pos.y - 1, spawn.pos.roomName))
        roadsPlan.push(new RoomPosition(spawn.pos.x, spawn.pos.y + 1, spawn.pos.roomName))
        roadsPlan.push(new RoomPosition(spawn.pos.x - 1, spawn.pos.y, spawn.pos.roomName))
        roadsPlan.push(new RoomPosition(spawn.pos.x + 1, spawn.pos.y, spawn.pos.roomName))

        roadsPlan = roadsPlan.concat(mainRoad);

        const sources = this.util.FindCached<Source>(this.roomRef, FIND_SOURCES_ACTIVE);

        for(const source of sources) {
            const sourceRoad = dokUtil.GetPosPathBetween(this.roomRef, source, spawn);

            roadsPlan = roadsPlan.concat(sourceRoad);
        }

        const towers = this.util.FindCached<StructureTower>(this.roomRef, FIND_STRUCTURES).filter(i => i.structureType === 'tower');

        for(const tower of towers) {
            const sourceRoad = dokUtil.GetPosPathBetween(this.roomRef, spawn, tower);

            roadsPlan = roadsPlan.concat(sourceRoad);
        }

        return roadsPlan;
    }

    public GetRoadsPlan() : Array<RoomPosition> {
        if (typeof this.memory.roadsPlanLastRan === 'undefined' || this.util.GetTickCount() - this.memory.roadsPlanLastRan >= 200) {
            this.memory.roadsPlanLastRan = this.util.GetTickCount();

            const freshRoadPlan = this.GenerateRoadsPlan();;

            this.memory.roadsPlan = freshRoadPlan;

            return freshRoadPlan;
        }

        if (typeof this.memory.roadsPlan === 'undefined')
            return [];

        return this.memory.roadsPlan.map(i => {
            return new RoomPosition(i.x, i.y, i.roomName);
        });
    }

    public NotifyRoomReserveTicks(roomReserve: dokRoomReserve) {
        if (typeof this.memory.reserveRoomTicks === 'undefined') {
            this.memory.reserveRoomTicks = [];
        }
        
        const roomAlreadyExists = this.memory.reserveRoomTicks.find(i => i.room === roomReserve.room);

        if (typeof roomAlreadyExists !== 'undefined') {
            
            for(const flag of roomReserve.flags) {
                if (!roomAlreadyExists.flags.includes(flag))
                    roomAlreadyExists.flags.push(flag);
            }

            roomAlreadyExists.ticks = roomReserve.ticks;

            if (roomAlreadyExists.ticks > 5000)
                roomAlreadyExists.locked = true;

            return;
        }

        this.memory.reserveRoomTicks.push(roomReserve);
    }

    private TickRoomReserves() {
        if (typeof this.memory.reserveRoomTicks === 'undefined')
            return;

        const livingFlags = this.util.GetFlagArray();

        for(const roomReserve of this.memory.reserveRoomTicks) {
            if (livingFlags.filter(i => roomReserve.flags.includes(i.name)).length === 0) {
                console.log(`[dokUtil][Room] removing room reserve memeory for flags ${roomReserve.flags.join(', ')}, flags could not be found!`)

                this.memory.reserveRoomTicks = this.memory.reserveRoomTicks.filter(i => i !== roomReserve);

                return;
            }

            roomReserve.ticks--;

            if (roomReserve.ticks <= 1200)
                roomReserve.locked = false;
        }
    }

    private TickCreepsHere() {
        const creepsFromRoom = this.util.GetKnownCreeps().filter(i => i.GetCurrentMemory().homeRoom === this.roomRef.name);

        creepsFromRoom.forEach(creep => {
            try {
                creep.Tick();
            }
            catch(e) {
                console.log(`[dokUtil] Failed to tick creep, error:\n${e}`);
            }
        })
    }

    private TickLinksInRoom() {
        if (!this.util.RunEveryTicks(20))
            return;

        const structures = this.util.FindCached<Structure>(this.roomRef, FIND_STRUCTURES);

        const storage = structures.find(i => i.structureType === 'storage');

        if (typeof storage === 'undefined') {
            console.log(`[dokUtil][Room] could not tick links, no storage exists!`)

            return;
        }

        const mainLink = structures.find(i => i.structureType === 'link' && i.pos.getRangeTo(storage) <= 5) as StructureLink;

        if (typeof mainLink === 'undefined') {
            console.log(`[dokUtil][Room] could not tick links, no main link exists!`)

            return;
        }

        const canHandle = mainLink.store.getFreeCapacity('energy');
        let remainingBal = canHandle;

        if (canHandle <= 0) {
            console.log(`[dokUtil][Room] main link is full!`)

            return;
        }

        const sourceLinks = structures.filter(i => {
            if (i.structureType !== 'link')
                return false;

            if (i === mainLink)
                return false;

            return i.pos.findInRange(FIND_SOURCES, 5).length > 0;
        }) as StructureLink[];

        for(const sourceLink of sourceLinks) {
            if (remainingBal <= 600) {
                continue;
            }

            if (sourceLink.cooldown > 0) {
                continue;
            }

            if (sourceLink.store.energy <= 700) {
                continue;
            }

            console.log(`[dokUtil][dokRoom][${this.roomRef.name}] link ${sourceLink.id} -> ${mainLink.id}`)

            const storedEnergy = sourceLink.store.energy;
            let willTransfer = storedEnergy;

            if (storedEnergy > remainingBal) {
                willTransfer = remainingBal;
            }

            sourceLink.transferEnergy(mainLink, willTransfer);

            remainingBal = mainLink.store.getFreeCapacity('energy');
        }
    }
 
    public GetName() {
        return this.roomRef.name;
    }

    public GetRef() {
        return this.roomRef;
    }

    public Tick() {
        this.RelinkRef();

        this.MonitorSpawn();

        this.DoTicksOnTowers();
        
        this.TickCreepsHere();

        this.TickRoomReserves();

        this.TickLinksInRoom();

        this.SaveMemory();
    }
}