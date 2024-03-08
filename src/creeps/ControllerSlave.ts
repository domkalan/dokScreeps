import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepControllerSlave extends dokCreep {
    private DoControllerDeposit() {
        if (this.CheckIfDepositEmpty())
            return;

        const controllers = this.util.FindCached<StructureController>(this.creepRef.room, FIND_STRUCTURES).filter(i => i.structureType === 'controller');

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
            case dokCreepTask.Depost:
                this.DoControllerDeposit()

                break;
            default:
                break;
        }
    }
}