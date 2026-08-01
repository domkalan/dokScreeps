import { HiveMemory } from 'types/hive';
import { ConstructionPlannerMemory } from './types/construction';

declare global {
    // Definition for the global console object
    const console: {
        log(...data: any[]): void;
        warn(...data: any[]): void;
        error(...data: any[]): void;
    };

    function debugLog(message: string): void;

    const global: any;

    // Definition for the require function
    function require(id: string): any;

    interface CreepMemory {
        role: string;
        room: string;
        taskId?: string;
        focusedOn?: string; // the id of the energy source the creep is currently going for, if any
        lastAction?: number; // the game time when the creep last performed a custom action   
        atLocation?: { x: number; y: number };
        atLocationFor?: number; // the game time when the creep arrived at the location
        inRoom?: string; // the name of the room the creep is currently in, if any

        _move?: any;
    }

    interface RoomMemory {
        type: 'home' | 'remote';

        // last time we scanned this room
        lastScan: number;

        // energy sources available in this room
        energySources: string[];
        remoteEnergySources?: { [sourceId: string]: { room: string; id: string } };

        // child rooms that are near this room
        childRooms?: string[];
        parentRoom?: string | null; // the name of the parent room, if any

        // the room's controller level, if any
        controllerLevel?: number;

        // tasks that this room is responsible for, keyed by task id
        tasks: { [taskId: string]: RoomTask };

        // the spawn queue for this room
        spawnQueue: {
            role: string;
            priority: number;
        }[];

        // the room's construction planner memory, if any
        constructionPlanner?: ConstructionPlannerMemory;

        // whether the room is in defense mode, and if so, when it was activated
        defenseMode: boolean;
        defenseModeActivatedAt?: number;
    }

    interface RoomTask {
        id: string;
        type: string;
        completed: boolean;
        assigned?: string; // the name of the creep assigned to this task, if any
        priority: number;

        targetId: string;
        roomId: string;
        action?: string; // optional action to perform, e.g., for hauler tasks, this could be the room name to haul to
        resourceType?: ResourceConstant; // optional resource type for tasks that involve resources, e.g., for hauler tasks

        created: number;
        expires: number;
    }

    interface Memory {
        creeps: { [creepName: string]: CreepMemory };
        rooms: { [roomName: string]: RoomMemory };
        counter: { [key: string]: number };
        hive: HiveMemory;

        debugMode: boolean;
    }
}

export { };