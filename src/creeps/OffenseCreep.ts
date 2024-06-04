import dokUtil from "../dokUtil";
import dokCreep, { dokCreepJob, dokCreepMemory, dokCreepTask } from "./Base";
import { dokCreepHealer } from "./Healer";

export interface dokCreepOffenseCreepMemory extends dokCreepMemory {
    waypointsMet: Array<string>
}

export default class dokCreepOffenseCreep extends dokCreep {
    protected assignedHealer: string | null = null;
    protected lastHealerCheck: number = 0;

    protected waitingForGroup : boolean = true;

    protected memory: dokCreepOffenseCreepMemory;

    protected hostilesScan: number = 0;

    constructor(util : dokUtil, creep : Creep) {
        super(util, creep);

        // disable path caching
        this.moveSpammyDisable = true;

        // extend creep memory
        this.memory = this.creepRef.memory as any;

        if (typeof this.memory.waypointsMet === 'undefined') {
            this.memory.waypointsMet = [];
        }
    }

    private AttackTarget(target : Creep | PowerCreep | Structure) {
        const attackCode = this.creepRef.attack(target);

        if (attackCode === OK) {
            return;
        }


        if (attackCode === ERR_NOT_IN_RANGE || attackCode === ERR_NO_BODYPART) {
            const rangedAttackCode = this.creepRef.rangedAttack(target);

            if (rangedAttackCode === ERR_NOT_IN_RANGE || rangedAttackCode === OK) {
                this.moveToObject(target);
            }
        }
    }

    protected CreepGoRetire() {
        if (this.creepRef.room.name !== this.memory.homeRoom) {
            this.moveToObjectFar(new RoomPosition(25, 25, this.memory.homeRoom))

            return;
        }

        const homeStructures = this.creepRef.room.find(FIND_STRUCTURES).filter(i => i.structureType === 'spawn') as StructureSpawn[];

        if (homeStructures.length === 0) {
            this.creepRef.say('NO SPAWN!')

            return;
        }

        if (homeStructures[0].recycleCreep(this.creepRef) === ERR_NOT_IN_RANGE) {
            this.moveToObject(homeStructures[0]);
        }

        return;
    }

    protected CreepGoAttack() {
        const flags = this.util.GetFlagArray();
        const flag = flags.filter(i => !i.name.includes('Waypoint')).find(i => i.name.startsWith(this.memory.homeRoom + ' Attack') || i.name.includes('Attack'))

        if (typeof flag === 'undefined') {
            this.CreepGoRetire();

            return;
        }

        if (flag.pos.roomName !== this.creepRef.room.name) {
            this.moveToObjectFar(new RoomPosition(25, 25, flag.pos.roomName));

            return;
        }

        if (flag.name.includes('AttackStage')) {
            if (this.creepRef.pos.getRangeTo(flag.pos) > 8) {
                this.moveToObject(flag.pos)

                return;
            }

            return;
        }

        if (flag.name.includes('AttackHostiles')) {
            const hostiles = this.util.FindResource<Creep>(this.creepRef.room, FIND_CREEPS);
            const hostilePower = this.util.FindResource<PowerCreep>(this.creepRef.room, FIND_POWER_CREEPS);

            const hostilesHere : Array<Creep | PowerCreep> = hostilePower.concat(hostiles as any).filter(i => i.owner.username !== this.creepRef.owner.username);

            if (hostilesHere.length > 0) {
                this.AttackTarget(hostilesHere[0]);

                return;
            } else {
                flag.remove();
            }
        }

        if (flag.name.includes('AttackStructureHere')) {
            const attackStructure = flag.pos.findClosestByRange(FIND_STRUCTURES);

            if (attackStructure !== null) {
                if (attackStructure.pos.getRangeTo(flag) <= 4) {
                    this.AttackTarget(attackStructure);

                    return;
                } else {
                    flag.remove();
                }
            } else {
                flag.remove();
            }
        }

        if (flag.name.includes('AttackStructure')) {
            const attackStructure = flag.pos.findClosestByRange(FIND_STRUCTURES);

            if (attackStructure !== null) {
                this.AttackTarget(attackStructure);

                return;
            } else {
                flag.remove();
            }
        }

        if (flag.name.includes('AttackConstruction')) {
            const attackStructures = this.util.FindResource<ConstructionSite>(this.creepRef.room, FIND_CONSTRUCTION_SITES).filter(i => i.owner.username !== this.creepRef.owner.username);

            if (attackStructures.length > 0) {
                this.moveToObject(attackStructures[0])

                return;
            } else {
                flag.remove();
            }
        }

        this.CreepGoRetire();
    }

    protected AttemptAssignHealer() {
        const healersFromHere = this.util.GetDokCreeps().filter(i => i.GetCurrentMemory().homeRoom === this.memory.homeRoom && i.GetJob() === dokCreepJob.Healer) as dokCreepHealer[];
        const freeHealers = healersFromHere.filter(i => i.IsHealerFree() && !i.GetRef().spawning);

        if (freeHealers.length === 0) {
            return;
        }

        freeHealers[0].AssignToCreep(this);
        this.assignedHealer = freeHealers[0].GetId();

        this.creepRef.say(`🤝❤️`);
    }

    public DoCreepWork(): void {
        const flags = this.util.GetFlagArray();

        if (!this.assignedHealer) {
            if (this.lastHealerCheck === 0) {
                this.AttemptAssignHealer();
            }

            this.lastHealerCheck++;
            if (this.lastHealerCheck >= 10) {
                this.lastHealerCheck = 0;
            }
        }

        let waypointFlags = flags.filter(i => i.name.includes('AttackWaypoint') && !this.memory.waypointsMet.includes(i.name));

        if (waypointFlags.length >= 2) {
            waypointFlags = waypointFlags.sort((a, b) => {
                const flagSplitA = a.name.split(' ');
                const flagSplitB = b.name.split(' ');
    
                return Number(flagSplitA[1]) - Number(flagSplitB[2]);
            });
        }

        if (waypointFlags.length > 0) {
            console.log(`[dokUtil][dokAttacker] creep ${this.creepRef.name} has ${waypointFlags.length} to hit`)

            const moveCode = this.creepRef.pos.getRangeTo(waypointFlags[0].pos);

            if (moveCode >= 4) {
                this.hostilesScan++;

                if (this.hostilesScan >= 5) {
                    const hostiles = this.util.FindResource<Creep>(this.creepRef.room, FIND_CREEPS);
                    const hostilePower = this.util.FindResource<PowerCreep>(this.creepRef.room, FIND_POWER_CREEPS);
    
                    const hostilesHere : Array<Creep | PowerCreep> = hostilePower.concat(hostiles as any).filter(i => i.owner.username !== this.creepRef.owner.username && i.pos.getRangeTo(this.creepRef.pos) <= 6);
    
                    if (hostilesHere.length === 0) {
                        this.hostilesScan = 0;
                    } else {
                        this.AttackTarget(hostiles[0]);

                        return;
                    }
                }
                

                if (moveCode === 4) {
                    this.memory.waypointsMet.push(waypointFlags[0].name);

                    this.SaveMemory();

                    return;
                }

                this.moveToObjectFar(waypointFlags[0].pos);

                return;
            }
        }

        this.CreepGoAttack();
    }
}