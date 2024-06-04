import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base"

export class dokCreepFactoryWorker extends dokCreep {
    protected RunDrainOperation(flag : Flag) {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                const terminal = this.creepRef.room.terminal;

                if (!terminal)
                    return;

                const contents = (Object.keys(terminal.store) as ResourceConstant[]);

                if (contents.length === 0) {
                    flag.remove();

                    return;
                }

                if (this.creepRef.store.getFreeCapacity() <= 0) {
                    this.memory.task = dokCreepTask.Deposit;

                    return;
                }
    
                for(const content of contents) {
                    const withdrawCode = this.creepRef.withdraw(terminal, content);
    
                    if (withdrawCode === ERR_NOT_IN_RANGE) {
                        this.moveToObject(terminal);
    
                        break;
                    } else if (withdrawCode === OK) {
                        if (this.creepRef.store.getFreeCapacity() <= 0) {
                            this.memory.task = dokCreepTask.Deposit;

                            break;
                        }
                    }
                }

                break;
            case dokCreepTask.Deposit:
                const storage = this.util.FindResource<StructureStorage>(this.creepRef.room, FIND_STRUCTURES).find(i => i.structureType === 'storage');

                if (!storage)
                    return;

                const creepContents = (Object.keys(this.creepRef.store) as ResourceConstant[]);

                if (creepContents.length === 0) {
                    this.memory.task = dokCreepTask.Gather;

                    return;
                }
    
                for(const content of creepContents) {
                    const withdrawCode = this.creepRef.transfer(storage, content);
    
                    if (withdrawCode === ERR_NOT_IN_RANGE) {
                        this.moveToObject(storage);
    
                        break;
                    } else if (withdrawCode === OK) {
                        if (this.creepRef.store.getUsedCapacity() == 0) {
                            this.memory.task = dokCreepTask.Gather;

                            break;
                        }
                    }
                }

                break;
        }
    }

    protected RunFillOperation(flag : Flag) {
        const flagInfo = flag.name.split(' ');
        const resourceType : ResourceConstant = flagInfo[2] as any;
        const amountNeeded = Number(flagInfo[3]);

        const storage = this.util.FindResource<StructureStorage>(this.creepRef.room, FIND_STRUCTURES).find(i => i.structureType === 'storage');

        if (!storage)
            return;

        // get contents of storage
        const creepContents = (Object.keys(this.creepRef.store) as ResourceConstant[]).filter(i => i !== resourceType);

        if (creepContents.length > 0) {
            for(const content of creepContents) {
                const withdrawCode = this.creepRef.transfer(storage, content);
    
                if (withdrawCode === ERR_NOT_IN_RANGE) {
                    this.moveToObject(storage);
    
                    break;
                } else if (withdrawCode === OK) {
                    if (this.creepRef.store.getUsedCapacity() == 0) {
                        this.memory.task = dokCreepTask.Gather;
    
                        break;
                    }
                }
            }

            return;
        }

        switch(this.memory.task) {
            case dokCreepTask.Gather:
                let amountToPull = amountNeeded;

                if (amountToPull > this.creepRef.store.getFreeCapacity()) {
                    amountToPull = this.creepRef.store.getFreeCapacity();
                }

                const withdrawCode = this.creepRef.withdraw(storage, resourceType, amountToPull);

                if (withdrawCode === ERR_NOT_IN_RANGE) {
                    this.moveToObject(storage);

                    return;
                } else if (withdrawCode === ERR_NOT_ENOUGH_RESOURCES) {
                    this.creepRef.say(`🪤`);

                    return;
                }

                if (this.creepRef.store.getUsedCapacity(resourceType) >= amountToPull) {
                    this.memory.task = dokCreepTask.Deposit;
                }

                break;
            case dokCreepTask.Deposit:
                const fillObject = flag.pos.findInRange(FIND_STRUCTURES, 0).find((i : any) => typeof i.store !== 'undefined') as StructureContainer;

                if (!fillObject) {
                    this.creepRef.say(`?`);

                    console.log(`[dokUtil][FactoryWorker] factory worker could not find endpoint of fill operation for room ${flag.pos.roomName}`)

                    return;
                }

                if (fillObject.store[resourceType] < amountNeeded) {
                    const transferCode = this.creepRef.transfer(fillObject, resourceType);

                    if (transferCode === ERR_NOT_IN_RANGE) {
                        this.moveToObject(fillObject);

                        return;
                    }

                    this.CheckIfDepositEmpty();

                    return;
                }

                flag.remove();

                break;
        }
    }

    protected RunPowerProcessOperation(flag : Flag) {
        const powerSpawn = this.util.FindResource<StructurePowerSpawn>(this.creepRef.room, FIND_STRUCTURES).find(i => i.structureType === 'powerSpawn');

        if (!powerSpawn) {
            flag.remove();

            return;
        }

        if (powerSpawn.store.power < 1) {
            powerSpawn.pos.createFlag(`${powerSpawn.pos.roomName} Fill power 100`);

            return;
        }

        if (powerSpawn.store.energy < 1) {
            powerSpawn.pos.createFlag(`${powerSpawn.pos.roomName} Fill energy 5000`);

            return;
        }

        if (dokUtil.getDistance(this.creepRef.pos, powerSpawn.pos) > 1) {
            this.moveToObject(powerSpawn);

            return;
        }

        const processCode = powerSpawn.processPower();

        if (processCode === OK) {
            this.creepRef.say(`⚙️🎉`);
        }
    }

    protected RunFillEnergyOperation(flag : Flag) {
        const flagInfo = flag.name.split(' ');
        const energyNeeded = Number(flagInfo[2]);

        switch(this.memory.task) {
            case dokCreepTask.Gather:
                this.DoBasicGather();

                break;
            case dokCreepTask.Deposit:
                const terminal = this.creepRef.room.terminal;

                if (!terminal)
                    return;

                if (terminal.store.energy < energyNeeded) {
                    if (this.creepRef.transfer(terminal, 'energy') === ERR_NOT_IN_RANGE) {
                        this.moveToObject(terminal);
                    }

                    this.CheckIfDepositEmpty();

                    return;
                }

                flag.remove();

                break;
        }
    }

    protected PrepTerminalForTransfer(terminal: StructureTerminal, remoteRoom: string, resource: ResourceConstant, flag: Flag) {
        const transferCost = Game.market.calcTransactionCost(terminal.store.getUsedCapacity(), terminal.room.name, remoteRoom);

        if (terminal.store.energy < transferCost) {
            terminal.room.createFlag(terminal.pos, `${terminal.room.name} PrepTransfer ${transferCost}`);

            this.memory.task = dokCreepTask.Gather;

            return;
        }

        const resourceQuantity = terminal.store.getUsedCapacity(resource);

        terminal.send(resource, resourceQuantity, remoteRoom, `${this.memory.homeRoom} -> 📦 ${resource} (x${resourceQuantity}) -> ${remoteRoom}`);
        Game.notify(`Resource transfer:\n${this.memory.homeRoom} -> 📦 ${resource} (x${resourceQuantity}) -> ${remoteRoom}`);

        flag.remove();
    }

    protected RunTransferOperation(flag : Flag) {
        const flagInfo = flag.name.split(' ');
        const materialInfo = flagInfo[2] as ResourceConstant;
        const destRoom = flagInfo[3];
        const resourceCount = Number(flagInfo[4] || 200000)

        switch(this.memory.task) {
            case dokCreepTask.Gather:
                const storage = this.util.FindResource<StructureStorage>(this.creepRef.room, FIND_STRUCTURES).find(i => i.structureType === 'storage');

                if (!storage)
                    return;

                const withdrawCode = this.creepRef.withdraw(storage, materialInfo);

                if (withdrawCode === ERR_NOT_IN_RANGE) {
                    this.moveToObject(storage);

                    return;
                } else if (withdrawCode === ERR_NOT_ENOUGH_RESOURCES) {
                    if (!this.creepRef.room.terminal)
                        return;

                    this.PrepTerminalForTransfer(this.creepRef.room.terminal, destRoom, materialInfo, flag);

                    return;
                }

                if (this.creepRef.store.getFreeCapacity() <= 0) {
                    this.memory.task = dokCreepTask.Deposit;
                }

                break;
            case dokCreepTask.Deposit:
                const terminal = this.creepRef.room.terminal;

                if (!terminal)
                    return;

                const contents = (Object.keys(this.creepRef.store) as ResourceConstant[]);

                if (contents.length === 0) {
                    this.memory.task = dokCreepTask.Gather;

                    return;
                }
    
                for(const content of contents) {
                    const withdrawCode = this.creepRef.transfer(terminal, content);
    
                    if (withdrawCode === ERR_NOT_IN_RANGE) {
                        this.moveToObject(terminal);
    
                        break;
                    } else if (withdrawCode === OK) {
                        if (this.creepRef.store.getUsedCapacity() == 0) {
                            this.memory.task = dokCreepTask.Gather;

                            break;
                        }
                    }
                }

                if (terminal.store.getUsedCapacity() >= resourceCount) {
                    this.PrepTerminalForTransfer(terminal, destRoom, materialInfo, flag);

                    return;
                }

                break;
            default:
                break;
        }

        return;
    }

    public DoCreepWork(): void {
        const flags = this.util.GetFlagArray().filter(i => i.name.startsWith(this.memory.homeRoom));

        const fillEnergyFlag = flags.find(i => i.name.startsWith(`${this.memory.homeRoom} PrepTransfer`));

        if (typeof fillEnergyFlag !== 'undefined') {
            this.RunFillEnergyOperation(fillEnergyFlag);

            return;
        }

        // transfer flag
        const transferMaterialFlag = flags.find(i => i.name.startsWith(`${this.memory.homeRoom} Transfer`));

        if (typeof transferMaterialFlag !== 'undefined') {
            this.RunTransferOperation(transferMaterialFlag);

            return;
        }

        const drainIntoFlag = flags.find(i => i.name.startsWith(`${this.memory.homeRoom} Drain`));

        if (typeof drainIntoFlag !== 'undefined') {
            this.RunDrainOperation(drainIntoFlag);

            return;
        }

        const fillFlag = flags.find(i => i.name.startsWith(`${this.memory.homeRoom} Fill`));

        if (typeof fillFlag !== 'undefined') {
            this.RunFillOperation(fillFlag);

            return;
        }

        const powerProcessFlag = flags.find(i => i.name.startsWith(`${this.memory.homeRoom} PowerProcess`));

        if (typeof powerProcessFlag !== 'undefined') {
            this.RunPowerProcessOperation(powerProcessFlag);

            return;
        }
    }
}