import dokCreep from "./Base";

export default class dokCreepLinkStorageSlave extends dokCreep {
    public DoCreepWork(): void {
        const structures = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES);
        
        const tombstones = this.util.FindResource<Tombstone>(this.creepRef.room, FIND_TOMBSTONES).filter(i => i.store.getUsedCapacity() > 0);
        const ruins = this.util.FindResource<Ruin>(this.creepRef.room, FIND_RUINS).filter((i) => i.store.getUsedCapacity() > 0);

        const storage = structures.find(i => i.structureType === 'storage') as StructureStorage;

        if (typeof storage === 'undefined') {
            console.log(`[dokUtil][dokLinkStorageSlave] could not tick, no storage exists!`)

            return;
        }

        const mainLinks = storage.pos.findInRange(FIND_STRUCTURES, 5).filter(i => i.structureType === 'link') as StructureLink[];

        if (mainLinks.length === 0) {
            console.log(`[dokUtil][dokLinkStorageSlave] could not tick, no main link exists!`);

            return;
        }

        try {
            if (tombstones.length > 0 && this.creepRef.store.getUsedCapacity() <= 0) {
                const contents = (Object.keys(tombstones[0].store) as ResourceConstant[]);
                let pulledSomething = false;
    
                for(const content of contents) {
                    const withdrawCode = this.creepRef.withdraw(tombstones[0], content);

                    pulledSomething = true;
    
                    if (withdrawCode === ERR_NOT_IN_RANGE) {
                        this.moveToObject(tombstones[0]);
    
                        break;
                    } else if (withdrawCode === OK) {
                        if (this.creepRef.store.getFreeCapacity() <= 0) {
                            break;
                        }
                    }
                }

                if (pulledSomething)
                    return;
            }
        } catch(e) {
            console.log(`[dokUtil][LSS] failed to parse tombstones`, e)
        }

        try {
            if (ruins.length > 0 && this.creepRef.store.getUsedCapacity() <= 0) {
                const contents = (Object.keys(ruins[0].store) as ResourceConstant[]);
                let pulledSomething = true;
    
                for(const content of contents) {
                    const withdrawCode = this.creepRef.withdraw(ruins[0], content);
    
                    if (withdrawCode === ERR_NOT_IN_RANGE) {
                        this.moveToObject(ruins[0]);
    
                        break;
                    } else if (withdrawCode === OK) {
                        if (this.creepRef.store.getFreeCapacity() <= 0) {
                            break;
                        }
                    }
                }

                if (pulledSomething)
                    return;
            }
        } catch(e) {
            console.log(`[dokUtil][LSS] failed to parse ruins`, e)
        }
       

        if (this.creepRef.store.getUsedCapacity() <= 0 && mainLinks[0].store.energy > 0) {
            if (this.creepRef.withdraw(mainLinks[0], 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(mainLinks[0])

                return;
            }
        }

        if (this.creepRef.store.getUsedCapacity() > 0) {
            const contents = (Object.keys(this.creepRef.store) as ResourceConstant[]);

            for(const content of contents) {
                const withdrawCode = this.creepRef.transfer(storage, content);

                if (withdrawCode === ERR_NOT_IN_RANGE) {
                    this.moveToObject(storage);

                    break;
                } else if (withdrawCode === OK) {
                    if (this.creepRef.store.getUsedCapacity() <= 0) {
                        break;
                    }
                }
            }
        }
    }
}