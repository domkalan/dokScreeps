import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepDefender extends dokCreep {
    private focusedOn: string | null = null;
    private hostileFree: number = 0;

    private AttackTarget(target : Creep | PowerCreep) {
        if (this.creepRef.pos.getRangeTo(target) >= 10) {
            this.creepRef.rangedAttack(target);
        } else {
            if (this.creepRef.attack(target) === ERR_NOT_IN_RANGE) {
                this.moveToObject(target);
            }
        }
    }

    public DoCreepWork(): void {
        const hostiles = this.util.FindCached<Creep>(this.creepRef.room, FIND_HOSTILE_CREEPS);
        const hostilePower = this.util.FindCached<PowerCreep>(this.creepRef.room, FIND_HOSTILE_POWER_CREEPS);

        const hostilesHere : Array<Creep | PowerCreep> = hostilePower.concat(hostiles as any).sort((a, b) => b.hits - a.hits);

        if (hostilesHere.length === 0) {
            if (this.hostileFree >= 250) {
                const roomSpanwer = this.util.FindCached<StructureSpawn>(this.creepRef.room, FIND_MY_SPAWNS)[0];

                if (!roomSpanwer) {
                    this.creepRef.suicide();

                    return;
                }

                if (this.creepRef.pos.getRangeTo(roomSpanwer) > 1) {
                    this.moveToObject(roomSpanwer);
                } else {
                    roomSpanwer.recycleCreep(this.creepRef);
                }
            }

            this.hostileFree++;
        }

        this.creepRef.say(`⚔️`, true);

        if (this.focusedOn !== null) {
            const hostileTarget = hostilesHere.find(i => i.id === this.focusedOn);

            if (typeof hostileTarget !== 'undefined') {
                this.AttackTarget(hostileTarget);

                return;
            }
        }

        this.AttackTarget(hostilesHere[0]);

        this.focusedOn = hostilesHere[0].id;
    }
}