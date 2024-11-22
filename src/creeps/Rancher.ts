import { Distance } from "../Distance";
import { Locks } from "../Locks";
import { dokCreep, dokCreepMemory } from "./Creep";

export class dokRancherCreep extends dokCreep {
    private focusedStructure: string | null = null;

    public DoRancherWork() {
        if (this.focusedStructure === null) {
            const structures = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom);
            const spawn = structures.filter(i => i.structureType === 'spawn');
            const extensions = structures.filter(i => i.structureType === 'extension');

            const pos = this.creepRef.pos;

            const spawnStructures = ([...spawn, ...extensions] as StructureExtension[]).filter(i => i.store.energy < i.store.getCapacity('energy')).sort((a, b) => Distance.GetDistance(pos, a.pos) - Distance.GetDistance(pos, b.pos));
            const spawnStructuresFree = spawnStructures.filter(i => Locks.GetLocks({ id: i.id }).length === 0)

            if (spawnStructuresFree.length === 0) {
                this.sleepTime = 10;

                this.creepRef.say(`🔋`);

                return;
            }

            this.focusedStructure = spawnStructuresFree[0].id;

            Locks.PlaceLock({ id: this.focusedStructure }, this);

            this.creepRef.say(`🔒`);
        }

        const lowStructure = Game.getObjectById(this.focusedStructure) as Structure;

        if (lowStructure === null)
            return;

        const transferCode = this.creepRef.transfer(lowStructure, 'energy');

        if (transferCode == -9) {
            this.MoveTo(lowStructure);
        } else if (transferCode === 0) {
            this.focusedStructure = null;

            Locks.ReleaseLocks(this);

            this.creepRef.say(`🔓`);
        } else if (transferCode == -6) {
            if (this.creepRef.store.energy === 0) {
                this.creepRef.say(`⚡️?`);
    
                this.RequestEnergyDelivery();
    
                this.sleepTime = 10;
            }
        }
    }

    public RequestEnergyDelivery() {
        const roomRef = this.GetRoomRefSafe();

        roomRef.AddDeliveryToHaulQueue(this.creepRef.id, 'energy', 2, new RoomPosition(this.creepRef.pos.x, this.creepRef.pos.y - 2, this.creepRef.pos.roomName));
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoRancherWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ MOVE, CARRY, CARRY ];
    public static buildName: string = 'rancher';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        const buildBody: BodyPartConstant[] = [...this.buildBody]; // Base body

        let totalCost = buildBody.reduce((sum, part) => sum + BODYPART_COST[part as keyof typeof BODYPART_COST], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + BODYPART_COST.move + BODYPART_COST.carry <= energy && buildBody.length < 50) {
            buildBody.push(CARRY, MOVE);
            totalCost += BODYPART_COST.move + BODYPART_COST.carry;
        }

        return buildBody;
    }
}