import dokUtil from "../dokUtil";
import dokCreep, { dokCreepJob, dokCreepTask } from "./Base";

export default class dokCreepRemoteMiner extends dokCreep {
    private focusedFlag: Flag | null = null;

    private buildingCan: boolean = false;

    private lastPeaceSent: number = 0;
    private lastPeaceGranted: boolean = false;

    protected RecycleCreep() {
        const homeRoom = this.util.GetDokRoom(this.memory.homeRoom);

        if (typeof homeRoom === 'undefined')
            return;

        const homeStructures = homeRoom.GetRef().find(FIND_STRUCTURES).filter(i => i.structureType === 'spawn') as StructureSpawn[];

        if (homeStructures.length === 0) {
            this.creepRef.say('NO SPAWN!')

            return;
        }

        const recycleCode = homeStructures[0].recycleCreep(this.creepRef);

        if (recycleCode === ERR_NOT_IN_RANGE) {
            this.moveToObject(homeStructures[0]);
        } else if (recycleCode === OK) {
            this.util.ReleaseLocks(this);
        }

        return;
    }

    protected MineDeposit(resource: Deposit, flag: Flag) {
        if (this.creepRef.store.getFreeCapacity() <= 0) {
            this.memory.task = dokCreepTask.Depost;

            this.lastPeaceGranted = false;

            return;
        }

        if (resource.lastCooldown >= 60) {
            flag.remove();

            return;
        }

        const creepsNearby = this.creepRef.pos.findInRange(FIND_CREEPS, 6).filter(i => i.owner.username !== this.creepRef.owner.username);

        if (creepsNearby.length > 0 && !this.lastPeaceGranted && this.creepRef.pos.getRangeTo(resource) <= 4) {
            if (this.lastPeaceSent === 0) {
                this.creepRef.say(`☮️`, true);
            }
            
            this.lastPeaceSent++;

            if (this.lastPeaceSent > 10) {
                this.lastPeaceSent = 0;
            }

            return;
        }

        if (resource.cooldown > 0 && this.creepRef.pos.getRangeTo(resource) <= 4) {
            this.creepRef.say(`⏱️`);

            return;
        }

        this.lastPeaceGranted = true;

        if (this.creepRef.harvest(resource) === ERR_NOT_IN_RANGE) {
            this.moveToObject(resource);
        }
    }

    protected MineMineral(mineral: Mineral) {
        if (this.creepRef.store.getFreeCapacity() <= 0) {
            this.memory.task = dokCreepTask.Depost;

            return;
        }

        const extractor = mineral.pos.findInRange(FIND_STRUCTURES, 0).find(i => i.structureType === 'extractor') as StructureExtractor;

        if (typeof extractor !== 'undefined' && extractor.cooldown > 0) {
            this.creepRef.say(`⏱️`);

            return;
        }

        if (this.creepRef.harvest(mineral) === ERR_NOT_IN_RANGE) {
            this.moveToObject(mineral);
        }
    }

    protected MineSource(source : Source, flag: Flag) {
        if (!flag.name.endsWith('Can')) {
            if (this.creepRef.store.getFreeCapacity() <= 0) {
                this.memory.task = dokCreepTask.Depost;
    
                return;
            }
        } else {
            if (this.creepRef.store.getFreeCapacity() <= 0 || this.buildingCan) {
                // find nearby storage cans
                const nearbyCans = this.creepRef.pos.findInRange(FIND_STRUCTURES, 3).filter(i => i.structureType === 'container') as StructureContainer[];

                // if a can exists
                if (nearbyCans.length > 0) {
                    // if the nearby can is damaged, repair
                    if (nearbyCans[0].hits < nearbyCans[0].hitsMax * 0.10) {
                        this.creepRef.repair(nearbyCans[0]);

                        return;
                    }

                    // if the nearby can is full, deposit
                    if (this.creepRef.transfer(nearbyCans[0], 'energy') === ERR_NOT_IN_RANGE) {
                        this.moveToObject(nearbyCans[0]);
                    }

                    return;
                }

                // check if nearby can construction exists
                const nearbyCanConstruction = this.creepRef.pos.findInRange(FIND_CONSTRUCTION_SITES, 3).filter(i => i.structureType === 'container');

                if (nearbyCanConstruction.length > 0) {
                    this.creepRef.build(nearbyCanConstruction[0]);

                    this.buildingCan = true;

                    if (this.creepRef.store.energy <= 0 || nearbyCanConstruction[0].progress > nearbyCanConstruction[0].progressTotal * 0.90) {
                        this.buildingCan = false;

                        return;
                    }

                    return;
                }

                const bestSpot = dokUtil.GetFreeSlots(this.creepRef.room, source, 3, 1, ['swamp']).filter(i => i.code === 1).sort((a, b) => dokUtil.getDistance(a.pos, source.pos) - dokUtil.getDistance(b.pos, source.pos));

                bestSpot.forEach(spot => {
                    if (spot.code === 0) {
                        new RoomVisual(spot.pos.roomName).circle(spot.pos, { fill: 'red' })

                        return;
                    }

                    new RoomVisual(spot.pos.roomName).circle(spot.pos, { fill: 'green' })
                })

                if (bestSpot.length === 0) {
                    this.creepRef.say('No overflow!');

                    return;
                }

                this.creepRef.room.createConstructionSite(bestSpot[0], 'container');
            }
        }

        const mineralCode = this.creepRef.harvest(source);

        if (mineralCode === ERR_NOT_IN_RANGE) {
            this.moveToObject(source);
        }
    }

