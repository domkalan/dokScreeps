import { dokScreeps } from "../dokScreeps";
import { Numbers } from "../Numbers";
import { dokCreep } from "./Creep";



export class dokDefenderCreep extends dokCreep {
    private fleeCheck: number = 0;
    private noHostilesFor: number = 0;

    constructor(ref: Creep, dks: dokScreeps) {
        super(ref, dks);

        this.creepRef.notifyWhenAttacked(false);
    }

    public DoDefenderWork() {
        const homeRoom = this.GetRoomRefSafe();
        const hostiles = homeRoom.GetHostiles();

        if (hostiles.length > 0) {
            this.noHostilesFor = 0;

            if(this.creepRef.getActiveBodyparts(RANGED_ATTACK) > 0) {
                // blast hostiles
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
                    this.creepRef.moveTo(hostileTarget);

                    return;
                }
    
                return;
            } else {
                const hostileTarget = hostiles[0];
    
                const attackCode = this.creepRef.attack(hostileTarget);

                if (attackCode === -9) {
                    this.creepRef.moveTo(hostileTarget);

                    return;
                }

                return;
            }
        } else {
            this.noHostilesFor++;

            const protectFlag = this.dokScreepsRef.GetFlags().find(i => i.room?.name === this.fromRoom && i.color === COLOR_RED && i.secondaryColor === COLOR_WHITE);

            if (typeof protectFlag !== 'undefined') {
                if (this.creepRef.pos.getRangeTo(protectFlag) > 4) {
                    this.creepRef.moveTo(protectFlag);
                } else {
                    this.creepRef.say('👀');
                }

                return;
            }

            if (this.noHostilesFor >= 100) {
                const idlePosition = new RoomPosition(25, 25, this.fromRoom);

                if (this.creepRef.pos.getRangeTo(idlePosition) > 8) {
                    this.creepRef.moveTo(idlePosition);
                } else {
                    this.creepRef.say('👀');
                }
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

    public static buildBody: BodyPartConstant[] = [ TOUGH, MOVE, ATTACK ];
    public static buildName: string = 'defender';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        const randomChance = Numbers.getRandomInt(0, 10);

        // if random chance is met, spawn long range
        if (randomChance === 8) {
            const buildBody: BodyPartConstant[] = [TOUGH, MOVE, RANGED_ATTACK]; // Base body
        
            let totalCost = buildBody.reduce((sum, part) => sum + BODYPART_COST[part as keyof typeof BODYPART_COST], 0);

            // Add additional parts while respecting the energy limit
            while (totalCost + BODYPART_COST.move + BODYPART_COST.ranged_attack <= energy && buildBody.length < 50) {
                buildBody.push(MOVE, RANGED_ATTACK);
                totalCost += BODYPART_COST.move + BODYPART_COST.ranged_attack;
            }

            return buildBody;
        }

        // if not, spawn regular attacker
        const buildBody: BodyPartConstant[] = [...this.buildBody]; // Base body
        
        let totalCost = buildBody.reduce((sum, part) => sum + BODYPART_COST[part as keyof typeof BODYPART_COST], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + BODYPART_COST.move + BODYPART_COST.attack <= energy && buildBody.length < 50) {
            buildBody.push(MOVE, ATTACK);
            totalCost += BODYPART_COST.move + BODYPART_COST.attack;
        }

        return buildBody;
    }
}