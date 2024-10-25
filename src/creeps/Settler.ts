import { dokFlag } from "../Flags";
import { Logger } from "../Logger";
import { Settings } from "../Settings";
import { dokCreep } from "./Creep";



export class dokSettlerCreep extends dokCreep {
    private focusedFlag: dokFlag | null = null;
    private focusedController: string | null = null;

    public DoSettlerWork() {
        if (this.focusedFlag === null) {
            const roomFlags = this.dokScreepsRef.GetAssignedFlags(this.fromRoom);
            const settlerFlags = roomFlags.filter(i => i.flagRef?.color === COLOR_PURPLE);
    
            if (settlerFlags.length > 0) {
                this.focusedFlag = settlerFlags[0];
            } else {
                this.creepRef.say(`😴`);

                return;
            }
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
        if (flag.flagRef?.color === COLOR_PURPLE && flag.flagRef.secondaryColor === COLOR_PURPLE) {
            if (this.focusedController === null) {
                const controllers = (this.creepRef.room.find(FIND_STRUCTURES) as Structure[]).filter(i => i.structureType === 'controller');

                if (controllers.length === 0) {
                    this.creepRef.say('?');

                    return;
                }

                this.focusedController = controllers[0].id;
            }

            const controller = Game.getObjectById(this.focusedController) as StructureController;

            if (controller === null) {
                this.focusedController = null;

                return;
            }

            if (typeof controller.owner !== 'undefined' && controller.owner.username === Settings.username) {
                this.ConstructSpawn(flag);
                
                return;
            }

            const claimCode = this.creepRef.claimController(controller);

            Logger.Log(`${this.name}`, `Claim code resulted in ${claimCode}`);

            if (claimCode === -9) {
                this.MoveTo(controller);

                return;
            } else if (claimCode === 0) {
                this.dokScreepsRef.ManuallyRegisterRooms(this.creepRef.room);
            }

            return;
        }

        if (flag.flagRef?.color === COLOR_PURPLE && flag.flagRef.secondaryColor === COLOR_GREY) {
            if (this.focusedController === null) {
                const controllers = (this.creepRef.room.find(FIND_STRUCTURES) as Structure[]).filter(i => i.structureType === 'controller');

                if (controllers.length === 0) {
                    this.creepRef.say('?');

                    return;
                }

                this.focusedController = controllers[0].id;
            }

            const controller = Game.getObjectById(this.focusedController) as StructureController;

            if (controller === null) {
                this.focusedController = null;

                return;
            }

            const claimCode = this.creepRef.reserveController(controller);

            Logger.Log(`${this.name}`, `Claim code resulted in ${claimCode}`);

            if (claimCode === -9) {
                this.MoveTo(controller);

                return;
            } else if (claimCode === 0) {
                this.dokScreepsRef.ManuallyRegisterRooms(this.creepRef.room);
            }

            return;
        }
    }

    public ConstructSpawn(flag: dokFlag) {
        // basically prevent against rm -rf /, this has happened before :(
        if (this.creepRef.pos.roomName === this.fromRoom) {
            this.creepRef.say('🚩');

            throw new Error(`Something went terribly wrong, you almost rm -rf / your room!`);
        }

        const structuresHere = (this.creepRef.room.find(FIND_STRUCTURES) as Structure[]).filter(i => i.structureType !== 'constructedWall');

        for(const structure of structuresHere) {
            structure.destroy();
        }

        const constructCode = flag.flagRef.pos.createConstructionSite(STRUCTURE_SPAWN, `DS:${Game.time}`);
        
        Logger.Log(`${this.name}`, `Construct code resulted in ${constructCode}`);

        if (constructCode === 0) {
            flag.flagRef.remove();

            this.creepRef.say('🏁');

            this.focusedController = null;
            this.focusedFlag = null;
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoSettlerWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ MOVE, CLAIM ];
    public static buildName: string = 'settler';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        // copy build body, we don't want to edit static
        const buildBody = this.buildBody;

        if (rcl < 4)
            return buildBody;

        return [...buildBody, CLAIM];
    }
}