import dokCreep from "./Base";

export default class dokCreepLinkStorageSlave extends dokCreep {
    public DoCreepWork(): void {
        const roomInstance = this.util.GetDokRoom(this.memory.homeRoom);

        const structures = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES);

        const storage = structures.find(i => i.structureType === 'storage') as StructureStorage;

        if (typeof storage === 'undefined') {
            console.log(`[dokUtil][dokLinkStorageSlave] could not tick, no storage exists!`)

            return;
        }

        let grabbedEnergy = false;

        const terminal = structures.find(i => i.structureType === 'terminal') as StructureTerminal;

        const mainLink = structures.find(i => i.structureType === 'link' && i.pos.getRangeTo(storage) <= 5) as StructureLink;

        if (typeof mainLink === 'undefined') {
            console.log(`[dokUtil][dokLinkStorageSlave] could not tick, no main link exists!`);

            return;
        }

        if (typeof terminal !== 'undefined' && typeof roomInstance !== 'undefined' && roomInstance.GetTerminalMode() === 'energyShare') {
            if (this.creepRef.store.getFreeCapacity() > 0 && mainLink.store.energy > 0) {
                grabbedEnergy = true;
    
                if (this.creepRef.withdraw(mainLink, 'energy') === ERR_NOT_IN_RANGE) {
                    this.moveToObject(mainLink)
    
                    return;
                }
            } else if (this.creepRef.store.getFreeCapacity() > 0 && storage.store.energy > 600000) {
                grabbedEnergy = true;
    
                if (this.creepRef.withdraw(storage, 'energy') === ERR_NOT_IN_RANGE) {
                    this.moveToObject(storage)
    
                    return;
                }
            }

            if (grabbedEnergy || this.creepRef.store.energy > 0) {
                if (this.creepRef.transfer(terminal, 'energy') === ERR_NOT_IN_RANGE) {
                    this.moveToObject(terminal)
    
                    return;
                }
            }

            return;
        }

        if (this.creepRef.store.getFreeCapacity() > 0 && mainLink.store.energy > 0) {
            grabbedEnergy = true;

            if (this.creepRef.withdraw(mainLink, 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(mainLink)

                return;
            }
        } else if (typeof terminal !== 'undefined' && typeof roomInstance !== 'undefined' && roomInstance.GetTerminalMode() === 'energyReceive' && roomInstance.GetEnergySent() === true) {
            if (terminal.store.energy > 0) {
                if (this.creepRef.store.getFreeCapacity() > 0) {
                    grabbedEnergy = true;
        
                    if (this.creepRef.withdraw(terminal, 'energy') === ERR_NOT_IN_RANGE) {
                        this.moveToObject(terminal)
        
                        return;
                    }
                }
            } else if (terminal.store.energy === 0) {
                roomInstance.ResetTerminal();
                roomInstance.ResetEnergySent();
            }
        }

        if (grabbedEnergy || this.creepRef.store.energy > 0) {
            if (this.creepRef.transfer(storage, 'energy') === ERR_NOT_IN_RANGE) {
                this.moveToObject(storage)

                return;
            }
        }
    }
}