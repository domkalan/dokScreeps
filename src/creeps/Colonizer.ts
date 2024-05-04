import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepColonizer extends dokCreep {
    private focusedFlag: string | null = null;

    protected RecycleCreep() {
        /*const homeRoom = this.util.GetDokRoom(this.memory.homeRoom);

        if (typeof homeRoom === 'undefined')
            return;

        const homeStructures = homeRoom.GetRef().find(FIND_STRUCTURES).filter(i => i.structureType === 'spawn') as StructureSpawn[];

        if (homeStructures.length === 0) {
            this.creepRef.say('NO SPAWN!')

            return;
        }

        if (homeStructures[0].recycleCreep(this.creepRef) === ERR_NOT_IN_RANGE) {
            this.moveToObjectFar(homeStructures[0]);
        }*/

        this.moveToObject(new RoomPosition(25, 25, this.memory.homeRoom))
    }

    protected ColonizeRoom(flag: Flag) {
        const controller = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES).find(i => i.structureType === 'controller') as StructureController;

        if (typeof controller === 'undefined') {
            this.creepRef.say('Controller?');

            return;
        }

        if (!controller.my) {
            if (this.creepRef.claimController(controller) === ERR_NOT_IN_RANGE) {
                this.moveToObject(controller);
            }

            return;
        }

        const centerOfRoom = new RoomPosition(25, 25, flag.pos.roomName);

        const buildableAreas = dokUtil.GetFreeSlots(this.creepRef.room, { pos: centerOfRoom }, 8, 1, ['swamp']);

        const placeableArea = buildableAreas.filter((plotScan) => {
            if (plotScan.code === 0) {
                new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                return false;
            }

            new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#ff4f00' });

            return true;
        }).sort((a, b) => dokUtil.getDistance(a.pos, centerOfRoom) - dokUtil.getDistance(b.pos, centerOfRoom));

        // place down spawn
        this.creepRef.room.createConstructionSite(placeableArea[0], 'spawn');

        const unixTimeNow = Math.floor(Date.now() / 1000);

        this.creepRef.room.createFlag(flag.pos.x, flag.pos.y, `${this.memory.homeRoom} Construct ${unixTimeNow} 4`);

        this.util.RefreshRooms();

        flag.remove();
    }

    protected ReserveRoom() {
        const controller = this.util.FindResource<Structure>(this.creepRef.room, FIND_STRUCTURES).find(i => i.structureType === 'controller') as StructureController;

        if (typeof controller === 'undefined') {
            this.creepRef.say('Controller?');

            return;
        }

        const controllerCode = this.creepRef.reserveController(controller);

        if (controllerCode === ERR_NOT_IN_RANGE) {
            this.moveToObject(controller);
        } else if (controllerCode === OK) {
            const homeRoom = this.util.GetDokRoom(this.memory.homeRoom);

            if (typeof homeRoom !== 'undefined') {
                homeRoom.NotifyReserveTicks(controller.pos.roomName, controller.reservation?.ticksToEnd || 0);
            }

            if ((controller.sign?.text || 'any') !== dokUtil.signText) {
                this.creepRef.signController(controller, dokUtil.signText);
            }
        }
    }

    protected GoToFlagRoom(flag : Flag) {
        if (this.creepRef.room.name !== flag.pos.roomName) {
            this.moveToObjectFar(flag.pos);

            return;
        }

        if (flag.name.includes('Colonize')) {
            this.ColonizeRoom(flag);
        }

        if (flag.name.includes('Reserve')) {
            this.ReserveRoom();
        }
    }

    protected GetLockCountForFlag(i: Flag) : number { 
        const locksPlaced = this.util.GetLocksWithoutMe({ id: `flag:${i.name}` }, this);

        return locksPlaced.length;
    };

    protected CreepGoColonize() {
        const flags = this.util.GetFlagArray();

        const homeRoom = this.util.GetDokRoom(this.memory.homeRoom);

        if (typeof homeRoom === 'undefined')
            return;

        const colonizeFlags = flags.filter(i => i.name.startsWith(this.memory.homeRoom + ' Colonize ') && this.GetLockCountForFlag(i) === 0);
        const reserveFlags = flags.filter(i => i.name.startsWith(this.memory.homeRoom + ' Reserve ') && this.GetLockCountForFlag(i) === 0).sort((a, b) => homeRoom.GetReserveCount(a.pos.roomName) - homeRoom.GetReserveCount(b.pos.roomName));

        const combinedFlags : Array<Flag> = colonizeFlags.concat(reserveFlags);

        if (this.focusedFlag !== null) {
            const focusedFlag = combinedFlags.find(i => i.name === this.focusedFlag);

            if (typeof focusedFlag !== 'undefined') {
                this.GoToFlagRoom(focusedFlag);

                return;
            }
        }

        if (colonizeFlags.length > 0) {
            this.focusedFlag = colonizeFlags[0].name;

            this.GoToFlagRoom(colonizeFlags[0]);

            this.util.PlaceLock({ id: `flag:${colonizeFlags[0].name}` }, this);

            return;
        }

        if (reserveFlags.length > 0) {
            this.focusedFlag = reserveFlags[0].name;

            this.GoToFlagRoom(reserveFlags[0]);

            this.util.PlaceLock({ id: `flag:${reserveFlags[0].name}` }, this);

            return;
        }

        this.RecycleCreep();
    }

    public DoCreepWork(): void {
        this.CreepGoColonize();
    }
}