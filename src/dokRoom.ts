import dokCreep, { dokCreepJob, dokCreepMemory } from "./creeps/Base";
import dokTower from "./dokTower";
import dokUtil from "./dokUtil";

export interface dokReserveEntry {
    name: string;
    ticks: number;
    met: boolean
}

export interface dokRoomMemory {
    spawnCount: number;

    needsEnergy?: boolean;
    needsEnergyLocked?: boolean;
    needsEnergySent?: boolean;

    terminalMode?: string;
    terminalSendTo?: string;

    reserveTicks?: Array<dokReserveEntry>;
}

export default class dokRoom {
    private util: dokUtil;
    private roomRef: Room;

    private memory: dokRoomMemory;

    private towers: Array<dokTower> = [];

    private aliveTicks: number = 0;

    private boostedCreeps: boolean = false;
    private reducedCreeps: boolean = true;

    constructor(util : dokUtil, room: Room) {
        this.util = util;
        this.roomRef = room;

        this.memory = this.ReadMemory();

        const randomTickOffset = dokUtil.genRandomNumber(2, 12);

        console.log(`[dokUtil][dokRoom][${this.roomRef.name}] random tick offset is ${randomTickOffset}`);

        this.aliveTicks += randomTickOffset;
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

    private NextCreepJob() : Array<dokCreepJob> {
        const rclLevel = this.roomRef.controller?.level || 0;
        const rclLimits = dokUtil.getRclLimits(this.roomRef.controller?.level || 0);

        // how much extensions do we have
        const publicStructures = this.util.FindResource<Structure>(this.roomRef, FIND_STRUCTURES).filter(i => ['road', 'constructedWall', 'storage', 'link'].includes(i.structureType));
        const publicStructuresDamaged = publicStructures.filter(i => i.hits <= i.hitsMax * 0.50);
        const structures = this.util.FindResource<Structure>(this.roomRef, FIND_MY_STRUCTURES);
        const extensions = structures.filter(i => i.structureType === 'extension') as Array<StructureExtension>;
        const sources = this.util.FindResource<Source>(this.roomRef, FIND_SOURCES);
        const constructions = this.util.FindResource<ConstructionSite>(this.roomRef, FIND_MY_CONSTRUCTION_SITES);
        const storages = publicStructures.filter(i => i.structureType === 'storage');
        const links = publicStructures.filter(i => i.structureType === 'link');
        const flags = this.util.GetFlagArray();

        // filter resources here
        const towersHere = structures.filter(i => i.structureType === 'tower') as Array<StructureTower>;

        // filter hostiles here
        const hostiles = this.util.FindResource<Creep>(this.roomRef, FIND_HOSTILE_CREEPS);
        const hostilePower = this.util.FindResource<PowerCreep>(this.roomRef, FIND_HOSTILE_POWER_CREEPS);

        // get all creeps that born from this room
        let creepsFromRoom: Array<dokCreep> = [];

        // sometimes this errors out if we have a creep that died on the same tick as this
        try {
            creepsFromRoom = this.util.GetKnownCreeps().filter(i => i.GetCurrentMemory().homeRoom === this.roomRef.name && (i.GetRef().ticksToLive || 21) >= 20);
        } catch(error) {
            creepsFromRoom = this.util.GetKnownCreeps().filter(i => i.GetCurrentMemory().homeRoom === this.roomRef.name);
        }

        // get base creeps
        const baseCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.Base);

        // road builder creeps
        const roadCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.RoadBuilder);

