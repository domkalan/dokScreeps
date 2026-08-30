import { RoomContext } from "utils/Context";
import { goForEnergy } from "./builder";
import { upgradeRoomController } from "./queen";

export function runGoat(creep: Creep, context: RoomContext): void {
    // the queen needs energy to run, so if it has no energy, it will go get some
    if (creep.store[RESOURCE_ENERGY] === 0) {
        goForEnergy(creep, context);
        return;
    }

    upgradeRoomController(creep, context);
}