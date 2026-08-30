export interface HiveExpansionPlan {
    portals: [string, string, string][];
    target: { shard: string, room: string };
    phase: 'settle' | 'build';
    spawned: { [creepName: string]: { role: string, spawnedAt: number } };
}

export interface HiveIntershardData {
    lastUpdated: number;

    // generic kv store for intershard data, can be used for anything
    kv?: { [key: string]: any };

    // allow creeps the ability to track portals they have jumped
    portalsJumped?: { [creepName: string]: string[] };

    // expansion plans for the hive, keyed by target shard and room
    expansionPlan?: HiveExpansionPlan;
}

export interface HiveMemory {
    rooms: {
        [roomName: string]: {
            name: string;
            shard: string;
            owner: string | null;
            hostile: boolean;
            lastScan: number;
            highway: boolean;

            inaccessible?: boolean;
        }
    },
    tasks: {
        [taskId: string]: {
            type: string;
            roomId: string;
            shardId: string;
            targetId: string;
            resourceType?: ResourceConstant;
            priority: number;
            expires: number;
            assigned: string | null;
            completed: boolean;
            kv?: any;
        }
    },
    interShard: HiveIntershardData;
    lastScan: number;
    scoutingRoom?: string;
}