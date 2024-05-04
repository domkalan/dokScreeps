import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepRemoteConstruction extends dokCreep {
    private focusedFlag: string | null = null;

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
            this.moveToObjectFar(homeStructures[0]);
        }
    }

    protected GoToFlagRoom(flag : Flag) {
        if (this.creepRef.room.name !== flag.pos.roomName) {
            this.moveToObjectFar(flag.pos);

            return;
        }

        const constructionsHere = this.util.FindResource<ConstructionSite>(this.creepRef.room, FIND_MY_CONSTRUCTION_SITES).sort((a, b) => b.progress - a.progress);

        if (constructionsHere.length == 0) {
            flag.remove();

            return;
        }

        if (this.creepRef.build(constructionsHere[0]) === ERR_NOT_IN_RANGE) {
            this.moveToObject(constructionsHere[0]);
        }

        this.CheckIfDepositEmpty();
    }

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocksWithoutMe({ id: `flag:${i.name}` }, this);

        return locksPlaced.length;
    };

    protected CreepGoBuild() {
        const flags = this.util.GetFlagArray();

        const buildFlags = flags.filter(i => i.name.startsWith(this.memory.homeRoom + ' Construct ')).sort((a, b) => this.GetLockCountForFlag(a) - this.GetLockCountForFlag(b));

        if (this.focusedFlag !== null) {
            const focusedFlag = buildFlags.find(i => i.name === this.focusedFlag);

            if (typeof focusedFlag !== 'undefined') {
                this.GoToFlagRoom(focusedFlag);

                return;
            }
        }

        if (buildFlags.length > 0) {
            this.focusedFlag = buildFlags[0].name;

            this.GoToFlagRoom(buildFlags[0]);

            this.util.PlaceLock({ id: `flag:${buildFlags[0].name}` }, this);

            return;
        }

        this.RecycleCreep();
    }

    protected GoHome() {
        if (this.focusedFlag !== null) {
            this.util.ReleaseLocks(this);

            this.focusedFlag = null;
        }

        this.moveToObjectFar(new RoomPosition(25, 25, this.memory.homeRoom))
    }

    public DoCreepWork(): void {
        switch(this.memory.task) {
            case dokCreepTask.Depost:
                this.CreepGoBuild();

                break;
            case dokCreepTask.Gather:
                //this.CreepRemoteConstructionGather();

                this.DoBasicGather();

                break;
        }
        
    }
}