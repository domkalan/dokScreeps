import dokUtil from "../dokUtil";
import dokCreep, { dokCreepJob, dokCreepTask } from "./Base";
import { dokCreepHealer } from "./Healer";

export default class dokCreepPowerHauler extends dokCreep {
    private focusedFlag: Flag | null = null;
    private flagInvalidFor: number = 0;

    private scannedOnFloor: number = 0;

    private scannedForLink: number = 0;

    protected RecycleCreep() {
        const homeRoom = this.util.GetDokRoom(this.memory.homeRoom);

        if (typeof homeRoom === 'undefined')
            return;

        const homeStructures = homeRoom.GetRef().find(FIND_STRUCTURES).filter(i => i.structureType === 'spawn') as StructureSpawn[];

        if (homeStructures.length === 0) {
            this.creepRef.say('NO SPAWN!')

            return;
        }

        if (homeStructures[0].recycleCreep(this.creepRef) === ERR_NOT_IN_RANGE) {
            this.moveToObject(homeStructures[0]);
        }

        return;
    }

    protected HaulPowerHere(flag : Flag) {
        if (this.creepRef.pos.getRangeTo(flag) <= 6) {
            if (this.creepRef.store.getFreeCapacity('power') <= 0) {
                this.memory.task = dokCreepTask.Deposit;
                this.flagInvalidFor = 0;
    
                return;
            }

            const powerBank = flag.pos.findClosestByRange(FIND_STRUCTURES);
    
            if (powerBank !== null && powerBank.structureType === 'powerBank') {
                if (this.creepRef.pos.getRangeTo(powerBank) > 4) {
                    this.moveToObject(powerBank);
                }
                
                this.creepRef.say(`⏱️`);

                return;
            }

            if (powerBank !== null && powerBank.structureType === 'storage') {
                if (this.creepRef.withdraw(powerBank, 'power') === ERR_NOT_IN_RANGE) {
                    this.moveToObject(powerBank);
                }

                return;
            }
    
            const powerSourceDropped = flag.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
            const powerSourceRuin = flag.pos.findClosestByRange(FIND_RUINS);

            if (powerSourceRuin !== null) {
                this.creepRef.say(`⏱️`);

                return;
            }

            if (powerSourceDropped !== null) {
                if (this.creepRef.pickup(powerSourceDropped) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(powerSourceDropped);

                    return;
                }
            }

            this.flagInvalidFor++;
            if (this.flagInvalidFor >= 300) {
                flag.remove();

                this.flagInvalidFor = 0;
            }

            return;
        }

        this.moveToObject(flag.pos);
    }

    protected HaulCanHere(flag: Flag) {
        if (this.creepRef.store.getFreeCapacity() <= 0) {
            this.memory.task = dokCreepTask.Deposit;

            return;
        }

        this.scannedOnFloor++;
        if (this.scannedOnFloor >= 30) {
            const droppedResource = this.util.FindResource<Resource>(this.creepRef.room, FIND_DROPPED_RESOURCES);

            if (droppedResource.length === 0) {
                this.scannedOnFloor = 0;

                return;
            }

            this.creepRef.pickup(droppedResource[0]);

            if (this.creepRef.store.getFreeCapacity() <= 10) {
                this.memory.task = dokCreepTask.Deposit;

                return;
            }
        }

        const cans = this.util.FindResource<StructureContainer>(this.creepRef.room, FIND_STRUCTURES).filter(i => i.structureType === 'container').sort((a, b) => a.store.getUsedCapacity() - b.store.getUsedCapacity());

        if (cans.length === 0) {
            // putting this on pause, we are loosing too many flags
            //flag.remove();

            this.creepRef.say('🤷');

            if (dokUtil.getDistance(flag.pos, this.creepRef.pos) > 6) {
                this.moveToObject(flag.pos);
            }

            return;
        }

        const can = cans[0];

        if (can.store.getUsedCapacity() >= this.creepRef.store.getFreeCapacity()) {
            const contents = (Object.keys(can.store) as ResourceConstant[]);
            let pulledSomething = true;

            for(const content of contents) {
                const withdrawCode = this.creepRef.withdraw(can, content);

                if (withdrawCode === ERR_NOT_IN_RANGE) {
                    this.moveToObject(can);

                    break;
                } else if (withdrawCode === OK) {
                    if (this.creepRef.store.getFreeCapacity() <= 0) {
                        break;
                    }
                }
            }

            if (pulledSomething)
                return;
        }

        this.creepRef.say(`⏱️`);
    }

