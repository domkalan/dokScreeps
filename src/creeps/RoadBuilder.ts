import dokUtil from "../dokUtil";
import dokCreep, { dokCreepTask } from "./Base";

export default class dokCreepRoadBuilder extends dokCreep {
    private focusedOn: string | null = null;
    private noRoomWorkAt: number = 0;
    private noTowerWorkAt: number = 0;

    private DepositIntoTower() {
        const towers = this.util.FindCached<StructureTower>(this.creepRef.room, FIND_MY_STRUCTURES).filter(i => i.structureType === 'tower' && i.store.getFreeCapacity('energy') > 0).sort((a, b) => a.store.energy - b.store.energy);

        if (towers.length === 0) {
            this.creepRef.say('No towers!');

            this.noTowerWorkAt = this.util.GetTickCount();

            return;
        }
         
        if (this.creepRef.transfer(towers[0], 'energy') === ERR_NOT_IN_RANGE) {
            this.moveToObject(towers[0]);
        }

        this.CheckIfDepositEmpty();
    }

    private BuildNextRoad() {
        const roomObject = this.util.GetDokRoom(this.creepRef.room.name);

        if (!roomObject) {
            this.creepRef.say('Not my room!', false);

            return;
        }

        const spawns = this.util.FindCached<StructureSpawn>(this.creepRef.room, FIND_MY_SPAWNS).filter(i => i.structureType === 'spawn');

        if (spawns.length === 0) {
            this.creepRef.say('No spawns!', false);

            return;
        }

        const spawn = spawns[0];

        const roadsPlan = roomObject.GetRoadsPlan().filter(i => {
            const constructionHere = i.findInRange(FIND_CONSTRUCTION_SITES, 0);
            const structureHere = i.findInRange(FIND_STRUCTURES, 0);

            if (constructionHere.length > 0 || structureHere.length > 0)
                return false;

            return true;
        }).sort((a, b) => dokUtil.getDistance(a, spawn.pos) - dokUtil.getDistance(b, spawn.pos));

        if (roadsPlan.length === 0) {
            this.creepRef.say('No roads!', false);

            this.noRoomWorkAt = this.util.GetTickCount();

            return;
        }

        roadsPlan.forEach(i => {
            new RoomVisual(i.roomName).circle(i, { fill: '#4A6DE5' })
        })

        if (this.creepRef.pos.getRangeTo(roadsPlan[0]) > 1) {
            this.moveToObject(roadsPlan[0]);
        } else {
            this.creepRef.room.createConstructionSite(roadsPlan[0], 'road');
        }
    }

    private DoRoadMaintenance(road: StructureRoad) {
        if (this.creepRef.repair(road) === ERR_NOT_IN_RANGE) {
            this.moveToObject(road);
        }

        this.CheckIfDepositEmpty();
    }

    private DoRoadBuild(roadBuild : ConstructionSite) {
        if (this.creepRef.build(roadBuild) === ERR_NOT_IN_RANGE) {
            this.moveToObject(roadBuild);
        }

        this.CheckIfDepositEmpty();
    }

    private DoRoadBuilderDeposit() {
        // are we focused on repairing a road?
        if (this.focusedOn !== null) {
            const damagedRoad = this.util.FindCached<StructureRoad>(this.creepRef.room, FIND_STRUCTURES).find(i => i.id === this.focusedOn)

            if (typeof damagedRoad !== 'undefined' && damagedRoad.hits <= damagedRoad.hitsMax * 0.5) {
                this.DoRoadMaintenance(damagedRoad);

                return;
            }
        }

        // check for road constructions
        const roadConstruction = this.util.FindCached<ConstructionSite>(this.creepRef.room, FIND_MY_CONSTRUCTION_SITES).filter(i => i.structureType === 'road');

        if (roadConstruction.length > 0) {
            this.DoRoadBuild(roadConstruction[0]);

            return;
        }

        // check for damaged roads
        const damagedRoads = this.util.FindCached<StructureRoad>(this.creepRef.room, FIND_STRUCTURES).filter(i => i.structureType === 'road' && i.hits <= i.hitsMax * 0.15).sort((a, b) => b.hits - a.hits);

        if (damagedRoads.length > 0) {
            this.focusedOn = damagedRoads[0].id;

            this.DoRoadMaintenance(damagedRoads[0]);

            return;
        }

        const currentTick = this.util.GetTickCount()

        if (currentTick- this.noRoomWorkAt > 20) {
            this.BuildNextRoad();

            return;
        }

        if (currentTick- this.noTowerWorkAt > 20) {
            this.DepositIntoTower();

            return;
        }

        this.DoBasicDeposit();
    }

    public DoCreepWork() {
        switch(this.memory.task) {
            case dokCreepTask.Gather:
                super.DoBasicGather();

                break;
            case dokCreepTask.Depost:
                this.DoRoadBuilderDeposit();

                break;
            default:
                break;
        }
    }
}