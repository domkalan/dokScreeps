import dokRoom from "../dokRoom";
import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepColonizer extends dokCreep {
    private home: dokRoom | null = null;
    private homeMessage : boolean = false;

    constructor(util: dokUtil, creep: Creep) {
        super(util, creep);
    }

    public ColonizeRoom() {
        const structuresHere = this.creepRef.room.find(FIND_STRUCTURES);
        const sourcesHere = this.creepRef.room.find(FIND_SOURCES_ACTIVE);

        const controller = structuresHere.find(i => i.structureType === 'controller') as StructureController;

        if (typeof controller === 'undefined') {
            this.creepRef.say('Controller?')

            return;
        }

        if (controller.owner == null || controller.owner.username !== 'dokman') {
            if (this.creepRef.claimController(controller) === ERR_NOT_IN_RANGE) {
                this.moveToObject(controller);
            }

            return;
        }

        if (!this.homeMessage) {
            this.homeMessage = true;

            this.creepRef.say(`🎉🏠🎉`, true);

            if (this.home !== null)
                this.home.NotifyColonizeRoomTaken();
        }

        const spanwer = structuresHere.find(i => i.structureType === 'spawn') as StructureSpawn;
        const spanwerConstruction = this.creepRef.room.find(FIND_MY_CONSTRUCTION_SITES).find(i => i.structureType === 'spawn');

        if (typeof spanwer === 'undefined' && typeof spanwerConstruction === 'undefined') {
            this.creepRef.say('Build', false);

            const buildableAreas = dokUtil.GetFreeSlots(this.creepRef.room, { pos: new RoomPosition(25, 25, this.creepRef.room.name) }, 5, 2);

            const placeableArea = buildableAreas.filter((plotScan) => {
                if (plotScan.code === 0) {
                    new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#000000', opacity: 0.1 });

                    return false;
                }

                new RoomVisual(this.creepRef.room.name).circle(plotScan.pos.x, plotScan.pos.y, { fill: '#ff4f00' });

                return true;
            });

            const spawnerName = this.util.GetNextSpawnerName();

            this.creepRef.room.createConstructionSite(placeableArea[0].pos.x, placeableArea[0].pos.y, 'spawn', spawnerName);

            return;
        }

        if (typeof spanwerConstruction !== 'undefined') {
            if (this.memory.task === dokCreepTask.Gather) {
                if (this.creepRef.harvest(sourcesHere[0]) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(sourcesHere[0]);
                }

                if (this.creepRef.store.getFreeCapacity('energy') <= 0) {
                    this.memory.task = dokCreepTask.Depost;
                }

                return;
            } else if (this.memory.task === dokCreepTask.Depost) {
                if (controller.ticksToDowngrade <= 5000) {
                    if (this.creepRef.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                        this.moveToObject(controller);
                    }
                    
                    if (this.creepRef.store.energy <= 0) {
                        this.memory.task = dokCreepTask.Gather;
                    }

                    return;
                }

                if (this.creepRef.build(spanwerConstruction) === ERR_NOT_IN_RANGE) {
                    this.moveToObject(spanwerConstruction);
                }
                
                if (this.creepRef.store.energy <= 0) {
                    this.memory.task = dokCreepTask.Gather;
                }

                return;
            }
        }

        if (typeof spanwer !== 'undefined' && this.home !== null) {
            this.creepRef.say(`🏁`);

            this.home.ClearColonizeRoom();

            this.util.ClearExpandGoal();

            this.util.AddRoom(this.creepRef.room);

            this.creepRef.suicide();
        }
    }

    public DoCreepWork(): void {
        if (this.home === null) {
            const homeRef = this.util.GetDokRoom(this.memory.homeRoom);

            if (typeof homeRef === 'undefined')
                return;

            this.home = homeRef;
        }

        const colonizeRoom = this.home.GetColonizeRoom();

        if (typeof colonizeRoom === 'undefined' || colonizeRoom === null) {
            this.creepRef.suicide();

            return;
        }

        if (this.creepRef.room.name !== colonizeRoom) {
            this.moveToObjectFar(new RoomPosition(25, 25, colonizeRoom));

            return;
        }

        this.ColonizeRoom();
    }
}