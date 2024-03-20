import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepRemoteConstructionWorker extends dokCreep {
    private focusedOn: string | null = null;
    private focusedFlag: Flag | null = null;

    protected CheckIfDepositEmpty(): boolean {
        if (this.creepRef.store.energy <= 0) {
            this.focusedOn = null;
        }

        return super.CheckIfDepositEmpty();
    }

    public DoWallRepair() {
        const structuresBasic = this.util.FindCached<Structure>(this.creepRef.room, FIND_MY_STRUCTURES).filter(i => i.hits < i.hitsMax * 0.75);
        const structuresExtra = this.util.FindCached<Structure>(this.creepRef.room, FIND_STRUCTURES).filter(i => i.hits < i.hitsMax * 0.75 && ['container', 'link', 'constructedWall'].includes(i.structureType))

        const structures: Array<Structure> = structuresBasic.concat(structuresExtra).sort((a, b) => a.hits/a.hitsMax - b.hits/b.hitsMax);
        
        if (this.focusedOn !== null) {
            const focusedConstrct = structures.find(i => i.id === this.focusedOn);

            if (typeof focusedConstrct !== 'undefined') {
                if (this.creepRef.repair(focusedConstrct) === ERR_NOT_IN_RANGE) {
                    this.creepRef.moveTo(focusedConstrct);
                    
                }

                this.CheckIfDepositEmpty()

                return;
            }
        }

        if (structures.length === 0) {
            super.DoBasicDeposit();

            return;
        }

        if (this.creepRef.repair(structures[0]) === ERR_NOT_IN_RANGE) {
            this.creepRef.moveTo(structures[0]);
        }

        this.creepRef.say(`🏰`, false);

        this.focusedOn = structures[0].id;

        this.CheckIfDepositEmpty();
    }

    public DoConstructionDeposit() {
        const constructions = this.util.FindCached<ConstructionSite>(this.creepRef.room, FIND_MY_CONSTRUCTION_SITES);

        if (this.focusedOn !== null) {
            const focusedConstrct = constructions.find(i => i.id === this.focusedOn);

            if (typeof focusedConstrct !== 'undefined') {
                if (this.creepRef.build(focusedConstrct) === ERR_NOT_IN_RANGE) {
                    this.creepRef.moveTo(focusedConstrct);
                    
                }

                this.CheckIfDepositEmpty();

                return;
            }
        }

        if (constructions.length === 0) {
            this.DoWallRepair();

            return;
        }

        if (this.creepRef.build(constructions[0]) === ERR_NOT_IN_RANGE) {
            this.creepRef.moveTo(constructions[0]);
        }

        this.focusedOn = constructions[0].id;

        this.creepRef.say(`🔨`, false);

        this.CheckIfDepositEmpty();
    }

    public RepairAboutToFail() {
        const structuresBasic = this.util.FindCached<Structure>(this.creepRef.room, FIND_MY_STRUCTURES).filter(i => i.hits < i.hitsMax * 0.10);
        const structuresExtra = this.util.FindCached<Structure>(this.creepRef.room, FIND_STRUCTURES).filter(i => {
            if (i.structureType === 'constructedWall') {
                return i.hits < i.hitsMax * 0.0004;
            }

            return i.hits < i.hitsMax * 0.01 && ['container', 'link'].includes(i.structureType)
        });

        const structures: Array<Structure> = structuresBasic.concat(structuresExtra).sort((a, b) => a.hits/a.hitsMax - b.hits/b.hitsMax);

        if (this.focusedOn !== null) {
            const focusedConstrct = structures.find(i => i.id === this.focusedOn);

            if (typeof focusedConstrct !== 'undefined') {
                if (this.creepRef.repair(focusedConstrct) === ERR_NOT_IN_RANGE) {
                    this.creepRef.moveTo(focusedConstrct);
                    
                }

                this.CheckIfDepositEmpty()

                return;
            }
        }

        if (structures.length === 0) {
            this.DoConstructionDeposit();

            return;
        }

        if (this.creepRef.repair(structures[0]) === ERR_NOT_IN_RANGE) {
            this.creepRef.moveTo(structures[0]);
        }

        this.focusedOn = structures[0].id;

        this.creepRef.say(`❤️‍🩹`, false);

        this.CheckIfDepositEmpty();
    }

    protected GoHome() {
        if (this.creepRef.room.name !== this.memory.homeRoom) {
            this.moveToObject(new RoomPosition(25, 25, this.memory.homeRoom))

            return;
        }

        const spawn = this.creepRef.room.find(FIND_MY_SPAWNS);

        if (spawn.length === 0) {
            this.creepRef.suicide();

            return;
        }

        if (spawn[0].recycleCreep(this.creepRef) === ERR_NOT_IN_RANGE) {
            this.moveToObject(spawn[0])
        }
    }

    protected GoToFlag(flag : Flag) {
        if ( typeof flag.room === 'undefined') {
            this.creepRef.say(`No Flag Ref!`);

            return;
        }

        if (this.creepRef.room.name !== flag.room?.name) {
            this.moveToObject(new RoomPosition(25, 25, flag.room.name));

            return;
        }

        this.RepairAboutToFail();
    }   

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocks({ id: `flag:${i.name}` }).filter(i => i.creep !== this.creepRef.id);

        return locksPlaced.length;
    };

    public CreepGoToRoom() {
        const flags = this.util.GetFlagArray();

        const constructFlags = flags.filter(i => i.name.startsWith(this.memory.homeRoom + ' Construct')).sort((a, b) => this.GetLockCountForFlag(b) - this.GetLockCountForFlag(a));

        if (this.focusedFlag !== null) {
            const focusedFlag = constructFlags.find(i => i.name === this.focusedFlag?.name);

            if (typeof focusedFlag !== 'undefined') {
                this.GoToFlag(focusedFlag);

                return;
            }
        }

        if (constructFlags.length === 0) {
            this.creepRef.say('No flags!');

            this.GoHome();

            return;
        }

        this.focusedFlag = constructFlags[0];

        this.GoToFlag(constructFlags[0]);
    }
    
    public DoBasicGather(): void {
        if (this.creepRef.room.name !== this.memory.homeRoom) {
            this.GoHome();

            return;
        }

        super.DoBasicGather();
    }

    public DoCreepWork(): void {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                this.DoBasicGather();

                break;
            case dokCreepTask.Depost:
                this.CreepGoToRoom(); 

                break;
        }
    }
}