import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepRemoteConstruction extends dokCreep {
    private focusedFlag: string | null = null;

    private tryingToGather: number = 0;

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

    protected RepairInFlagRoom(flag : Flag) {
        if (this.creepRef.room.name !== flag.pos.roomName) {
            this.moveToObjectFar(flag.pos);

            return;
        }

        const repairables = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES).filter(i => i.hits < i.hitsMax);

        if (repairables.length == 0) {
            this.creepRef.say(`⏱️`);

            return;
        }

        if (this.creepRef.repair(repairables[0]) === ERR_NOT_IN_RANGE) {
            this.moveToObject(repairables[0]);
        }
    }

    protected GoToFlagRoom(flag : Flag) {
        if (this.creepRef.room.name !== flag.pos.roomName) {
            this.moveToObjectFar(flag.pos);

            return;
        }

        const constructionsHere = this.util.FindResource<ConstructionSite>(this.creepRef.room, FIND_MY_CONSTRUCTION_SITES).sort((a, b) => b.progress - a.progress);

        if (constructionsHere.length == 0) {
            if (flag.name.endsWith('Repair')) {
                this.RepairInFlagRoom(flag);
            } else {
                flag.remove();
            }

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
        if (this.tryingToGather !== 0) {
            this.tryingToGather = 0;
        }

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

    protected TryToConstructGather() {
        if (this.tryingToGather > 100) {
            if (this.creepRef.room.name === this.memory.homeRoom) {
                this.DoBasicGather();

                this.tryingToGather = 0;

                return;
            }

            this.GoHome();

            return;
        };

        if (this.CheckIfGatherFull())
            return;
        
        // single scan for all structures
        const structuresHere = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES);

        // check for stored energy
        const containerResource = (structuresHere as StructureContainer[]).filter(i => i.structureType === 'container' && this.IsTargetedGather(i.id) && i.store.energy >= 50 && this.util.GetLocksWithoutMe(i, this).length < 2);
        const storageResources = (structuresHere as StructureStorage[]).filter(i => i.structureType === 'storage' && this.IsTargetedGather(i.id) && i.store.energy > 0 && this.util.GetLocksWithoutMe(i, this).length < 5);
        const storedResources: Array<StructureContainer | StructureStorage> = containerResource.concat((storageResources as any)).sort((a, b) => a.store.energy - b.store.energy);

        if (storedResources.length > 0) {
            this.util.PlaceLock({ id: storedResources[0].id }, this);

            const withdrawCode = this.creepRef.withdraw(storedResources[0], 'energy');

            if (withdrawCode === ERR_NOT_IN_RANGE) {
                this.moveToObject(storedResources[0])
            } else if (withdrawCode === OK) {
                this.tryingToGather = 0;
            }

            return;
        }

        const energySources = this.util.FindResource<Source>(this.creepRef.room, FIND_SOURCES_ACTIVE).filter(i => this.IsTargetedGather(i.id) && this.ComputeLocksOnSource(i)).sort((a, b) => dokUtil.getDistance(a.pos, this.creepRef.pos) - dokUtil.getDistance(b.pos, this.creepRef.pos));

        if (energySources.length > 0) {
            this.util.PlaceLock(energySources[0], this);

            const harvestCode = this.creepRef.harvest(energySources[0]);

            if (harvestCode === ERR_NOT_IN_RANGE) {
                this.moveToObject(energySources[0])
            } else if (harvestCode === OK) {
                this.tryingToGather = 0;
            }

            return;
        }

        this.tryingToGather++;
        this.creepRef.say(`⚒️ ${this.tryingToGather}`);
    }

    public DoCreepWork(): void {
        switch(this.memory.task) {
            case dokCreepTask.Deposit:
                this.CreepGoBuild();

                break;
            case dokCreepTask.Gather:
                this.TryToConstructGather();

                break;
        }
        
    }
}