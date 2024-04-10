import dokCreep, { dokCreepJob, dokCreepTask } from "./Base";
import { dokCreepHealer } from "./Healer";

export default class dokCreepOffenseCreep extends dokCreep {
    protected assignedHealer: string | null = null;
    protected lastHealerCheck: number = 0;

    protected waitingForGroup : boolean = true;

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
        const flag = this.util.GetFlagArray().find(i => i.name.startsWith(this.memory.homeRoom + ' Attack'))

        if (typeof flag === 'undefined') {
            this.CreepGoRetire();

            return;
        }

        if (flag.pos.roomName !== this.creepRef.room.name) {
            this.moveToObjectFar(new RoomPosition(25, 25, flag.pos.roomName));

            return;
        }

        if (flag.name.includes('AttackHostiles')) {
            const hostiles = this.util.FindResource<Creep>(this.creepRef.room, FIND_HOSTILE_CREEPS);
            const hostilePower = this.util.FindResource<PowerCreep>(this.creepRef.room, FIND_HOSTILE_POWER_CREEPS);

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
        if (!this.assignedHealer) {
            if (this.lastHealerCheck === 0) {
                this.AttemptAssignHealer();
            }

            this.lastHealerCheck++;
            if (this.lastHealerCheck >= 10) {
                this.lastHealerCheck = 0;
            }
        }

        if (this.waitingForGroup && typeof Game.flags['AttackGroupUp'] !== 'undefined') {
            if (this.creepRef.pos.findInRange(FIND_MY_CREEPS, 10).filter(i => i.name.includes('Attacker')).length >= 3) {
                this.waitingForGroup = false;

                this.creepRef.say(`👥`);
            } else {
                const waitingObject = this.creepRef.pos.findClosestByRange(FIND_MY_SPAWNS);
                if (waitingObject !== null) {
                    const waitingLocation = new RoomPosition(16, 16, waitingObject.pos.roomName);
    
                    if (this.creepRef.pos.getRangeTo(waitingLocation) > 4) {
                        this.moveToObject(waitingLocation);
                    }
                }
            }

            return;
        }
        

        this.CreepGoAttack();
    }
}