import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepLinkStorageSlave extends dokCreep {
    public DoLinkGather() {
        const structures = this.util.FindCached<Structure>(this.creepRef.room, FIND_STRUCTURES);

        const storage = structures.find(i => i.structureType === 'storage');

        if (typeof storage === 'undefined') {
            console.log(`[dokUtil][dokLinkStorageSlave] could not tick, no storage exists!`)

            return;
        }

        const mainLink = structures.find(i => i.structureType === 'link' && i.pos.getRangeTo(storage) <= 5) as StructureLink;

        if (typeof mainLink === 'undefined') {
            console.log(`[dokUtil][dokLinkStorageSlave] could not tick, no main link exists!`)

            return;
        }

        if (this.creepRef.withdraw(mainLink, 'energy') === ERR_NOT_IN_RANGE) {
            this.moveToObject(mainLink)
        }

        this.CheckIfGatherFull();
    }

    public DoLinkDeposit() {
        const structures = this.util.FindCached<Structure>(this.creepRef.room, FIND_STRUCTURES);

        const storage = structures.find(i => i.structureType === 'storage');

        if (typeof storage === 'undefined') {
            console.log(`[dokUtil][dokLinkStorageSlave] could not tick, no storage exists!`)

            return;
        }

        if (this.creepRef.transfer(storage, 'energy') === ERR_NOT_IN_RANGE) {
            this.moveToObject(storage)
        }

        this.CheckIfDepositEmpty();
    }

    public DoCreepWork(): void {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                this.DoLinkGather();

                break;
            case dokCreepTask.Depost:
                this.DoLinkDeposit();

                break;
            default:
                break;
        }
    }
}