import { dokAttackerCreep } from "./creeps/Attacker";
import { dokBootstrapCreep } from "./creeps/Bootstrap";
import { dokBuilderCreep } from "./creeps/Builder";
import { dokCreep } from "./creeps/Creep";
import { dokDefenderCreep } from "./creeps/Defender";
import { dokEnergyMinerCreep } from "./creeps/EnergyMiner";
import { dokEnergyMinerRemoteCreep } from "./creeps/EnergyMinerRemote";
import { dokHaulerCreep } from "./creeps/Hauler";
import { dokLinkKeeperCreep } from "./creeps/LinkKeeper";
import { dokRancherCreep } from "./creeps/Rancher";
import { dokServantCreep } from "./creeps/Servant";
import { dokSettlerCreep } from "./creeps/Settler";
import { dokShardBuilder } from "./creeps/ShardBuilder";
import { dokScreeps } from "./dokScreeps";
import { Logger } from "./Logger";
import { dokCustomRoom } from "./rooms/Custom";
import { dokFortifiedRoom } from "./rooms/Fortified";
import { dokJumperRoom } from "./rooms/Jumper";
import { dokOutpostRoom } from "./rooms/Outpost";
import { dokPuppetRoom } from "./rooms/Puppet";
import { dokRoom, dokRoomMemory, dokRoomType } from "./rooms/Room";

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
            case 'settler':
                return new dokSettlerCreep(creep, dokScreepInstance);
            case 'defender':
                return new dokDefenderCreep(creep, dokScreepInstance);
            case 'attacker':
                return new dokAttackerCreep(creep, dokScreepInstance);
            case 'linkkeeper':
                return new dokLinkKeeperCreep(creep, dokScreepInstance);
            case 'rem':
                return new dokEnergyMinerRemoteCreep(creep, dokScreepInstance);
            case 's-builder':
                return new dokShardBuilder(creep, dokScreepInstance);
            default:
                return new dokCreep(creep, dokScreepInstance);
        }
    }

    public static IsEssentialCreep(creep: Creep) {
        if (creep.name.startsWith('hauler')) {
            return true;
        } else if (creep.name.startsWith('bootstrap')) {
            return true;
        } else if (creep.name.startsWith('rancher')) {
            return true;
        } else if (creep.name.startsWith('defender')) {
            return true;
        }
        return false;
    }

    public static ParseRawRoom(room: Room, dokScreepInstance: dokScreeps) : dokRoom {
        if (typeof Memory.rooms[room.name] === 'undefined') {
            Logger.Error(`InstanceManager`, `${room.name} does not exist in room memory, will create`)

            Memory.rooms[room.name] = {};
        }

        if (typeof (Memory.rooms[room.name] as dokRoomMemory).roomType === 'undefined') {
            Logger.Error(`InstanceManager`, `${room.name} does not have room type, will assign base type`);

            (Memory.rooms[room.name] as dokRoomMemory).roomType = dokRoomType.Base;
        }

        switch((Memory.rooms[room.name] as dokRoomMemory).roomType) {
            case dokRoomType.Fortified:
                return new dokFortifiedRoom(room, dokScreepInstance);
            case dokRoomType.Puppet:
                return new dokPuppetRoom(room, dokScreepInstance);
            case dokRoomType.Outpost:
                return new dokOutpostRoom(room, dokScreepInstance);
            case dokRoomType.Jumper:
                return new dokJumperRoom(room, dokScreepInstance);
            case dokRoomType.Custom:
                return new dokCustomRoom(room, dokScreepInstance);
            default:
                return new dokRoom(room, dokScreepInstance);
        }
    }
}