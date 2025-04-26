import { dokFlag } from "../Flags";
import { Locks } from "../Locks";
import { Logger } from "../Logger";
import { Seats } from "../Seats";
import { Settings } from "../Settings";
import { dokCreep } from "./Creep";



export class dokShardBuilder extends dokCreep {
    private focusedFlag: dokFlag | null = null;
    private focusedConstruct: string | null = null;
    private scannedConstruct: number = 0;
    private needEnergy: boolean = false;
    private focusedEnergy: string | null = null;
    private scannedController: number = 0;

    public DoShardBuilderWork() {
        if (this.focusedFlag === null) {
            const roomFlags = this.dokScreepsRef.GetAssignedFlags(this.fromRoom).filter(i => i.flagRef.color === COLOR_GREY && i.flagRef.secondaryColor === COLOR_ORANGE);

            if (roomFlags.length === 0) {
                this.sleepTime = 5;
                return;
            }

            this.focusedFlag = roomFlags[0];
        }

        if (this.focusedFlag === null)
            return;

        // make sure flag still exists
        if (typeof Game.flags[this.focusedFlag.name] === 'undefined') {
            this.focusedFlag = null;

            this.creepRef.say('?');

            return;
        }
        
        if (this.creepRef.pos.roomName !== this.focusedFlag.flagRef.pos.roomName) {
            this.MoveTo(this.focusedFlag.flagRef);

            return;
        }

        this.PerformFlagAction(this.focusedFlag);
    }

    public PerformFlagAction(flag : dokFlag) {
        if (this.needEnergy) {
            if (this.focusedEnergy === null) {
                const energy = (this.creepRef.room.find(FIND_SOURCES_ACTIVE) as Source[]).filter((i) => {
                    const seats = Seats.GetSeatsForItem(this.creepRef.room, i);

                    return Locks.GetLocksWithoutMe(i, this).length <= seats;
                });

                if (energy.length === 0) {
                    this.sleepTime = 20;

                    return;
                }

                this.focusedEnergy = energy[0].id;

                Locks.PlaceLock(energy[0], this);
            }

            const energyNear = Game.getObjectById(this.focusedEnergy) as Source;

            if (energyNear === null) {
                this.focusedEnergy = null;

                return;
            }

            if (this.creepRef.pos.getRangeTo(energyNear) > 4) {
                this.creepRef.moveTo(energyNear);

                return;
            }

            const energyHarvestCode = this.creepRef.harvest(energyNear);

            if (energyHarvestCode === ERR_NOT_IN_RANGE) {
                this.creepRef.moveTo(energyNear);

                return;
            } else if (energyHarvestCode === ERR_NOT_ENOUGH_RESOURCES) {
                this.needEnergy = false;
            } else if (energyHarvestCode === OK) {
                if (this.creepRef.store.getFreeCapacity('energy') <= 0) {
                    this.needEnergy = false;

                    Locks.ReleaseLocks(this);
                }
            }

            return;
        }

        if (this.focusedConstruct !== null) {
            const constructionObject = Game.getObjectById(this.focusedConstruct) as ConstructionSite;

            if (constructionObject === null) {
                this.focusedConstruct = null;

                return;
            }

            if (this.creepRef.pos.getRangeTo(constructionObject) > 4) {
                this.creepRef.moveTo(constructionObject);

                return;
            }

            const constructCode = this.creepRef.build(constructionObject);

            if (constructCode === ERR_NOT_IN_RANGE) {
                this.creepRef.moveTo(constructionObject);

                return;
            } else if (constructCode === ERR_NOT_ENOUGH_RESOURCES) {
                this.needEnergy = true;
            }

            return;
        }

        if (this.scannedConstruct === 0) {
            const constructsHere = this.creepRef.room.find(FIND_MY_CONSTRUCTION_SITES);

            this.creepRef.say('👀');

            if (constructsHere.length >= 1) {
                if (this.creepRef.store.energy === 0) {
                    this.needEnergy = true;

                    return;
                }

                this.focusedConstruct = constructsHere[0].id;

                return;
            } else {
                this.scannedConstruct = 10;

                return;
            }
        }

        this.scannedConstruct--;

        if (this.scannedController === 0) {
            const controller = this.dokScreepsRef.GetStructuresByRoom(this.creepRef.name).find(i => i.structureType === 'controller') as StructureController;

            if (typeof controller === 'undefined') {
                this.scannedController = 100;

                return;
            }

            const constructCode = this.creepRef.upgradeController(controller);

            if (constructCode === ERR_NOT_IN_RANGE) {
                this.creepRef.moveTo(controller);

                return;
            } else if (constructCode === ERR_NOT_ENOUGH_RESOURCES) {
                this.needEnergy = true;
            }

            return;
        }

        if (this.creepRef.pos.getRangeTo(flag.flagRef) > 0) {
            this.MoveTo(flag.flagRef);
        } else {
            this.sleepTime = 10;
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoShardBuilderWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ MOVE, WORK, CARRY ];
    public static buildName: string = 's-builder';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        const buildBody: BodyPartConstant[] = [...this.buildBody]; // Base body

        let totalCost = buildBody.reduce((sum, part) => sum + BODYPART_COST[part as keyof typeof BODYPART_COST], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + BODYPART_COST.move + BODYPART_COST.work + BODYPART_COST.carry <= energy && buildBody.length < 50) {
            buildBody.push(MOVE, WORK, CARRY);
            totalCost += BODYPART_COST.move + BODYPART_COST.work + BODYPART_COST.carry;
        }

        return buildBody;
    }
}