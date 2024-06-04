import dokUtil from "../dokUtil";
import dokCreep from "./Base";

export default class dokCreepDefender extends dokCreep {
    private focusedOn?: string;
    private waitingForGroup: boolean = true;

    constructor(util: dokUtil, creep: Creep) {
        super(util, creep);

        this.moveSpammyDisable = true;
    }

    private AttackTarget(target : Creep | PowerCreep) {
        const attackCode = this.creepRef.attack(target)

        if (attackCode === (ERR_NOT_IN_RANGE || ERR_NO_BODYPART)) {
            if (this.creepRef.rangedAttack(target) === ERR_NOT_IN_RANGE) {
                this.creepRef.moveTo(target);
            }
        }
    }

    public DoCreepWork(): void {
        if (this.waitingForGroup && this.creepRef.hits === this.creepRef.hitsMax) {
            if (this.creepRef.pos.findInRange(FIND_MY_CREEPS, 10).filter(i => i.name.includes('Defender')).length >= 2) {
                this.waitingForGroup = false;
            }

            return;
        }

        const dokRoom = this.util.GetDokRoom(this.memory.homeRoom);

        if (typeof dokRoom === 'undefined')
            return;

        const hostiles = this.util.FindResource<Creep>(dokRoom.GetRef(), FIND_CREEPS).filter(i => i.owner.username !== this.creepRef.owner.username);
        const hostilePower = this.util.FindResource<PowerCreep>(dokRoom.GetRef(), FIND_HOSTILE_POWER_CREEPS).filter(i => i.owner.username !== this.creepRef.owner.username);

        const hostilesHere : Array<Creep | PowerCreep> = hostilePower.concat(hostiles as any);

        if (hostilesHere.length === 0) {
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

        const focusedTarget = hostilesHere.find(i => i.id === this.focusedOn);

        if (typeof focusedTarget !== 'undefined') {
            this.AttackTarget(focusedTarget);

            return;
        }

        this.focusedOn = hostilesHere[0].id;

        this.AttackTarget(hostilesHere[0]);
    }
}