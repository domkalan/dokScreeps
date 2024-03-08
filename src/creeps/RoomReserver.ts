import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepRoomReserver extends dokCreep {
    private targetFlag: Flag | null = null;

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocks({ id: `flag:${i.name}` }).filter(i => i.creep !== this.creepRef.id);

        return locksPlaced.length;
    };

    public DoCreepWork(): void {
        if (this.targetFlag === null) {
            const reserveFlags = this.util.GetFlagArray().filter(i => i.name.startsWith(`${this.memory.homeRoom} Reserve`)).sort((a, b) => this.GetLockCountForFlag(b) - this.GetLockCountForFlag(a))

            if (reserveFlags.length === 0) {
                this.creepRef.say('No flag!');

                this.creepRef.suicide();

                return;
            }

            this.targetFlag = reserveFlags[0];

            this.util.PlaceLock({ id: `flag:${this.targetFlag.name}` }, this);
        }

        if (typeof Game.flags[this.targetFlag.name] === 'undefined') {
            this.creepRef.say('Flag gone!');

            this.creepRef.suicide();

            return;
        }

        if (this.targetFlag.room?.name !== this.creepRef.room.name) {
            this.moveToObjectFar(this.targetFlag.pos);

            return;
        }

        const controller = this.creepRef.room.controller;

        if (!controller) {
            this.creepRef.say('Controller?');

            return;
        }

        const reserve = this.creepRef.reserveController(controller);

        if (reserve === ERR_NOT_IN_RANGE) {
            this.moveToObject(controller);
        } else if (reserve === OK) {
            if (typeof Memory.flags[this.targetFlag.name] !== 'undefined' && typeof (Memory.flags[this.targetFlag.name] as any).controllerSign !== 'undefined' &&  controller.sign?.text !==  (Memory.flags[this.targetFlag.name] as any).controllerSign)
                this.creepRef.signController(controller, (Memory.flags[this.targetFlag.name] as any).controllerSign);

            const homeRoom = this.util.GetDokRoom(this.memory.homeRoom);

            if (typeof homeRoom !== 'undefined' && typeof controller.reservation !== 'undefined')
                homeRoom.NotifyRoomReserveTicks({ flags: [this.targetFlag.name], room: this.creepRef.room.name, ticks: controller.reservation.ticksToEnd });
        }
    }
}