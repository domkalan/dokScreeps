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

    interface Creep {
        travelTo(target: RoomPosition | { pos: RoomPosition } | { x: number; y: number; roomName: string }, options?: TravelToOptions): TravelToReturnData;
    }

    interface CreepMemory {
        role: string;
        room: string;

        // track the task that this creep is currently assigned to, if any
        taskId?: string;
        // track when the task was started, if any
        taskStarted?: number;
        // previous tasks that this creep has completed, if any
        completedTasks?: number;

        // allow the creep to focus on a specific item
        focusedOn?: string;

        // allow the creep to note what room it is currently in, if any
        inRoom?: string;

        // last known health of the creep
        lastHealth?: number;
        // allow the creep to know if its in danger
        lastDamageTime?: number;
        // allow the creep to know when it was last in danger
        inDanger?: boolean;

        // allow the creep to store arbitrary key-value pairs
        kv?: { [key: string]: any };

        _trav?: any;
        _move?: any;
        _cFlag?: number;
    }

    interface RoomMemory {
        // Traveler reads this flag while planning inter-room routes. It is
        // maintained by the hive scout whenever the room is scanned.
        avoid?: boolean;

        type: 'home' | 'remote';

        // last time we scanned this room
        lastScan: number;

        // energy sources available in this room
        energySources: string[];
        // whether the room has met the energy threshold for spawning harvesters
        energyThresholdMet?: boolean;
        // allow an override to continue spawning harvesters even if the energy threshold is met
        energyThresholdOverride?: boolean;
        // track remote energy sources that are in other rooms, keyed by source id
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

        // storage link
        storageLink?: string;
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

        controllerSign?: string;

        // allow the user to enable or disable debug mode for the bot
        debugDisplay: string | undefined; // what room the debug display will show in
        cacheMode: boolean; // whether cache mode is enabled or not
        perfMode: boolean; // whether performance tracking mode is enabled or not
    }
}

export { };
