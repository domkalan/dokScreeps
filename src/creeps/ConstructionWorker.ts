import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepConstructionWorker extends dokCreep {
    private focusedOn: string | null = null;

    protected CheckIfDepositEmpty(): boolean {
        if (this.creepRef.store.energy <= 0) {
            this.focusedOn = null;
        }

        return super.CheckIfDepositEmpty();
    }

    public DoWallRepair() {
        const structuresBasic = this.util.FindResource<Structure>(this.creepRef.room, FIND_MY_STRUCTURES).filter(i => i.hits < i.hitsMax * 0.75);
        const structuresExtra = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES).filter(i => i.hits < i.hitsMax * 0.75 && ['container', 'link', 'constructedWall'].includes(i.structureType))

        const structures: Array<Structure> = structuresBasic.concat(structuresExtra).sort((a, b) => a.hits/a.hitsMax - b.hits/b.hitsMax);
        
        if (this.focusedOn !== null) {
            const focusedConstrct = structures.find(i => i.id === this.focusedOn);

            if (typeof focusedConstrct !== 'undefined') {
                if (this.creepRef.repair(focusedConstrct) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(focusedConstrct);
                    
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
            this.moveToObject(structures[0]);
        }

        this.creepRef.say(`🏰`, false);

        this.focusedOn = structures[0].id;

        this.CheckIfDepositEmpty();
    }

    public DoConstructionDeposit() {
        const constructions = this.util.FindResource<ConstructionSite>(this.creepRef.room, FIND_MY_CONSTRUCTION_SITES);

        if (this.focusedOn !== null) {
            const focusedConstrct = constructions.find(i => i.id === this.focusedOn);

            if (typeof focusedConstrct !== 'undefined') {
                if (this.creepRef.build(focusedConstrct) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(focusedConstrct);
                    
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
            this.moveToObject(constructions[0]);
        }

        this.focusedOn = constructions[0].id;

        this.creepRef.say(`🔨`, false);

        this.CheckIfDepositEmpty();
    }

    public RepairAboutToFail() {
        const roomRcl = this.creepRef.room.controller?.level || 0;

        const structuresBasic = this.util.FindResource<Structure>(this.creepRef.room, FIND_MY_STRUCTURES);
        const structuresExtra = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES);

        const structures: Array<Structure> = structuresBasic.concat(structuresExtra).filter(i => {
            if (i.structureType === 'constructedWall') {
                if (roomRcl >= 5) {
                    return i.hits < 10000;
                }

                return i.hits < 1000;
            }

            if (i.structureType === 'rampart') {
                if (roomRcl >= 5) {
                    return i.hits < 10000;
                }

                return i.hits < 1000;
            }

            if (['container', 'link'].includes(i.structureType)) {
                return i.hits < i.hitsMax * 0.01;
            }

            return i.hits < i.hitsMax * 0.10;
        }).sort((a, b) => a.hits/a.hitsMax - b.hits/b.hitsMax);

        if (this.focusedOn !== null) {
            const focusedConstrct = structures.find(i => i.id === this.focusedOn);

            if (typeof focusedConstrct !== 'undefined') {
                if (this.creepRef.repair(focusedConstrct) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(focusedConstrct);
                    
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
            this.moveToObject(structures[0]);
        }

        this.focusedOn = structures[0].id;

        this.creepRef.say(`❤️‍🩹`, false);

        this.CheckIfDepositEmpty();
    }

    public DoCreepWork(): void {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                super.DoBasicGather();

                break;
            case dokCreepTask.Deposit:
                this.RepairAboutToFail();  

                break;
        }
    }
}