import { dokScreeps } from "../dokScreeps";
import { dokCreep, dokCreepMemory } from "./Creep";

export class dokRancherCreep extends dokCreep {
    private focusedStructure: string | null = null;

    constructor(creep: Creep, dokScreepInstance : dokScreeps) {
        super(creep, dokScreepInstance);
    }

    public DoRancherWork() {
        const spawn = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).find(i => i.structureType === 'spawn') as StructureSpawn;
        const extensions = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).filter(i => i.structureType === 'extension') as StructureExtension[];

        if (typeof spawn === 'undefined') {
            this.creepRef.say(`?`);

            return;
        }

        if (this.creepRef.store.energy === 0) {
            this.creepRef.say(`⚡?`);

            this.sleepTime = 10;

            this.RequestEnergyDelivery();

            return;
        }

        const rancherStructures = [spawn, ...extensions].filter(i => i.store.getFreeCapacity('energy') > 0);

        if (rancherStructures.length === 0) {
            this.creepRef.say(`⚡🔋`);

            this.sleepTime = 10;

            return;
        }

        if (this.focusedStructure !== null) {
            const focusedStructure = rancherStructures.find(i => i.id === this.focusedStructure);

            if (typeof focusedStructure !== 'undefined') {
                const transferCode = this.creepRef.transfer(focusedStructure, 'energy');
    
                if (transferCode === -9) {
                    this.MoveTo(focusedStructure);

                    return;
                } else if (transferCode === -8) {
                    this.focusedStructure = null;
                }
            }
        }

        const lowStructure = rancherStructures[0];

        this.focusedStructure = lowStructure.id;

        const transferCode = this.creepRef.transfer(lowStructure, 'energy');
    
        if (transferCode === -9) {
            this.MoveTo(lowStructure);
        }
    }

    public RequestEnergyDelivery() {
        const roomRef = this.GetRoomRefSafe();

        roomRef.AddDeliveryToHaulQueue(this.creepRef.id, 'energy', 3, new RoomPosition(this.creepRef.pos.x, this.creepRef.pos.y - 2, this.creepRef.pos.roomName));
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoRancherWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ WORK, CARRY, CARRY ];
    public static buildName: string = 'rancher';
}