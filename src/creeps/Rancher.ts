import { dokScreeps } from "../dokScreeps";
import { dokCreep, dokCreepMemory } from "./Creep";

export class dokRancherCreep extends dokCreep {
    private focusedStructure: string | null = null;

    constructor(creep: Creep, dokScreepInstance : dokScreeps) {
        super(creep, dokScreepInstance);
    }

    public DoRancherWork() {
        const spawnStructures = (this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).filter(i => i.structureType === 'spawn' || i.structureType === 'extension') as StructureSpawn[]).filter(i => i.store.energy < i.store.getCapacity('energy'));

        if (this.creepRef.store.energy === 0) {
            this.creepRef.say(`⚡?`);

            this.RequestEnergyDelivery();

            this.sleepTime = 10;
            
            return;
        }

        if (spawnStructures.length < 0) {
            this.sleepTime = 10;

            this.creepRef.say(`🔋`);

            return;
        }

        const transferCode = this.creepRef.transfer(spawnStructures[0], 'energy');

        if (transferCode == -9) {
            this.MoveTo(spawnStructures[0]);
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
}