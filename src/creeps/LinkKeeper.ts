import { dokCreep, dokCreepMemory } from "./Creep";

export class dokLinkKeeperCreep extends dokCreep {
    public DoLinkWork() {
        const room = this.GetRoomRefSafe();

        const links = room.GetKnownLinks();
        const structures = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom);

        const mainLinkStub = links.find(i => i.type === 0);

        const mainStorage = structures.find(i => i.structureType === 'storage') as StructureStorage;
        const mainLink = structures.find(i => i.id === mainLinkStub?.id || null);

        if (typeof mainLink === 'undefined' || typeof mainStorage === 'undefined') {
            this.sleepTime = 25;

            return;
        }

        const pullCode = this.creepRef.withdraw(mainLink, 'energy');

        if (pullCode === -9) {
            this.MoveTo(mainLink);

            return;
        } else if (pullCode === -8 || this.creepRef.store.energy > 0) {
            const depositCode = this.creepRef.transfer(mainStorage, 'energy');

            if (depositCode === -9) {
                this.MoveTo(mainStorage);

                return;
            }
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoLinkWork();

        return false;
    }

    public static buildBody: BodyPartConstant[] = [ MOVE, CARRY ];
    public static buildName: string = 'linkkeeper';
}