import dokCreep, { dokCreepJob, dokCreepTask } from "./Base";
import { dokCreepHealer } from "./Healer";

export default class dokCreepPowerMiner extends dokCreep {
    private focusedFlag: Flag | null = null;
    
    protected assignedHealers: Array<string> = [];
    protected lastHealerCheck: number = Infinity;

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

    protected MineHere(flag : Flag) {
        if (this.creepRef.pos.getRangeTo(flag) <= 6) {
            if (this.creepRef.store.getFreeCapacity('power') <= 0) {
                this.memory.task = dokCreepTask.Depost;
    
                return;
            }
    
            const powerBank = flag.pos.findClosestByRange(FIND_STRUCTURES);
    
            if (powerBank === null || powerBank.structureType !== 'powerBank') {
                const powerSourceDropped = flag.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
                const powerSourceRuin = flag.pos.findClosestByRange(FIND_RUINS);
    
                if (powerSourceDropped !== null) {
                    if (this.creepRef.pickup(powerSourceDropped) === ERR_NOT_IN_RANGE) {
                        this.moveToObject(powerSourceDropped);
    
                        return;
                    }
                }
    
                if (powerSourceRuin !== null) {
                    if (this.creepRef.withdraw(powerSourceRuin, 'power')  === ERR_NOT_IN_RANGE) {
                        this.moveToObject(powerSourceRuin);
    
                        return;
                    }
                }
    
                flag.remove();
    
                return;
            }
    
            if (this.creepRef.hits < this.creepRef.hitsMax * 0.90) {
                return;
            } 
    
            if (this.creepRef.attack(powerBank) === ERR_NOT_IN_RANGE) {
                this.moveToObject(powerBank);
            }

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

        this.MineHere(flag);
    }   

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocksWithoutMe({ id: `flag:${i.name}` }, this);

        return locksPlaced.length;
    };

    public CreepGoMine() {
        const flags = this.util.GetFlagArray();

        const constructFlags = flags.filter(i => i.name.startsWith(this.memory.homeRoom + ' PowerMine')).sort((a, b) => this.GetLockCountForFlag(a) - this.GetLockCountForFlag(b));

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

    protected ValidateHealers() {
        const livingCreeps = this.util.GetDokCreeps().map(i => {
            try {
                return i.GetId().toString()
            } catch(e) {
                return undefined;
            }
        });

        this.assignedHealers = this.assignedHealers.filter(i => livingCreeps.includes(i));
    }

    protected AttemptAssignHealer() {
        const healersFromHere = this.util.GetDokCreeps().filter(i => i.GetCurrentMemory().homeRoom === this.memory.homeRoom && i.GetJob() === dokCreepJob.Healer) as dokCreepHealer[];
        const freeHealers = healersFromHere.filter(i => i.IsHealerFree() && !i.GetRef().spawning);

        if (freeHealers.length === 0) {
            this.creepRef.say(`Healer?`);

            return;
        }

        for(const healer of freeHealers) {
            healer.AssignToCreep(this);
            this.assignedHealers.push(healer.GetId());
    
            this.creepRef.say(`🤝❤️`);

            if (this.assignedHealers.length >= 2) {
                break;
            }
        }
    }

    public DoCreepWork(): void {
        this.lastHealerCheck++;
        if (this.lastHealerCheck >= 10) {
            this.lastHealerCheck = 0;

            this.ValidateHealers();

            if (this.assignedHealers.length < 2) {
                this.AttemptAssignHealer();
            }  
        }
        

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