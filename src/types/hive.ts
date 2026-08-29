export interface HiveColonizePlan {
    portals: [string, string, string][]; // array of tuples, each containing a shard id, room id, and portal id
    targetShard: string;
    targetRoom: string;
    owningShard: string;
    owningRoom: string;
    phase: 'planning' | 'colonize' | 'bootstrap' | 'defend' | 'finished';
    creepsSpawned: { [creepName: string]: number }; // map of creep names to the game time they were spawned
}

export interface HiveIntershardData {
    lastUpdated: number;
    kv?: { [key: string]: any };
    colonizePlan?: HiveColonizePlan;
    portalsJumped?: { [creepName: string]: string[] }; // map of creep names to an array of portal ids they have jumped through
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