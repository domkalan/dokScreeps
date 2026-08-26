import { ConstructionPlanItem, ConstructionPlannerMemory } from '../types/construction';

export const EXTENSION_OFFSETS: Array<[number, number]> = [
    [-2, -2],
    [0, -2],
    [2, -2],

    [-2, 0],
    [2, 0],

    [-2, 2],
    [0, 2],
    [2, 2],

    [-3, -1],
    [-3, 1],
    [3, -1],
    [3, 1],

    [-1, -3],
    [1, -3],
    [-1, 3],
    [1, 3],
];

export const ROAD_OFFSETS: Array<[number, number]> = [
    [-1, -1],
    [0, -1],
    [1, -1],

    [-1, 0],
    [1, 0],

    [-1, 1],
    [0, 1],
    [1, 1],

    [-2, -1],
    [-2, 1],
    [2, -1],
    [2, 1],

    [-1, -2],
    [1, -2],
    [-1, 2],
    [1, 2],
];

export function createBasicRoomPlan(
    room: Room,
    knownSpawn?: StructureSpawn
): ConstructionPlanItem[] {
    const spawn = knownSpawn || room.find(FIND_MY_SPAWNS)[0];

    if (!spawn) {
        return [];
    }

    const plan: ConstructionPlanItem[] = [];

    let extensionPriority = 10;

    for (const [dx, dy] of EXTENSION_OFFSETS) {
        plan.push({
            x: spawn.pos.x + dx,
            y: spawn.pos.y + dy,
            structureType: STRUCTURE_EXTENSION,
            priority: extensionPriority++,
            minRcl: 2,
        });
    }

    let roadPriority = 100;

    for (const [dx, dy] of ROAD_OFFSETS) {
        plan.push({
            x: spawn.pos.x + dx,
            y: spawn.pos.y + dy,
            structureType: STRUCTURE_ROAD,
            priority: roadPriority++,
            minRcl: 2,
        });
    }

    // Early tower position.
    plan.push({
        x: spawn.pos.x,
        y: spawn.pos.y + 3,
        structureType: STRUCTURE_TOWER,
        priority: 30,
        minRcl: 3,
    });

    // Storage location.
    plan.push({
        x: spawn.pos.x,
        y: spawn.pos.y - 3,
        structureType: STRUCTURE_STORAGE,
        priority: 40,
        minRcl: 4,
    });

    const validPlan: ConstructionPlanItem[] = [];
    for (const item of plan) {
        if (item.x > 0 && item.x < 49 && item.y > 0 && item.y < 49) {
            validPlan.push(item);
        }
    }

    return validPlan;
}
