import { ConstructionType } from "../creeps/Builder";
import { Logger } from "../Logger";
import { Prefab } from "../Prefab";
import { RoomLimits } from "../RoomLimits";
import { dokRoom, dokRoomMemory, dokRoomType } from "./Room"

const roomLayout = {
    "name": "MinimalSetup",
    "version": "1",
    "auhtor": "dokman",
    "data": [
        {
            "structureType": "road",
            "x": 3,
            "y": 0
        },
        {
            "structureType": "road",
            "x": 2,
            "y": 1
        },
        {
            "structureType": "extension",
            "x": 2,
            "y": 0
        },
        {
            "structureType": "road",
            "x": 2,
            "y": -1
        },
        {
            "structureType": "road",
            "x": 1,
            "y": 2
        },
        {
            "structureType": "extension",
            "x": 1,
            "y": 1
        },
        {
            "structureType": "road",
            "x": 1,
            "y": 0
        },
        {
            "structureType": "extension",
            "x": 1,
            "y": -1
        },
        {
            "structureType": "road",
            "x": 1,
            "y": -2
        },
        {
            "structureType": "road",
            "x": 0,
            "y": 3
        },
        {
            "structureType": "tower",
            "x": 0,
            "y": 2
        },
        {
            "structureType": "road",
            "x": 0,
            "y": 1
        },
        {
            "structureType": "spawn",
            "x": 0,
            "y": 0
        },
        {
            "structureType": "road",
            "x": 0,
            "y": -1
        },
        {
            "structureType": "tower",
            "x": 0,
            "y": -2
        },
        {
            "structureType": "road",
            "x": 0,
            "y": -3
        },
        {
            "structureType": "road",
            "x": -1,
            "y": 3
        },
        {
            "structureType": "road",
            "x": -1,
            "y": 2
        },
        {
            "structureType": "extension",
            "x": -1,
            "y": 1
        },
        {
            "structureType": "road",
            "x": -1,
            "y": 0
        },
        {
            "structureType": "extension",
            "x": -1,
            "y": -1
        },
        {
            "structureType": "road",
            "x": -1,
            "y": -2
        },
        {
            "structureType": "road",
            "x": -2,
            "y": 3
        },
        {
            "structureType": "terminal",
            "x": -2,
            "y": 2
        },
        {
            "structureType": "road",
            "x": -2,
            "y": 1
        },
        {
            "structureType": "extension",
            "x": -2,
            "y": 0
        },
        {
            "structureType": "road",
            "x": -2,
            "y": -1
        },
        {
            "structureType": "road",
            "x": -3,
            "y": 2
        },
        {
            "structureType": "storage",
            "x": -3,
            "y": 1
        },
        {
            "structureType": "road",
            "x": -3,
            "y": 0
        },
        {
            "structureType": "link",
            "x": -3,
            "y": -1
        },
        {
            "structureType": "road",
            "x": -3,
            "y": -2
        },
        {
            "structureType": "road",
            "x": -4,
            "y": 1
        },
        {
            "structureType": "road",
            "x": -4,
            "y": -1
        }
    ],
    "created": 1732774721,
    "updated": 1732774721
}

/**
 * dokJumperRoom
 * A lightweight room used for portal jumping and claim jumping.
 * 
 * Defense is light, extensions are light as this room is now intended to be a long term strategic base.
 */
export class dokJumperRoom extends dokRoom {
    public  override readonly roomType: dokRoomType = dokRoomType.Jumper;

    public DoConstructionPlanning(rcl : number | undefined): Array<{ type: StructureConstant, pos: RoomPosition }>  {
        Logger.Warn(`${this.name}:ConstructionPlanning`, 'Running room construction planning, expect very high CPU usage!');

        const structures = this.dokScreepsRef.GetStructuresByRoom(this.name);
        const limits = RoomLimits.getRclLimits(rcl || 1);

        const spawn = structures.find(i => i.structureType === 'spawn');

        if (typeof spawn === 'undefined') {
            // TODO
            return [];
        }

        const adaptedPlan = Prefab.RecenterPrefabAround(spawn.pos, roomLayout.data);

        const extensions = structures.filter(i => i.structureType === 'extension');
        const allotedExtensions = adaptedPlan.filter(i => i.type === 'extension');

        const terrainMask = this.roomRef.getTerrain();

        if (extensions.length < limits.extensions && extensions.length < allotedExtensions.length) {
            return Prefab.FilterOutBuilt(allotedExtensions, structures, terrainMask);
        }

        const towers = structures.filter(i => i.structureType === 'tower');
        const allotedTowers = adaptedPlan.filter(i => i.type === 'tower');

        if (towers.length < limits.towers && towers.length < allotedTowers.length) {
            return Prefab.FilterOutBuilt(allotedTowers, structures, terrainMask);
        }

        return [];
    }

    public override DoConstructionTick(): void {
        Logger.Warn(`${this.name}:ConstructionPlanning`, 'Running construction processing tick, CPU may spike!');

        const roomMemory = (Memory.rooms[this.name] as dokRoomMemory);

        const constructionProjects = roomMemory.constructionQueue.filter(i => i.constructionType === ConstructionType.Build);

        if (constructionProjects.length <= 0) {
            const projects = this.DoConstructionPlanning(this.roomRef.controller?.level || 1);

            if (projects.length > 0) {
                this.roomRef.createConstructionSite(projects[0].pos, projects[0].type);
            }
        }
    }
}