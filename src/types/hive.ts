export interface HiveMemory {
    rooms: {
        [roomName: string]: {
            hostile: boolean;
            owner: string | null;

            lastScan: number;
            energySources: string[];

            energyProfitability: number,
            resourceType: string | null;
        }
    },
    scouts: {
        [creepName: string]: {
            assigned?: string;
        }
    },
    lastScan: number;
}