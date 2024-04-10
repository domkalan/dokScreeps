import dokCreep from "./Base";

export default class dokCreepDefender extends dokCreep {
    private hostileFree: number = 0;

    protected waitingForGroup : boolean = true;

    private AttackTarget(target : Creep | PowerCreep) {
        const attackCode = this.creepRef.attack(target)

        if (attackCode === ERR_NOT_IN_RANGE || attackCode === ERR_NO_BODYPART) {
            if (this.creepRef.rangedAttack(target)) {
                this.creepRef.moveTo(target);
            }
        }
    }

    public DoCreepWork(): void {
        if (this.waitingForGroup) {
            if (this.creepRef.pos.findInRange(FIND_MY_CREEPS, 10).filter(i => i.name.includes('Defender')).length >= 4) {
                this.waitingForGroup = false;
            }

            return;
        }

        const hostiles = this.util.FindResource<Creep>(this.creepRef.room, FIND_HOSTILE_CREEPS);
        const hostilePower = this.util.FindResource<PowerCreep>(this.creepRef.room, FIND_HOSTILE_POWER_CREEPS);

        const hostilesHere : Array<Creep | PowerCreep> = hostilePower.concat(hostiles as any).filter(i => i.owner.username !== this.creepRef.owner.username).sort((a, b) => b.hits - a.hits);

        if (hostilesHere.length === 0) {
            if (this.hostileFree >= 250) {
                const roomSpanwer = this.util.FindResource<StructureSpawn>(this.creepRef.room, FIND_MY_SPAWNS)[0];

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

            return;
        }
        
        /*const healerTargets = hostiles.filter(i => {
            return i.body.filter(ii => ii.type === 'heal').length > 0;
        });*/

        this.creepRef.say(`⚔️`, true);

        /*if (healerTargets.length > 0) {
            this.AttackTarget(healerTargets[0]);

            return;
        }*/

        this.AttackTarget(hostilesHere[0]);
    }
}