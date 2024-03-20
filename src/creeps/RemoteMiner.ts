import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepRemoteMiner extends dokCreep {
    private focusedOn: string | null = null;
    private focusedFlag: Flag | null = null;

    protected MineSource(source : Source) {
        if (this.creepRef.harvest(source) === ERR_NOT_IN_RANGE) {
            this.moveToObject(source);
        }

        if (this.creepRef.store.getFreeCapacity('energy') <= 0) {
            this.memory.task = dokCreepTask.Depost;
        }
    }

    protected MineHere() {
        const sources = this.creepRef.room.find(FIND_SOURCES);

        if (sources.length < 0) {
            this.creepRef.say(`No sources!`);

            return;
        }

        if (this.focusedOn !== null) {
            const focusedSource = sources.find(i => i.id === this.focusedOn);

            if (typeof focusedSource !== 'undefined') {
                this.MineSource(focusedSource);

                return;
            }
        }

        this.focusedOn = sources[0].id;

        this.MineSource(sources[0]);
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

        this.MineHere();
    }   

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocks({ id: `flag:${i.name}` }).filter(i => i.creep !== this.creepRef.id);

        return locksPlaced.length;
    };

    public CreepGoMine() {
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
            if (this.memory.homeRoom !== this.creepRef.room.name) {
                this.GoHome();

                return;
            }

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

        const homeStructures = homeRoom.GetRef().find(FIND_STRUCTURES).filter(i => i.structureType === 'storage');

        if (homeStructures.length === 0) {
            this.creepRef.say('NO STORAGE!')

            return;
        }

        if (this.creepRef.transfer(homeStructures[0], 'energy') === ERR_NOT_IN_RANGE) {
            this.moveToObject(homeStructures[0]);
        }

        if (this.creepRef.store.getUsedCapacity('energy') === 0) {
            this.memory.task = dokCreepTask.Gather;
        }
    }

    public DoCreepWork(): void {
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