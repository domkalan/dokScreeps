import { dokFlag } from "../Flags";
import { Logger } from "../Logger";
import { dokCreep } from "./Creep";



export class dokAttackerCreep extends dokCreep {
    private focusedFlag: dokFlag | null = null;
    private focusedAttackStructure: string | null = null;

    public DoAttackerWork() {
        if (this.focusedFlag === null) {
            const roomFlags = this.dokScreepsRef.GetAssignedFlags(this.fromRoom);
            const attackFlags = roomFlags.filter(i => i.flagRef?.color === COLOR_RED);
    
            if (attackFlags.length > 0) {
                this.focusedFlag = attackFlags[0];
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
        if (flag.flagRef?.color === COLOR_RED && flag.flagRef.secondaryColor === COLOR_RED ||
            flag.flagRef?.color === COLOR_RED && flag.flagRef.secondaryColor === COLOR_ORANGE
        ) {
            if (this.focusedAttackStructure === null) {
                const structureNearFlag = flag.flagRef.pos.findInRange(FIND_STRUCTURES, 0);

                if (structureNearFlag.length === 0) {
                    flag.flagRef.remove();

                    return;
                }

                this.focusedAttackStructure = structureNearFlag[0].id;
            }
            
            const attackStructure = Game.getObjectById(this.focusedAttackStructure) as Structure;

            if (attackStructure === null) {
                this.focusedAttackStructure = null;

                return;
            }

            const attackCode = this.creepRef.attack(attackStructure);

            if (attackCode === -9) {
                this.MoveTo(attackStructure);
            }
        }

        if (flag.flagRef?.color === COLOR_RED && flag.flagRef.secondaryColor === COLOR_GREY) {
            if (this.creepRef.pos.getRangeTo(flag.flagRef) > 8) {
                this.MoveTo(flag.flagRef);

                return;
            }

            this.sleepTime = 10;
        }

        if (flag.flagRef?.color === COLOR_RED && flag.flagRef.secondaryColor === COLOR_PURPLE) {
            const structuresHere = this.dokScreepsRef.GetStructuresByRoom(this.creepRef.pos.roomName);

            let controller = structuresHere.find(i => i.structureType === 'controller') as StructureController;

            if (typeof controller === 'undefined') {
                const fallbackController = this.creepRef.room.find(FIND_STRUCTURES).find(i => i.structureType === 'controller') as StructureController;

                if (typeof fallbackController === 'undefined') {
                    flag.flagRef.remove();

                    return;
                }

                controller = fallbackController;
            }

            const signCode = this.creepRef.signController(controller, flag.name);

            if (signCode === -9) {
                this.MoveTo(controller);

                return;
            } else if (signCode === 0) {
                flag.flagRef.remove();
            }
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoAttackerWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ TOUGH, MOVE, MOVE, ATTACK ];
    public static buildName: string = 'attacker';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        const buildBody: BodyPartConstant[] = [...this.buildBody]; // Base body

        let totalCost = buildBody.reduce((sum, part) => sum + BODYPART_COST[part as keyof typeof BODYPART_COST], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + BODYPART_COST.move + BODYPART_COST.attack + BODYPART_COST.tough <= energy && buildBody.length < 50) {
            buildBody.push(MOVE, ATTACK);

            totalCost += BODYPART_COST.move + BODYPART_COST.attack;

            if (buildBody.length % 6) {
                buildBody.unshift(TOUGH);

                totalCost += BODYPART_COST.tough;
            }
        }

        return buildBody;
    }
}