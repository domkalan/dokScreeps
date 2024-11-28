import { ConstructionType } from "../creeps/Builder";
import { Logger } from "../Logger";
import { Prefab } from "../Prefab";
import { RoomLimits } from "../RoomLimits";
import { dokRoom, dokRoomMemory, dokRoomType } from "./Room"

const roomLayout = {
    "name": "FortifiedRoom",
    "version": "1",
    "author": "dokman",
    "data": [
        {
            "structureType": "road",
            "x": 8,
            "y": 0
        },
        {
            "structureType": "road",
            "x": 7,
            "y": 0
        },
        {
            "structureType": "extension",
            "x": 6,
            "y": 2
        },
        {
            "structureType": "road",
            "x": 6,
            "y": 1
        },
        {
            "structureType": "tower",
            "x": 6,
            "y": 0
        },
        {
            "structureType": "road",
            "x": 6,
            "y": -1
        },
        {
            "structureType": "extension",
            "x": 6,
            "y": -2
        },
        {
            "structureType": "extension",
            "x": 5,
            "y": 3
        },
        {
            "structureType": "road",
            "x": 5,
            "y": 2
        },
        {
            "structureType": "extension",
            "x": 5,
            "y": 1
        },
        {
            "structureType": "road",
            "x": 5,
            "y": 0
        },
        {
            "structureType": "extension",
            "x": 5,
            "y": -1
        },
        {
            "structureType": "road",
            "x": 5,
            "y": -2
        },
        {
            "structureType": "extension",
            "x": 5,
            "y": -3
        },
        {
            "structureType": "extension",
            "x": 4,
            "y": 4
        },
        {
            "structureType": "road",
            "x": 4,
            "y": 3
        },
        {
            "structureType": "extension",
            "x": 4,
            "y": 2
        },
        {
            "structureType": "road",
            "x": 4,
            "y": 1
        },
        {
            "structureType": "extension",
            "x": 4,
            "y": 0
        },
        {
            "structureType": "road",
            "x": 4,
            "y": -1
        },
        {
            "structureType": "extension",
            "x": 4,
            "y": -2
        },
        {
            "structureType": "road",
            "x": 4,
            "y": -3
        },
        {
            "structureType": "extension",
            "x": 4,
            "y": -4
        },
        {
            "structureType": "extension",
            "x": 3,
            "y": 5
        },
        {
            "structureType": "road",
            "x": 3,
            "y": 4
        },
        {
            "structureType": "extension",
            "x": 3,
            "y": 3
        },
        {
            "structureType": "road",
            "x": 3,
            "y": 2
        },
        {
            "structureType": "extension",
            "x": 3,
            "y": 1
        },
        {
            "structureType": "extension",
            "x": 3,
            "y": 0
        },
        {
            "structureType": "extension",
            "x": 3,
            "y": -1
        },
        {
            "structureType": "road",
            "x": 3,
            "y": -2
        },
        {
            "structureType": "extension",
            "x": 3,
            "y": -3
        },
        {
            "structureType": "road",
            "x": 3,
            "y": -4
        },
        {
            "structureType": "extension",
            "x": 3,
            "y": -5
        },
        {
            "structureType": "extension",
            "x": 2,
            "y": 6
        },
        {
            "structureType": "road",
            "x": 2,
            "y": 5
        },
        {
            "structureType": "extension",
            "x": 2,
            "y": 4
        },
        {
            "structureType": "road",
            "x": 2,
            "y": 3
        },
        {
            "structureType": "spawn",
            "x": 2,
            "y": 2
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
            "structureType": "factory",
            "x": 2,
            "y": -2
        },
        {
            "structureType": "road",
            "x": 2,
            "y": -3
        },
        {
            "structureType": "extension",
            "x": 2,
            "y": -4
        },
        {
            "structureType": "road",
            "x": 2,
            "y": -5
        },
        {
            "structureType": "extension",
            "x": 2,
            "y": -6
        },
        {
            "structureType": "extension",
            "x": 1,
            "y": 7
        },
        {
            "structureType": "road",
            "x": 1,
            "y": 6
        },
        {
            "structureType": "extension",
            "x": 1,
            "y": 5
        },
        {
            "structureType": "road",
            "x": 1,
            "y": 4
        },
        {
            "structureType": "extension",
            "x": 1,
            "y": 3
        },
        {
            "structureType": "road",
            "x": 1,
            "y": 2
        },
        {
            "structureType": "tower",
            "x": 1,
            "y": 1
        },
        {
            "structureType": "road",
            "x": 1,
            "y": 0
        },
        {
            "structureType": "tower",
            "x": 1,
            "y": -1
        },
        {
            "structureType": "road",
            "x": 1,
            "y": -2
        },
        {
            "structureType": "observer",
            "x": 1,
            "y": -3
        },
        {
            "structureType": "road",
            "x": 1,
            "y": -4
        },
        {
            "structureType": "extension",
            "x": 1,
            "y": -5
        },
        {
            "structureType": "road",
            "x": 1,
            "y": -6
        },
        {
            "structureType": "extension",
            "x": 1,
            "y": -7
        },
        {
            "structureType": "road",
            "x": 0,
            "y": 8
        },
        {
            "structureType": "road",
            "x": 0,
            "y": 7
        },
        {
            "structureType": "extension",
            "x": 0,
            "y": 6
        },
        {
            "structureType": "road",
            "x": 0,
            "y": 5
        },
        {
            "structureType": "extension",
            "x": 0,
            "y": 4
        },
        {
            "structureType": "extension",
            "x": 0,
            "y": 3
        },
        {
            "structureType": "nuker",
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
            "structureType": "storage",
            "x": 0,
            "y": -2
        },
        {
            "structureType": "road",
            "x": 0,
            "y": -3
        },
        {
            "structureType": "link",
            "x": 0,
            "y": -4
        },
        {
            "structureType": "road",
            "x": 0,
            "y": -5
        },
        {
            "structureType": "extension",
            "x": 0,
            "y": -6
        },
        {
            "structureType": "road",
            "x": 0,
            "y": -7
        },
        {
            "structureType": "road",
            "x": 0,
            "y": -8
        },
        {
            "structureType": "extension",
            "x": -1,
            "y": 7
        },
        {
            "structureType": "road",
            "x": -1,
            "y": 6
        },
        {
            "structureType": "extension",
            "x": -1,
            "y": 5
        },
        {
            "structureType": "road",
            "x": -1,
            "y": 4
        },
        {
            "structureType": "extension",
            "x": -1,
            "y": 3
        },
        {
            "structureType": "road",
            "x": -1,
            "y": 2
        },
        {
            "structureType": "tower",
            "x": -1,
            "y": 1
        },
        {
            "structureType": "road",
            "x": -1,
            "y": 0
        },
        {
            "structureType": "tower",
            "x": -1,
            "y": -1
        },
        {
            "structureType": "road",
            "x": -1,
            "y": -2
        },
        {
            "structureType": "powerSpawn",
            "x": -1,
            "y": -3
        },
        {
            "structureType": "road",
            "x": -1,
            "y": -4
        },
        {
            "structureType": "extension",
            "x": -1,
            "y": -5
        },
        {
            "structureType": "road",
            "x": -1,
            "y": -6
        },
        {
            "structureType": "extension",
            "x": -1,
            "y": -7
        },
        {
            "structureType": "extension",
            "x": -2,
            "y": 6
        },
        {
            "structureType": "road",
            "x": -2,
            "y": 5
        },
        {
            "structureType": "extension",
            "x": -2,
            "y": 4
        },
        {
            "structureType": "road",
            "x": -2,
            "y": 3
        },
        {
            "structureType": "spawn",
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
            "structureType": "terminal",
            "x": -2,
            "y": -2
        },
        {
            "structureType": "road",
            "x": -2,
            "y": -3
        },
        {
            "structureType": "extension",
            "x": -2,
            "y": -4
        },
        {
            "structureType": "road",
            "x": -2,
            "y": -5
        },
        {
            "structureType": "extension",
            "x": -2,
            "y": -6
        },
        {
            "structureType": "extension",
            "x": -3,
            "y": 5
        },
        {
            "structureType": "road",
            "x": -3,
            "y": 4
        },
        {
            "structureType": "extension",
            "x": -3,
            "y": 3
        },
        {
            "structureType": "road",
            "x": -3,
            "y": 2
        },
        {
            "structureType": "extension",
            "x": -3,
            "y": 1
        },
        {
            "structureType": "extension",
            "x": -3,
            "y": 0
        },
        {
            "structureType": "extension",
            "x": -3,
            "y": -1
        },
        {
            "structureType": "road",
            "x": -3,
            "y": -2
        },
        {
            "structureType": "extension",
            "x": -3,
            "y": -3
        },
        {
            "structureType": "road",
            "x": -3,
            "y": -4
        },
        {
            "structureType": "extension",
            "x": -3,
            "y": -5
        },
        {
            "structureType": "extension",
            "x": -4,
            "y": 4
        },
        {
            "structureType": "road",
            "x": -4,
            "y": 3
        },
        {
            "structureType": "extension",
            "x": -4,
            "y": 2
        },
        {
            "structureType": "road",
            "x": -4,
            "y": 1
        },
        {
            "structureType": "extension",
            "x": -4,
            "y": 0
        },
        {
            "structureType": "road",
            "x": -4,
            "y": -1
        },
        {
            "structureType": "extension",
            "x": -4,
            "y": -2
        },
        {
            "structureType": "road",
            "x": -4,
            "y": -3
        },
        {
            "structureType": "extension",
            "x": -4,
            "y": -4
        },
        {
            "structureType": "extension",
            "x": -5,
            "y": 3
        },
        {
            "structureType": "road",
            "x": -5,
            "y": 2
        },
        {
            "structureType": "extension",
            "x": -5,
            "y": 1
        },
        {
            "structureType": "road",
            "x": -5,
            "y": 0
        },
        {
            "structureType": "extension",
            "x": -5,
            "y": -1
        },
        {
            "structureType": "road",
            "x": -5,
            "y": -2
        },
        {
            "structureType": "extension",
            "x": -5,
            "y": -3
        },
        {
            "structureType": "extension",
            "x": -6,
            "y": 2
        },
        {
            "structureType": "road",
            "x": -6,
            "y": 1
        },
        {
            "structureType": "tower",
            "x": -6,
            "y": 0
        },
        {
            "structureType": "road",
            "x": -6,
            "y": -1
        },
        {
            "structureType": "extension",
            "x": -6,
            "y": -2
        },
        {
            "structureType": "road",
            "x": -7,
            "y": 0
        },
        {
            "structureType": "road",
            "x": -8,
            "y": 0
        }
    ],
    "created": 1732774167,
    "updated": 1732774167
}

/**
 * dokFortifiedRoomA
 * A full featured room layout that with full base design, with fortification first.
 */
export class dokFortifiedRoom extends dokRoom {
    public override roomType: dokRoomType = dokRoomType.Fortified;

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