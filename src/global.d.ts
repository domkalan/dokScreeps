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
        atLocation?: { x: number; y: number };
        atLocationFor?: number; // the game time when the creep arrived at the location
        inRoom?: string; // the name of the room the creep is currently in, if any

        _move?: any;
    }

    interface RoomMemory {
        lastScan: number;
        energySources: string[];
        remoteEnergySources?: { [sourceId: string]: { room: string; id: string } };

        controllerLevel?: number;

        tasks: { [taskId: string]: RoomTask };

        spawnQueue: {
            role: string;
            priority: number;
        }[];

        constructionPlanner?: ConstructionPlannerMemory;

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