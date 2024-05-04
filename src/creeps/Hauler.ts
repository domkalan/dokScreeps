import dokCreep, { dokCreepJob, dokCreepTask } from "./Base";
import { dokCreepHealer } from "./Healer";

export default class dokCreepPowerHauler extends dokCreep {
    private focusedFlag: Flag | null = null;
    private flagInvalidFor: number = 0;

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
                this.memory.task = dokCreepTask.Depost;
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

    protected HualCanHere(flag: Flag) {
        if (this.creepRef.pos.getRangeTo(flag) <= 6) {
            if (this.creepRef.store.getFreeCapacity() <= 0) {
                this.memory.task = dokCreepTask.Depost;
    
                return;
            }

            const cans = flag.pos.findInRange(FIND_STRUCTURES, 3).filter(i => i.structureType === 'container') as StructureContainer[];

            if (cans.length === 0) {
                flag.remove();

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

            return;
        }

        this.moveToObject(flag.pos);
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
            this.HualCanHere(flag);
        }
    }   

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocksWithoutMe({ id: `flag:${i.name}` }, this);

        return locksPlaced.length;
    };

    public CreepGoHual() {
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

        const homeStorage = homeStructures.filter(i => i.structureType === 'storage');

        if (homeStorage.length > 0) {
            if (this.creepRef.transfer(homeStorage[0], 'power') === ERR_NOT_IN_RANGE) {
                this.moveToObject(homeStorage[0]);
            }
    
            if (this.creepRef.store.getUsedCapacity('power') === 0) {
                this.memory.task = dokCreepTask.Gather;
            }

            return;
        }

        const homeContainer = homeStructures.filter(i => i.structureType === 'container');

        if (homeContainer.length > 0) {
            if (this.creepRef.transfer(homeContainer[0], 'power') === ERR_NOT_IN_RANGE) {
                this.moveToObject(homeContainer[0]);
            }
    
            if (this.creepRef.store.getUsedCapacity('power') === 0) {
                this.memory.task = dokCreepTask.Gather;
            }

            return;
        }

        this.creepRef.say('No storage!');
        
        this.creepRef.drop('power');

        if (this.creepRef.store.getUsedCapacity('power') === 0) {
            this.memory.task = dokCreepTask.Gather;
        }
    }

    public DoCreepWork(): void {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                this.CreepGoHual();

                break;
            case dokCreepTask.Depost:
                this.CreepGoDeposit();

                break;
        }
    }
}