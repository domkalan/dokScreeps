import { dokScreeps } from "../dokScreeps";
import { dokCreep, dokCreepMemory } from "./Creep";

export class dokServantCreep extends dokCreep {
    private energyStorageCap: number = 0;

    constructor(creep: Creep, dokScreepInstance : dokScreeps) {
        super(creep, dokScreepInstance);

        this.energyStorageCap = this.creepRef.store.getCapacity('energy');
    }

    public DoControllerWork() {
        const controller = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom).find(i => i.structureType === 'controller') as StructureController;

        if (typeof controller === 'undefined') {
            this.creepRef.say(`?`);

            return;
        }

        
        if (this.creepRef.store.energy < this.energyStorageCap * 0.50) {
            this.creepRef.say(`🪫⚡`);

            this.RequestEnergyDelivery();
        }

        const upgradeCode = this.creepRef.upgradeController(controller);

        if (upgradeCode == -9) {
            this.MoveTo(controller);
        } else if (upgradeCode === -6) {
            this.creepRef.say(`⚡?`);

            this.sleepTime = 10;

            this.RequestEnergyDelivery();
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

        this.DoControllerWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ WORK, CARRY, MOVE ];
    public static buildName: string = 'servant';

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        const buildBody: BodyPartConstant[] = [...this.buildBody]; // Base body
        const partCost = {
            move: 50,
            carry: 50,
            work: 50
        };

        let totalCost = buildBody.reduce((sum, part) => sum + partCost[part as keyof typeof partCost], 0);

        // Add additional parts while respecting the energy limit
        while (totalCost + partCost.move + partCost.carry + partCost.work <= energy) {
            buildBody.push(CARRY, MOVE);
            totalCost += partCost.move + partCost.carry;
        }

        return buildBody;
    }
}