    protected MineHere(flag : Flag) {
        if (flag.pos.roomName !== this.memory.homeRoom) {
            const source = flag.pos.findClosestByRange(FIND_SOURCES);

            if (source !== null) {
                this.MineSource(source, flag);
    
                return;
            }
        }

        const mineral = flag.pos.findClosestByRange(FIND_MINERALS);

        if (mineral !== null) {
            this.MineMineral(mineral);

            return;
        }

        const deposit = flag.pos.findClosestByRange(FIND_DEPOSITS);

        if (deposit !== null) {
            this.MineDeposit(deposit, flag);

            return;
        }

        flag.remove();
    }

    protected GoHome() {
        if (this.focusedFlag !== null) {
            this.util.ReleaseLocks(this);

            this.focusedFlag = null;
        }

        this.moveToObjectFar(new RoomPosition(25, 25, this.memory.homeRoom))
    }

    protected GoToFlag(flag : Flag) {
        if (this.creepRef.room.name !== flag.room?.name) {
            this.moveToObjectFar(flag.pos);

            return;
        }

        this.MineHere(flag);
    }   

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocksWithoutMe({ id: `flag:${i.name}` }, this);

        return locksPlaced.length;
    };

    public CreepGoMine() {
        if (this.memory.aliveFor >= 1200) {
            this.RecycleCreep();

            return;
        }

        const flags = this.util.GetFlagArray();

        const constructFlags = flags.filter(i => i.name.startsWith(this.memory.homeRoom + ' Mine')).sort((a, b) => this.GetLockCountForFlag(a) - this.GetLockCountForFlag(b));

        if (this.focusedFlag !== null) {
            const focusedFlag = constructFlags.find(i => i.name === this.focusedFlag?.name);

            if (typeof focusedFlag !== 'undefined') {
                this.GoToFlag(focusedFlag);

                return;
            }
        }

        if (constructFlags.length === 0) {
            this.RecycleCreep();

            return;
        }

        this.focusedFlag = constructFlags[0];

        this.util.PlaceLock({ id: `flag:${constructFlags[0].name}` }, this);

        this.GoToFlag(constructFlags[0]);
    }

    protected CreepGoDeposit() {
        if (this.creepRef.room.name !== this.memory.homeRoom) {
            this.GoHome();

            return;
        }

        const homeRoom = this.util.GetDokRoom(this.memory.homeRoom);

        if (typeof homeRoom === 'undefined')
            return;

        const homeStructures = homeRoom.GetRef().find(FIND_STRUCTURES);

        const homeStorage = homeStructures.filter(i => i.structureType === 'storage') as StructureStorage[];

        if (homeStorage.length > 0) {
            this.DumpAllIntoBin(homeStorage[0]);

            return;
        }

        const homeContainer = homeStructures.filter(i => i.structureType === 'container') as StructureContainer[];

        if (homeContainer.length > 0) {
            this.DumpAllIntoBin(homeContainer[0]);

            return;
        }

        this.creepRef.say('No storage!');

        return;
    }

    public DumpAllIntoBin(bin : StructureContainer | StructureLink | StructureStorage) {
        const storedObjects = Object.keys(this.creepRef.store) as ResourceConstant[];

        for(const storedKey of storedObjects) {
            if (this.creepRef.transfer(bin, storedKey) === ERR_NOT_IN_RANGE) {
                this.moveToObject(bin);

                break;
            }
        }

        if (this.creepRef.store.getUsedCapacity() === 0) {
            if (this.memory.aliveFor < 1200) {
                this.memory.task = dokCreepTask.Gather;
            } else {
                this.RecycleCreep();
            }
        }
    }

    public DoCreepWork(): void {
        /*if (this.creepRef.room.name !== this.memory.homeRoom && this.creepRef.room.name != this.lastRoomScanned) {
            this.util.RunScanOnRoom(this.creepRef.room, this);

            this.lastRoomScanned = this.creepRef.room.name;
        }*/

        switch(this.memory.task) {
            case dokCreepTask.Gather:
                this.CreepGoMine();

                break;
            case dokCreepTask.Depost:
                this.CreepGoDeposit();

                break;
        }
    }
}