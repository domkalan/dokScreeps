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
    lastScan: number;
    scoutingRoom?: string;
}