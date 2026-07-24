import { HiveMemory } from 'types/hive';
import { ConstructionPlannerMemory } from './types/construction';

declare global {
    // Definition for the global console object
    const console: {
        log(...data: any[]): void;
        warn(...data: any[]): void;
        error(...data: any[]): void;
    };

    // Definition for the require function
    function require(id: string): any;

    interface CreepMemory {
        role: string;
        room: string;
        taskId?: string;
        goingFor?: string; // the id of the energy source the creep is currently going for, if any
    }

    interface RoomMemory {
        lastScan: number;
        energySources: string[];
        remoteEnergySources?: { room: string; id: string }[];

        controllerLevel?: number;

        tasks: { [taskId: string]: RoomTask };

        spawnQueue: {
            role: string;
            priority: number;
        }[];

        constructionPlanner?: ConstructionPlannerMemory;
    }

    interface RoomTask {
        id: string;
        assigned: string;
        type: string;
        targetId: string;
        priority: number;
        room?: string;
    }

    interface Memory {
        creeps: { [creepName: string]: CreepMemory };
        rooms: { [roomName: string]: RoomMemory };
        counter: { [key: string]: number };
        hive: HiveMemory;
    }
}

export {};