        // heavy miners
        const heavyMinerCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.HeavyMiner);

        // controller slave
        const controllerSlaveCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.ControllerSlave);

        // controller slave
        const defenderCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.RoomDefender);

        // colonizer creeps
        const colonizerCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.Colonizer);
        const colornizerFlags = flags.filter(i => {
            if (i.name.startsWith(`${this.roomRef.name} Colonize`)) {
                return true;
            }

            if (i.name.startsWith(`${this.roomRef.name} Reserve`)) {
                return !this.GetReserveMet(i.pos.roomName);
            }
        });

        // colonizer creeps
        const remoteConstructionCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.RemoteConstruction);
        const remoteConstructionFlags = flags.filter(i => i.name.startsWith(`${this.roomRef.name} Construct`));
        let remoteConstructLimit = 0;

        for(const flag of remoteConstructionFlags) {
            const flagObj = flag.name.replace(`${this.roomRef.name} Construct `, '').split(' ');

            if (flagObj.length === 2) {
                remoteConstructLimit += Number(flagObj[1]);
            } else {
                remoteConstructLimit += 1;
            }
        }

        // power hauler creeps
        const powerHaulerCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.PowerHauler);
        const powerHaulerFlags = flags.filter(i => i.name.startsWith(`${this.roomRef.name} PowerHauler`));
        const canHaulerFlags = flags.filter(i => i.name.startsWith(`${this.roomRef.name} CanHauler`));

        const haulerFlags: Flag[] = powerHaulerFlags.concat(canHaulerFlags);

        let haulerLimit = 0;

        for(const flag of haulerFlags) {
            const flagObj = flag.name.replace(`${this.roomRef.name} PowerHauler `, '').split(' ');

            if (flagObj.length === 2) {
                haulerLimit+= Number(flagObj[1]);
            } else {
                haulerLimit += 1;
            }
        }

        // construction creeps
        const constructionCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.ConstructionWorker);

        // storage slaves
        const storageSlave = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.LinkStorageSlave);

        // remote miner flags
        const remoteMinerCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.RemoteMiner);
        const minerFlags = flags.filter(i => i.name.startsWith(this.roomRef.name + ' Mine'));
        let minerFlagLimits = 0;

        for(const flag of minerFlags) {
            const flagObj = flag.name.replace(`${this.roomRef.name} Mine `, '').split(' ');

            if (flagObj.length === 2) {
                minerFlagLimits += Number(flagObj[1]);
            } else {
                minerFlagLimits += 1;
            }
        }

        // power miner creeps
        const remotePowerMinerCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.PowerMiner);
        const powerMinerFlags = flags.filter(i => i.name.startsWith(this.roomRef.name + ' PowerMine'));

        // attack creeps
        const offenseCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.RoomAttacker);
        const offenseFlags = flags.filter(i => i.name.startsWith(this.roomRef.name + ' Attack'));

        // healer creeps
        const healerCreeps = creepsFromRoom.filter(i => i.GetJob() === dokCreepJob.Healer);

        // road builder limits
        let roadBuilderLimit = 1;
        if (towersHere.length > roadBuilderLimit) {
            roadBuilderLimit = towersHere.length;
        }

        let jobCodes : Array<dokCreepJob> = [];

        // if we have hostiles, go into defenense mode
        if (hostiles.length > 0 || hostilePower.length > 0) {
            if (baseCreeps.length < 1) {
                jobCodes.push(dokCreepJob.Base);
            }

            jobCodes.push(dokCreepJob.RoomDefender);
        }
        
        if (baseCreeps.length < rclLevel) {
            jobCodes.push(dokCreepJob.Base);
        }

        if (rclLevel >= 2 && rclLimits.extensions >= 5 && roadCreeps.length < roadBuilderLimit) {
            jobCodes.push(dokCreepJob.RoadBuilder);
        }

        if (heavyMinerCreeps.length > 0 && controllerSlaveCreeps.length < 2) {
            jobCodes.push(dokCreepJob.ControllerSlave);
        }

        if (extensions.length > 5 && heavyMinerCreeps.length < sources.length) {
            jobCodes.push(dokCreepJob.HeavyMiner);
        }

        if (rclLevel >= 4 && (constructions.length > 0 || publicStructuresDamaged.length > 0) && constructionCreeps.length < 1) {
            jobCodes.push(dokCreepJob.ConstructionWorker);
        }

        if (links.length >= 2 && storages.length >= 1 && storageSlave.length < 1) {
            jobCodes.push(dokCreepJob.LinkStorageSlave);
        }

        if (colornizerFlags.length > colonizerCreeps.length) {
            jobCodes.push(dokCreepJob.Colonizer);
        }

        if (remoteConstructLimit > remoteConstructionCreeps.length) {
            jobCodes.push(dokCreepJob.RemoteConstruction);
        }

        if (minerFlagLimits > remoteMinerCreeps.length + 0.5) {
            jobCodes.push(dokCreepJob.RemoteMiner);
        }

        if (powerHaulerCreeps.length < haulerLimit) {
            jobCodes.push(dokCreepJob.PowerHauler);
        }

        if ((healerCreeps.length < remotePowerMinerCreeps.length * 2) || healerCreeps.length < Math.floor(offenseCreeps.length / 5)) {
            jobCodes.push(dokCreepJob.Healer);
        }

        if (remotePowerMinerCreeps.length < powerMinerFlags.length * 2) {
            jobCodes.push(dokCreepJob.PowerMiner);
        }

        if (offenseCreeps.length < offenseFlags.length * 6) {
            jobCodes.push(dokCreepJob.RoomAttacker);
        }

        // energy processing santiy checks
        if (this.reducedCreeps && rclLevel >= 5) {
            if (baseCreeps.length >= 2) {
                jobCodes = jobCodes.filter(i => i !== dokCreepJob.Base);
            }

            if (roadCreeps.length >= 1) {
                jobCodes = jobCodes.filter(i => i !== dokCreepJob.RoadBuilder);
            }

            if (controllerSlaveCreeps.length >= 1) {
                jobCodes = jobCodes.filter(i => i !== dokCreepJob.ControllerSlave);
            }
        }

        // if we are in the starting phase, we need a lot of these guys
        if (rclLevel <= 3 && baseCreeps.length < 5 * sources.length) {
            jobCodes.push(dokCreepJob.Base);
        }

        return jobCodes;
    }

    private AttemptBodyBoost(body: BodyPartConstant[], energy: number, maxStack: number) : BodyPartConstant[] {
        let currentBody = JSON.parse(JSON.stringify(body));
        let currentStack = 1;

        while(true) {
            let newStackedBody = JSON.parse(JSON.stringify(currentBody));

            for(const part of body) {
                newStackedBody.push(part);
            }

            // check if our new body stack meets energy
            if (this.CalcBodyCost(newStackedBody) > energy) {
                break;
            }

            if (newStackedBody.length > 50) {
                break;
            }

            currentBody = newStackedBody;

            // only build the stack as big as it should get
            currentStack++;
            if (currentStack >= maxStack) {
                break;
            }
            
        }

        return currentBody;
    }

    private CreepBodyType(job: dokCreepJob, energy: number) : BodyPartConstant[] {
        const rclLevel = this.roomRef.controller?.level || 0;

        let bodyType : Array<BodyPartConstant> = [WORK, MOVE, CARRY];
        let bodyMaxStack = 3;

        if (rclLevel >= 5) {
            bodyMaxStack = Infinity;
        }

        // heavy miners have a special job
        if (job === dokCreepJob.HeavyMiner) {
            bodyMaxStack = 2;
            bodyType = [WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE]
        }

        if (job === dokCreepJob.LinkStorageSlave) {
            bodyMaxStack = 2;
            bodyType = [MOVE, CARRY, CARRY];
        }

        if (job === dokCreepJob.RemoteMiner) {
            bodyType = [WORK, WORK, WORK, MOVE, MOVE, MOVE, CARRY, MOVE];
        }

        // Special job code for room defenders
        if (job === dokCreepJob.RoomDefender) {
            bodyType = [TOUGH, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE];
        }

        if (job === dokCreepJob.RoomAttacker) {
            bodyType = [TOUGH, ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE];
        }

        if (job === dokCreepJob.Colonizer) {
            bodyType = [MOVE, CLAIM]
        }

        if (job === dokCreepJob.PowerMiner) {
            return [
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
                ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, HEAL
            ];
        }

        if (job === dokCreepJob.Healer) {
            bodyType = [
                HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ];
        }

        if (job === dokCreepJob.PowerHauler) {
            return [
                MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY,
                MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY,
                MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY
            ]
        }

        // lower max stack if we are low on juice
        if (!this.boostedCreeps && rclLevel >= 5) {
            bodyMaxStack = 1;
        }

        return this.AttemptBodyBoost(bodyType, energy, bodyMaxStack);
    }

    private MonitorSpawn() {
        if (!dokUtil.runEvery(this.aliveTicks, 8))
            return;

        // get room spawner
        const spawner = this.util.FindResource<StructureSpawn>(this.roomRef, FIND_MY_SPAWNS).filter(i => !i.spawning);

        if (spawner.length === 0)
            return;

        let spawn = spawner[0];

        // what job should we run next
        const nextJobs = this.NextCreepJob();

        // if no jobs, wait for work
        if (nextJobs.length === 0) {
            new RoomVisual(spawn.room.name).text(`💤`, spawn.pos.x, spawn.pos.y + 2, { align: 'center' });

            return
        }

        // const get all energy sources
        const structures = this.util.FindResource<Structure>(this.roomRef, FIND_STRUCTURES);
        const extensions = structures.filter(i => i.structureType === 'extension') as StructureExtension[];
        const storage = structures.find(i => i.structureType === 'storage') as StructureStorage;

        // get the energy on standby
        let energyReady = spawn.store.energy;

        for(const extension of extensions) {
            energyReady += extension.store.getUsedCapacity('energy');
        }

        // select next job
        let nextJob = nextJobs.shift();

        if (typeof nextJob === 'undefined')
            return;

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

        const creepName = `${spawn.name}:${jobCode}:${this.memory.spawnCount}`;

        // if we have enough energy
        if (energyReady < bodyCost) {
            new RoomVisual(spawn.room.name).text(`${jobCode} ${bodyCost}/${energyReady}`, spawn.pos.x, spawn.pos.y + 2, { align: 'center' });

            return;
        }

        // etablish base memory
        const spawnMemory: dokCreepMemory = {
            homeRoom: this.roomRef.name,

            job: nextJob,
            task: 0,

            aliveFor: 0
        };

        let targetPos = spawn.pos;

        // try to pull from extensions closer to storage
        if (typeof storage !== 'undefined') {
            targetPos = storage.pos;
        }

        // attempt spawn
        const spawnCode = spawn.spawnCreep(bodyParts, creepName, {
            memory: spawnMemory,
            energyStructures: [ spawn as any ].concat(extensions.sort((a, b) => dokUtil.getDistance(a.pos, targetPos) - dokUtil.getDistance(b.pos, targetPos)))
        });

        // if spawn worked, then yes :)
        if (spawnCode === OK) {
            this.util.AddCreepToRuntime(creepName);

            new RoomVisual(spawn.room.name).text(`👶 ${creepName}`, spawn.pos.x, spawn.pos.y + 2, { align: 'center' });

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
            case dokCreepJob.Colonizer:
                return 'Colonizer';
            case dokCreepJob.ConstructionWorker:
                return 'Construction';
            case dokCreepJob.RoomDefender:
                return 'Defender';
            case dokCreepJob.RoomAttacker:
                return 'Attacker';
            case dokCreepJob.LinkStorageSlave:
                return 'LinkStorage Slave'
            case dokCreepJob.RemoteMiner:
                return 'RemoteMiner';
            case dokCreepJob.RemoteConstruction:
                return 'RemoteConstruct';
            case dokCreepJob.Healer:
                return 'Healer';
            case dokCreepJob.PowerMiner:
                return 'PowerMiner';
            case dokCreepJob.PowerHauler:
                return 'PowerHauler';
            default:
                return 'Unknown'
        }
    }

    private RelinkRef() {
        this.roomRef = Game.rooms[this.roomRef.name];
    }

    private DoTicksOnTowers() {
        const towers = this.util.FindResource<StructureTower>(this.roomRef, FIND_MY_STRUCTURES).filter(i => i.structureType === 'tower');

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

        const controllers = this.util.FindResource<Structure>(this.roomRef, FIND_MY_STRUCTURES).filter(i => i.structureType === 'controller');

        if (controllers.length === 0)
            return [];

        const spawns = this.util.FindResource<Structure>(this.roomRef, FIND_MY_STRUCTURES).filter(i => i.structureType === 'spawn');

        if (spawns.length === 0)
            return [];

        const controller = controllers[0];
        const spawn = spawns[0];

        const mainRoad = dokUtil.GetPosPathBetween(controller, spawn);

        // generate a road around spawn
        roadsPlan.push(new RoomPosition(spawn.pos.x, spawn.pos.y - 1, spawn.pos.roomName))
        roadsPlan.push(new RoomPosition(spawn.pos.x, spawn.pos.y + 1, spawn.pos.roomName))
        roadsPlan.push(new RoomPosition(spawn.pos.x - 1, spawn.pos.y, spawn.pos.roomName))
        roadsPlan.push(new RoomPosition(spawn.pos.x + 1, spawn.pos.y, spawn.pos.roomName))

        roadsPlan = roadsPlan.concat(mainRoad);

        const sources = this.util.FindResource<Source>(this.roomRef, FIND_SOURCES_ACTIVE);

        for(const source of sources) {
            const sourceRoad = dokUtil.GetPosPathBetween(source, spawn);

            roadsPlan = roadsPlan.concat(sourceRoad);
        }

        const towers = this.util.FindResource<StructureTower>(this.roomRef, FIND_STRUCTURES).filter(i => i.structureType === 'tower');

        for(const tower of towers) {
            const sourceRoad = dokUtil.GetPosPathBetween(spawn, tower);

            roadsPlan = roadsPlan.concat(sourceRoad);
        }

        return roadsPlan;
    }

    public GetRoadsPlan() : Array<RoomPosition> {
        return this.GenerateRoadsPlan();
    }

    private TickLinksInRoom() {
        if (!this.util.RunEveryTicks(20))
            return;

        const structures = this.util.FindResource<Structure>(this.roomRef, FIND_STRUCTURES);

        const storage = structures.find(i => i.structureType === 'storage');

        if (typeof storage === 'undefined') {
            return;
        }

        const mainLink = structures.find(i => i.structureType === 'link' && i.pos.getRangeTo(storage) <= 5) as StructureLink;

        if (typeof mainLink === 'undefined') {
            return;
        }

        const canHandle = mainLink.store.getFreeCapacity('energy');
        let remainingBal = canHandle;

        if (canHandle <= 0) {
            console.log(`[dokUtil][Room] main link is full!`)

            return;
        }

        const sourceLinks = (structures.filter(i => {
            if (i.structureType !== 'link')
                return false;

            if (i === mainLink)
                return false;

            return i.pos.findInRange(FIND_SOURCES, 5).length > 0;
        }) as StructureLink[]).sort((a, b) => a.store.getUsedCapacity('energy') - b.store.getUsedCapacity('energy'));

        for(const sourceLink of sourceLinks) {
            if (remainingBal <= 100) {
                continue;
            }

            if (sourceLink.cooldown > 0) {
                continue;
            }

            const storedEnergy = sourceLink.store.energy;
            let willTransfer = storedEnergy;

            if (storedEnergy > remainingBal) {
                willTransfer = remainingBal;
            }

            sourceLink.transferEnergy(mainLink, willTransfer);

            remainingBal = mainLink.store.getFreeCapacity('energy');
        }
    }

    public TickOnLink(link : StructureLink) {
        const structures = this.util.FindResource<Structure>(this.roomRef, FIND_STRUCTURES);

        const storage = structures.find(i => i.structureType === 'storage');

        if (typeof storage === 'undefined') {
            return;
        }

        const mainLink = structures.find(i => i.structureType === 'link' && i.pos.getRangeTo(storage) <= 5) as StructureLink;

        if (typeof mainLink === 'undefined') {
            return;
        }

        const canHandle = mainLink.store.getFreeCapacity('energy');

        if (canHandle <= 0) {
            console.log(`[dokUtil][Room] main link is full!`)

            return;
        }

        const linkToTick = structures.find(i => i.id === link.id) as StructureLink;

        if (typeof linkToTick === 'undefined') {
            return;
        }

        if (linkToTick.cooldown > 0 && mainLink.cooldown > 0) {
            return;
        }

        linkToTick.transferEnergy(mainLink, linkToTick.store.energy);
    }

    public NotifyReserveTicks(name: string, ticks: number) {
        if (typeof this.memory.reserveTicks === 'undefined')
            this.memory.reserveTicks = [];

        const existingEntry = this.memory.reserveTicks.find(i => i.name === name);

        if (typeof existingEntry !== 'undefined') {
            existingEntry.ticks = ticks;
            existingEntry.met = ticks >= 4800;

            return;
        }

        this.memory.reserveTicks.push({
            name,
            ticks,
            met: ticks >= 4800
        });
    }

    /**
     * @deprecated
     */
    public GetReserveTicks(name: string) {
        if (typeof this.memory.reserveTicks === 'undefined')
            this.memory.reserveTicks = [];

        const existingEntry = this.memory.reserveTicks.find(i => i.name === name);

        if (typeof existingEntry !== 'undefined')
            return existingEntry.ticks;

        return 0;
    }

    public GetReserveMet(name: string) {
        if (typeof this.memory.reserveTicks === 'undefined')
            this.memory.reserveTicks = [];

        const existingEntry = this.memory.reserveTicks.find(i => i.name === name);

        if (typeof existingEntry !== 'undefined' && typeof existingEntry.met !== 'undefined')
            return existingEntry.met;

        return false;
    }

    public GetReserveCount(name: string) {
        if (typeof this.memory.reserveTicks === 'undefined')
            this.memory.reserveTicks = [];

        const existingEntry = this.memory.reserveTicks.find(i => i.name === name);

        if (typeof existingEntry !== 'undefined')
            return existingEntry.ticks;

        return 0;
    }

    private DoRerserveTicks() {
        if (typeof this.memory.reserveTicks === 'undefined')
            this.memory.reserveTicks = [];

        for(const reserveEntry of this.memory.reserveTicks) {
            reserveEntry.ticks--;

            if (reserveEntry.ticks < 600 && reserveEntry.met)
                reserveEntry.met = false;
        }

        this.memory.reserveTicks = this.memory.reserveTicks.filter(i => i.ticks >= 0);
    }

    private CheckBoostedStatus() {
        if (!this.util.RunEveryTicks(10))
            return;

        const storage = this.util.FindResource<StructureStorage>(this.roomRef, FIND_STRUCTURES).find(i => i.structureType === 'storage');

        if (typeof storage === 'undefined')
            return;

        if (!this.boostedCreeps) {
            this.boostedCreeps = storage.store.energy >= 140000;
        } else if (this.boostedCreeps && storage.store.energy <= 60000) {
            this.boostedCreeps = false;
        }

        if (this.reducedCreeps) {
            this.reducedCreeps = !(storage.store.energy >= 160000)
        } else if (!this.reducedCreeps && storage.store.energy <= 100000) {
            this.reducedCreeps = true;
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

        this.TickLinksInRoom();

        this.DoRerserveTicks();

        this.CheckBoostedStatus();

        this.aliveTicks++

        this.SaveMemory();
    }
}