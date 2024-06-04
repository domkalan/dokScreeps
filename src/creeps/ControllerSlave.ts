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