import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepControllerSlave extends dokCreep {
    private DoControllerDeposit() {
        if (this.CheckIfDepositEmpty())
            return;

        const hostilesHere = this.util.FindResource<Creep>(this.creepRef.room, FIND_CREEPS).filter(i => i.owner.username !== this.creepRef.owner.username);

        // if have hostiles, fallback to being base creep
        if (hostilesHere.length > 0) {
            this.DoBasicDeposit();

            return;
        }

        if (typeof Game.flags[`${this.memory.homeRoom} ControllerBoost`] !== 'undefined') {

            const boostedStatus = this.creepRef.body.filter(i => i.type === 'work' && typeof i.boost !== 'undefined');

            if (boostedStatus.length === 0) {
                const lab = this.util.FindResource<StructureLab>(this.creepRef.room, FIND_STRUCTURES).find(i => i.structureType === 'lab' && i.store.getUsedCapacity('XGH2O') >= 30);

                if (typeof lab !== 'undefined') {
                    if (lab.store.getUsedCapacity('energy') >= 10) {
                        if (this.creepRef.pos.getRangeTo(lab) > 1) {
                            this.moveToObject(lab);
            
                            return;
                        }
    
                        lab.boostCreep(this.creepRef);
                    } else {
                        if (typeof Game.flags[`${lab.pos.roomName} Fill energy 2000`] === 'undefined') {
                            lab.pos.createFlag(`${lab.pos.roomName} Fill energy 2000`);
                        }
                    }
                } else {
                    Game.flags[`${this.memory.homeRoom} ControllerBoost`].remove();
                }
            }
        }

        const controllers = this.util.FindResource<StructureController>(this.creepRef.room, FIND_STRUCTURES).filter(i => i.structureType === 'controller');

        if (controllers.length > 0) {
            if (this.creepRef.pos.getRangeTo(controllers[0]) > 2) {
                this.moveToObject(controllers[0]);

                return;
            }

            if (controllers[0].sign?.text !== dokUtil.signText) {
                this.creepRef.signController(controllers[0], dokUtil.signText);

                if (this.creepRef.pos.getRangeTo(controllers[0]) > 0) {
                    this.moveToObject(controllers[0]);
    
                    return;
                }
            }

            this.creepRef.upgradeController(controllers[0]);

            return;
        }
    }

    public DoCreepWork(): void {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                this.DoBasicGather();

                break;
            case dokCreepTask.Deposit:
                this.DoControllerDeposit()

                break;
            default:
                break;
        }
    }
}