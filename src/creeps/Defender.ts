import { dokCreep } from "./Creep";



export class dokDefenderCreep extends dokCreep {
    private fleeCheck: number = 0;

    public DoDefenderWork() {
        const homeRoom = this.GetRoomRefSafe();
        const hostiles = homeRoom.GetHostiles();

        // blast hostiles
        if (hostiles.length > 0) {
            const hostileTarget = hostiles[0];

            const blastCode = this.creepRef.rangedAttack(hostileTarget);

            if (blastCode === 0) {
                if (this.fleeCheck <= 0) {
                    const range = this.creepRef.pos.getRangeTo(hostileTarget);

                    if (range <= 3) {
                        const fleePath = PathFinder.search(this.creepRef.pos, { pos: hostileTarget.pos, range: 5 }, { flee: true }).path;
                        this.creepRef.moveByPath(fleePath);

                        return;
                    } else {
                        this.fleeCheck = 8;

                        return;
                    }
                }

                this.fleeCheck--;
            } else if (blastCode === -9) {
                this.MoveTo(hostileTarget, false);
            }
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoDefenderWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ TOUGH, MOVE, RANGED_ATTACK ];
    public static buildName: string = 'defender';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        const buildBody: BodyPartConstant[] = [...this.buildBody]; // Base body
        
        let totalCost = buildBody.reduce((sum, part) => sum + BODYPART_COST[part as keyof typeof BODYPART_COST], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + BODYPART_COST.move + BODYPART_COST.ranged_attack <= energy && buildBody.length < 50) {
            buildBody.push(MOVE, RANGED_ATTACK);
            totalCost += BODYPART_COST.move + BODYPART_COST.ranged_attack;
        }

        return buildBody;
    }
}