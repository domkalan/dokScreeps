import { dokBootstrapCreep } from "./creeps/Bootstrap";
import { dokBuilderCreep } from "./creeps/Builder";
import { dokCreep } from "./creeps/Creep";
import { dokEnergyMinerCreep } from "./creeps/EnergyMiner";
import { dokHaulerCreep } from "./creeps/Hauler";
import { dokRancherCreep } from "./creeps/Rancher";
import { dokServantCreep } from "./creeps/Servant";
import { dokScreeps } from "./dokScreeps";
import { dokRoom } from "./rooms/Room";

export class InstanceManager {
    public static ParseRawCreep(creep: Creep, dokScreepInstance: dokScreeps) : dokCreep {
        const creepClass = creep.name.split(':')[0];

        switch(creepClass) {
            case 'creep':
                return new dokCreep(creep, dokScreepInstance);
            case 'bootstrap':
                return new dokBootstrapCreep(creep, dokScreepInstance);
            case 'energyminer':
                return new dokEnergyMinerCreep(creep, dokScreepInstance);
            case 'hauler':
                return new dokHaulerCreep(creep, dokScreepInstance);
            case 'builder':
                return new dokBuilderCreep(creep, dokScreepInstance);
            case 'servant':
                return new dokServantCreep(creep, dokScreepInstance);
            case 'rancher':
                return new dokRancherCreep(creep, dokScreepInstance);
            default:
                return new dokCreep(creep, dokScreepInstance);
        }

        
    }

    public static ParseRawRoom(room: Room, dokScreepInstance: dokScreeps) : dokRoom {
        return new dokRoom(room, dokScreepInstance);
    }
}