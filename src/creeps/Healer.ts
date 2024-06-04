import dokUtil from "../dokUtil";
import dokCreep from "./Base";

export class dokCreepHealer extends dokCreep {
    protected healSlaveMode: string | null = null;
    protected healHangAroundFor: number = 0;

    constructor(util : dokUtil, creep : Creep) {
        super(util, creep);

        // disable path caching
        this.moveSpammyDisable = true;
    }
      

    protected DoCreepHealSlaveMode() {
        if (this.healSlaveMode === null)
            return;

        const targetCreep = this.util.GetDokCreep(this.healSlaveMode);

        if (typeof targetCreep === 'undefined') {
            this.creepRef.say('Dead?')

            this.healSlaveMode = null;

            return;
        }

        const targetCreepRef = targetCreep.GetRef();

        if (this.creepRef.pos.getRangeTo(targetCreepRef) > 2) {
            this.moveToObject(targetCreepRef);

            return;
        }

        if (targetCreepRef.hits < targetCreepRef.hitsMax) {
            if (this.creepRef.heal(targetCreepRef) === ERR_NOT_IN_RANGE) {
                this.creepRef.rangedHeal(targetCreepRef);

                this.moveToObject(targetCreepRef);
            };
        }
    }

    protected DoCreepHealGeneral() {
        if (this.creepRef.room.name !== this.memory.homeRoom) {
            this.moveToObjectFar(new RoomPosition(25, 25, this.memory.homeRoom))

            return;
        }

        const creepsHere = this.util.FindResource<Creep>(this.creepRef.room, FIND_MY_CREEPS).filter(i => i.hits < i.hitsMax);

        if (creepsHere.length === 0) {

            // creep the creep in the area before leaving
            this.healHangAroundFor++;
            if (this.healHangAroundFor <= 30) {
                return;
            }

            const spawners = this.util.FindResource<StructureSpawn>(this.creepRef.room, FIND_MY_SPAWNS);

            if (spawners.length === 0) {
                this.creepRef.suicide();

                return;
            }

            if (this.creepRef.pos.getRangeTo(spawners[0]) > 5) {
                this.moveToObject(spawners[0]);
            }

            return;
        }

        this.healHangAroundFor = 0;

        const healCreep = creepsHere[0];

        if (this.creepRef.pos.getRangeTo(healCreep) >= 3) {
            this.moveToObject(healCreep);
        }

        if (this.creepRef.heal(healCreep) === ERR_NOT_IN_RANGE) {
            this.creepRef.rangedHeal(healCreep);
        };
    }

    public AssignToCreep(creep : dokCreep) {
        this.healSlaveMode = creep.GetId();

        this.creepRef.say(`🤝❤️`);
    }

    public IsHealerFree() {
        return this.healSlaveMode === null;
    }

    public DoCreepWork(): void {
        if (this.healSlaveMode !== null) {
            this.DoCreepHealSlaveMode();

            return;
        }

        this.DoCreepHealGeneral();
    }
}