    protected GoHome() {
        if (this.focusedFlag !== null) {
            this.util.ReleaseLocks(this);

            this.focusedFlag = null;
        }

        this.moveToObjectFar(new RoomPosition(25, 25, this.memory.homeRoom))
    }

    protected GoToFlag(flag : Flag) {
        if (this.creepRef.room.name !== flag.pos.roomName) {
            this.moveToObjectFar(flag.pos);

            return;
        }

        if (flag.name.includes(' PowerHauler ')) {
            this.HaulPowerHere(flag);
        }

        if (flag.name.includes(' CanHauler ')) {
            this.HaulCanHere(flag);
        }
    }   

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocksWithoutMe({ id: `flag:${i.name}` }, this);

        return locksPlaced.length;
    };

    public CreepGoHaul() {
        const flags = this.util.GetFlagArray();

        const powerHaulFlags = flags.filter(i => i.name.startsWith(this.memory.homeRoom + ' PowerHauler'));
        const canHaulFlags = flags.filter(i => i.name.startsWith(this.memory.homeRoom + ' CanHauler'));

        const haulerFlags: Flag[] = powerHaulFlags.concat(canHaulFlags).filter(i => {
            const locksPlaced = this.util.GetLocksWithoutMe({ id: `flag:${i.name}` }, this);
            const flagNameSplit = i.name.split(' ');

            return locksPlaced.length < Number(flagNameSplit[3] || Infinity)
        }).sort((a, b) => this.util.GetLocks({ id: `flag:${a.name}` }).length - this.util.GetLocks({ id: `flag:${b.name}` }).length);

        if (this.focusedFlag !== null) {
            const focusedFlag = haulerFlags.find(i => i.name === this.focusedFlag?.name);

            if (typeof focusedFlag !== 'undefined') {
                this.GoToFlag(focusedFlag);

                return;
            }
        }

        if (haulerFlags.length === 0) {
            this.RecycleCreep();

            return;
        }

        this.focusedFlag = haulerFlags[0];

        this.util.PlaceLock({ id: `flag:${haulerFlags[0].name}` }, this);

        this.GoToFlag(haulerFlags[0]);
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

        const homeStorage = homeStructures.filter(i => i.structureType === 'storage' || i.structureType === 'link').sort((a, b) => this.creepRef.pos.getRangeTo(a.pos) - this.creepRef.pos.getRangeTo(b.pos));

        if (homeStorage.length > 0) {
            const contents = (Object.keys(this.creepRef.store) as ResourceConstant[]);

            for(const content of contents) {
                const withdrawCode = this.creepRef.transfer(homeStorage[0], content);

                if (withdrawCode === ERR_NOT_IN_RANGE) {
                    this.moveToObject(homeStorage[0]);

                    break;
                } else if (withdrawCode === OK) {
                    if (this.creepRef.store.getUsedCapacity() <= 0) {
                        break;
                    }
                }
            }
        }

        if (this.creepRef.store.getUsedCapacity() === 0) {
            this.memory.task = dokCreepTask.Gather;
        }
    }

    public DoCreepWork(): void {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                this.CreepGoHaul();

                break;
            case dokCreepTask.Deposit:
                this.CreepGoDeposit();

                break;
        }
    }
}