import { dokFlag } from "../Flags";
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
        const partCost = {
            move: 50,
            attack: 80,
            tough: 10
        };

        let totalCost = buildBody.reduce((sum, part) => sum + partCost[part as keyof typeof partCost], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + partCost.move + partCost.attack + partCost.tough <= energy && buildBody.length < 50) {
            buildBody.push(MOVE, ATTACK);
            totalCost += partCost.move + partCost.attack;
        }

        return buildBody;
    }
}