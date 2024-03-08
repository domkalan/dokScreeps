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

    scoutPlan?:  Array<dokRoomScoutPlan>;
    scoutPlanPausedUtil?: number;

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

    private NextCreepJob() : dokCreepJob | null {
        const rclLevel = this.roomRef.controller?.level || 0;
        const rclLimits = dokUtil.getRclLimits(this.roomRef.controller?.level || 0);

        // how much extensions do we have
        const publicStructures = this.util.FindCached<Structure>(this.roomRef, FIND_STRUCTURES).filter(i => ['road', 'constructedWall'].includes(i.structureType));
        const publicStructuresDamaged = publicStructures.filter(i => i.hits <= i.hitsMax * 0.50);
        const structures = this.util.FindCached<Structure>(this.roomRef, FIND_MY_STRUCTURES);
        const extensions = structures.filter(i => i.structureType === 'extension') as Array<StructureExtension>;
        const sources = this.util.FindCached<Source>(this.roomRef, FIND_SOURCES);
        const constructions = this.util.FindCached<ConstructionSite>(this.roomRef, FIND_MY_CONSTRUCTION_SITES);
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

        const constructionCreeps = creepsFromRoom.filter(i => i.GetCurrentMemory().job === dokCreepJob.ConstructionWorker);

        // scout plan active
        let scoutPlanActive = true;
        if (typeof this.memory.scoutPlanPausedUtil !== 'undefined') {
            const timeNow = Math.floor(Date.now() / 1000);

            if (timeNow - this.memory.scoutPlanPausedUtil < 86400) {
                scoutPlanActive = false;
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

        if (rclLevel >= 4 && scoutCreeps.length < 1 && scoutPlanActive) {
            return dokCreepJob.Scout;
        }

        if (colonyPlan && colonizerCreeps.length < colonyLimit) {
            return dokCreepJob.Colonizer;
        }

        if (reserveFlags.length > 0 && reserveCreeps.length < reserveFlags.length) {
            return dokCreepJob.RoomReserver;
        }

        return null;
    }

    private AttemptBodyBoost(body: BodyPartConstant[], energy: number, maxStack: number = Infinity, currentStack = 0) : BodyPartConstant[] {
        if (currentStack >= maxStack)
            return body;

        const bodyBoost = body.concat(body);

        if (this.CalcBodyCost(bodyBoost) > energy) {
            return body;
        }

        return this.AttemptBodyBoost(bodyBoost, energy, maxStack, currentStack++);
    }

    private CreepBodyType(job: dokCreepJob, energy: number) : BodyPartConstant[] {
        let bodyType : Array<BodyPartConstant> = [WORK, CARRY, MOVE];
        let bodyMaxStack = Infinity;

        // heavy miners have a special job
        if (job === dokCreepJob.HeavyMiner) {
            bodyType = [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE]
        }

        // road builders should be base, just like controller slaves
        if (job === dokCreepJob.RoadBuilder || job === dokCreepJob.ControllerSlave) {
            return bodyType;
        }

        // scouts are expendable, some of you will die, but that is a sacrafice i am willing to make
        if (job === dokCreepJob.Scout) {
            return [MOVE]
        }

        // room reservers have a special job, but they can also stack
        if (job === dokCreepJob.RoomReserver) {
            bodyMaxStack = 4;
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

        return this.AttemptBodyBoost(bodyType, energy, bodyMaxStack);
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

        if (!this.util.RunEveryTicks(10) || hostilesHere.length !== 0)
            return;

        // get room spawner
        const spawner = this.util.FindCached<StructureSpawn>(this.roomRef, FIND_MY_SPAWNS);

        if (spawner.length === 0)
            return;

        // single select our spawner
        const spawn = spawner[0];

        // dont focus if we are spawning something
        if (spawn.spawning)
        return;

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

    public AddScoutRoom(currentRoom: string | null, roomName: string) {
        if (typeof this.memory.scoutPlan === 'undefined')
            return;

        console.log(`[dokUtil][dokRoom][ScoutPlanning] informed of room ${roomName} access from ${currentRoom}`);

        const scoutEntry = this.memory.scoutPlan.find(i => i.room === roomName);

        if (typeof scoutEntry !== 'undefined') {
            console.log(`[dokUtil][dokRoom][ScoutPlanning] will not add ${roomName} to plan, already exists in plan!`)

            return;
        }

        this.memory.scoutPlan.push({
            room: roomName,
            priorRoom: currentRoom,

            seenAt: this.util.GetTickCount(),
            lastVisited: 0,

            hostile: false,

            threatRating: null,
            baseRating: null,
            profitabilityRating: null,

            roomOwner: null,
            roomLevel: null,
            roomOwnable: false,
            roomSafeMode: false,

            roomType: Game.map.getRoomStatus(roomName),

            myRoom: false,

            inaccessible: false,
            inaccessibleAt: 0,

            accessAttempts: 0
        });
    }

    public GetScoutPlan() {
        if (typeof this.memory.scoutPlan === 'undefined') {
            this.memory.scoutPlan = [];
        }

        if (this.memory.scoutPlan.length === 0) {
            this.AddScoutRoom(null, this.roomRef.name);
        }

        return this.memory.scoutPlan;
    }

    public RunScoutScanOnRoom(roomRef: Room, quickScan: boolean = false) {
        if (typeof this.memory.scoutPlan === 'undefined')
            return;

        // get our current room entry
        const roomScoutEntry = this.memory.scoutPlan.find(i => i.room === roomRef.name);

        // if room does not have entry...?
        if (typeof roomScoutEntry === 'undefined')
            return;

        const structuresHere = roomRef.find(FIND_STRUCTURES);
        const creepsHere = roomRef.find(FIND_CREEPS)
        const sourcesHere = roomRef.find(FIND_SOURCES);

        const controllerHere = structuresHere.find(i => i.structureType === 'controller') as StructureController;

        if (typeof controllerHere !== 'undefined') {
            // if the room has a controller we can own it
            roomScoutEntry.roomOwnable = true;

            // get the room controller level
            roomScoutEntry.roomLevel = controllerHere.level;

            // is the room in safe mode?
            roomScoutEntry.roomSafeMode = (controllerHere.safeMode || 0) > 0

            // get the owner of the room
            roomScoutEntry.roomOwner = (controllerHere.owner?.username || null);

            // do we own this room?
            roomScoutEntry.myRoom = roomScoutEntry.roomOwner === 'dokman';
        } else {
            roomScoutEntry.roomOwnable = false;
        }

        // update room type
        roomScoutEntry.roomType = Game.map.getRoomStatus(roomRef.name);

        // calculate threat score
        const towersHere = structuresHere.filter(i => i.structureType === 'tower');
        const nukersHere = structuresHere.filter(i => i.structureType === 'nuker');
        const hostileCreepsHere = creepsHere.filter(i => i.getActiveBodyparts(ATTACK) > 0 || i.getActiveBodyparts(RANGED_ATTACK));

        let threatScore = 0;

        threatScore += (towersHere.length * 4);
        threatScore += (nukersHere.length * 100);
        threatScore += (hostileCreepsHere.length * 1.5);

        roomScoutEntry.threatRating = threatScore;

        // calculate the base rating
        let baseScore = 0;

        const extensionsHere = structuresHere.filter(i => i.structureType === 'extension') as StructureExtension[];
        const labsHere = structuresHere.filter(i => i.structureType === 'lab');
        const linksHere = structuresHere.filter(i => i.structureType === 'link');

        baseScore += (extensionsHere.reduce((partialSum, a) => partialSum + a.store.energy, 0) * 2.5);
        baseScore += (creepsHere.reduce((partialSum, a) => partialSum + a.store.energy, 0) * 2.5);
        baseScore += labsHere.length * 2;
        baseScore += linksHere.length;

        roomScoutEntry.baseRating = baseScore;

        // profitability is based on distance from sources to controller, the lower number the better
        let profitScore = 0;

        if (typeof controllerHere !== 'undefined') {
            if (sourcesHere.length === 2) {
                const sourceOne = sourcesHere[0];
                const sourceTwo = sourcesHere[1];
                const controller = controllerHere;

                profitScore += dokUtil.getDistance(sourceOne.pos, sourceTwo.pos);
                profitScore += dokUtil.getDistance(sourceOne.pos, controller.pos);
                profitScore += dokUtil.getDistance(sourceTwo.pos, controller.pos);
            } else if (sourcesHere.length === 1) {
                const sourceOne = sourcesHere[0];
                const controller = controllerHere;

                // add offset for only one source
                profitScore += 200;

                profitScore += dokUtil.getDistance(sourceOne.pos, controller.pos);
            }
        }
        
        roomScoutEntry.profitabilityRating = profitScore;

        // get rooms connected to this room
        const roomExits = Game.map.describeExits(roomRef.name);

        if (!quickScan) {
            // we survived long enough to scout, so lets set it as safe
            roomScoutEntry.hostile = true;
        } else {
            // if we quick scanned this room, its acessible right? (we should have been in here for at least 15 ticks)
            roomScoutEntry.inaccessible = false;
            roomScoutEntry.inaccessibleAt = 0;

            // if we survived here for 15 ticks, we could consider it not hostile
            roomScoutEntry.hostile = false;
        }

        // update the time we last scanned it
        roomScoutEntry.lastVisited = this.util.GetTickCount();

        // we made it to this room so access attempts are now 0
        roomScoutEntry.accessAttempts = 0;

        // room above us
        if (typeof roomExits[1] !== 'undefined') {
            const roomDistance = Game.map.getRoomLinearDistance(this.roomRef.name, roomExits[1]);

            if (roomDistance <= 5) {
                this.AddScoutRoom(roomRef.name, roomExits[1]);
            } else {
                console.log(`[dokRoom][Scout] room ${roomExits[1]} is too far! ${roomDistance}`);
            }
        }

        // room to right
        if (typeof roomExits[3] !== 'undefined') {
            const roomDistance = Game.map.getRoomLinearDistance(this.roomRef.name, roomExits[3]);

            if (roomDistance <= 5) {
                this.AddScoutRoom(roomRef.name, roomExits[3]);
            } else {
                console.log(`[dokRoom][Scout] room ${roomExits[3]} is too far! ${roomDistance}`);
            }
        }

        // room to bottom
        if (typeof roomExits[5] !== 'undefined') {
            const roomDistance = Game.map.getRoomLinearDistance(this.roomRef.name, roomExits[5]);

            if (roomDistance <= 5) {
                this.AddScoutRoom(roomRef.name, roomExits[5]);
            } else {
                console.log(`[dokRoom][Scout] room ${roomExits[5]} is too far! ${roomDistance}`);
            }
        }

        // room to left
        if (typeof roomExits[7] !== 'undefined') {
            const roomDistance = Game.map.getRoomLinearDistance(this.roomRef.name, roomExits[7]);

            if (roomDistance <= 5) {
                this.AddScoutRoom(roomRef.name, roomExits[7]);
            } else {
                console.log(`[dokRoom][Scout] room ${roomExits[7]} is too far! ${roomDistance}`);
            }
        }
    }

    public SetScoutRoomNotHostile(roomRef: Room) {
        if (typeof this.memory.scoutPlan === 'undefined')
            return;

        // get our current room entry
        const roomScoutEntry = this.memory.scoutPlan.find(i => i.room === roomRef.name);

        // if room does not have entry...?
        if (typeof roomScoutEntry === 'undefined')
            return;

        roomScoutEntry.hostile = false;
    }

    public SetScoutRoomInaccessable(roomName: string) {
        if (typeof this.memory.scoutPlan === 'undefined')
            return;

        // get our current room entry
        const roomScoutEntry = this.memory.scoutPlan.find(i => i.room === roomName);

        // if room does not have entry...?
        if (typeof roomScoutEntry === 'undefined')
            return;

        roomScoutEntry.inaccessible = true;
        roomScoutEntry.inaccessibleAt = this.util.GetTickCount();
    }

    public LogScoutRoomAttempt(roomName: string) {
        if (typeof this.memory.scoutPlan === 'undefined')
            return;

        // get our current room entry
        const roomScoutEntry = this.memory.scoutPlan.find(i => i.room === roomName);

        // if room does not have entry...?
        if (typeof roomScoutEntry === 'undefined')
            return;

        roomScoutEntry.accessAttempts++;
    }
    
    public PauseScouts() {
        this.memory.scoutPlanPausedUtil = Math.floor(Date.now() / 1000);
    }
    
    public ColonizeRoom(room : string) {
        this.memory.colonizeRoom = room;
    }

    public GetColonizeRoom() {
        return this.memory.colonizeRoom;
    }

    public NotifyColonizeRoomTaken() {
        this.memory.colonizeRoomController = true;
    }

    public ClearColonizeRoom() {
        if (typeof this.memory.scoutPlan !== 'undefined') {
            const roomScoutEntry = this.memory.scoutPlan.find(i => i.room === this.memory.colonizeRoom);

            if (typeof roomScoutEntry !== 'undefined') {
                roomScoutEntry.myRoom = true;
            }
        }

        this.memory.colonizeRoom = undefined;
        this.memory.colonizeRoomController = undefined;
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

        this.SaveMemory();
    }
}