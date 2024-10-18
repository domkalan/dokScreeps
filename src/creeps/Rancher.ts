import { Distance } from "../Distance";
import { dokScreeps } from "../dokScreeps";
import { dokCreep, dokCreepMemory } from "./Creep";

export class dokRancherCreep extends dokCreep {
    private focusedStructure: string | null = null;

    public DoRancherWork() {
        if (this.creepRef.store.energy === 0) {
            this.creepRef.say(`⚡?`);

            this.RequestEnergyDelivery();

            this.sleepTime = 10;
            
            return;
        }

        if (this.focusedStructure === null) {
            const structures = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom);
            const spawn = structures.filter(i => i.structureType === 'spawn');
            const extensions = structures.filter(i => i.structureType === 'extension');

            const pos = this.creepRef.pos;

            const spawnStructures = ([...spawn, ...extensions] as StructureExtension[]).filter(i => i.store.energy < i.store.getCapacity('energy')).sort((a, b) => Distance.GetDistance(pos, a.pos) - Distance.GetDistance(pos, b.pos));

            if (spawnStructures.length === 0) {
                this.sleepTime = 10;

                this.creepRef.say(`🔋`);

                return;
            }

            this.focusedStructure = spawnStructures[0].id;
        }

        const lowStructure = Game.getObjectById(this.focusedStructure) as Structure;

        if (lowStructure === null)
            return;

        const transferCode = this.creepRef.transfer(lowStructure, 'energy');

        if (transferCode == -9) {
            this.MoveTo(lowStructure);
        } else if (transferCode === 0) {
            this.focusedStructure = null;
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
        const partCost = {
            move: 50,
            carry: 100
        };

        let totalCost = buildBody.reduce((sum, part) => sum + partCost[part as keyof typeof partCost], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + partCost.move + partCost.carry <= energy) {
            buildBody.push(CARRY, MOVE);
            totalCost += partCost.move + partCost.carry;
        }

        return buildBody;
    }
}