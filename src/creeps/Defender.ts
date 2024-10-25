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
                this.MoveTo(hostileTarget);
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
        const partCost = {
            move: 50,
            ranged_attack: 150,
        };

        let totalCost = buildBody.reduce((sum, part) => sum + partCost[part as keyof typeof partCost], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + partCost.move + partCost.ranged_attack <= energy && buildBody.length < 50) {
            buildBody.push(MOVE, RANGED_ATTACK);
            totalCost += partCost.move + partCost.ranged_attack;
        }

        return buildBody;
    }
}