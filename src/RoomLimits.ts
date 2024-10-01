export interface CurrentRoomLimits {
    roads: number;
    containers: number;
    spawns: number;
    extensions: number;
    ramparts: number;
    walls: number;
    towers: number;
    storage: number;
    links: number;
    extractor: number;
    labs: number;
    terminal: number;
    factory: number;
    observer: number;
    powerspawn: number;
    nuker: number;
}


export class RoomLimits {
    public static getRclLimits(rcl: number) {
        const roomLimits: CurrentRoomLimits = {
            roads: 0,
            containers: 0,
            spawns: 0,
            extensions: 0,
            ramparts: 0,
            walls: 0,
            towers: 0,
            storage: 0,
            links: 0,
            extractor: 0,
            labs: 0,
            terminal: 0,
            factory: 0,
            observer: 0,
            powerspawn: 0,
            nuker: 0
        };
    
        if (rcl >= 0) {
            roomLimits.roads = Infinity;
            roomLimits.containers = 5;
        }
    
        if (rcl >= 1) {
            roomLimits.spawns = 1;
        }
    
        if (rcl >= 2) {
            roomLimits.extensions = 5;
            roomLimits.ramparts = Infinity;
            roomLimits.walls = Infinity;
        }
    
        if (rcl >= 3) {
            roomLimits.extensions = 10;
            roomLimits.towers = 1;
        }
    
        if (rcl >= 4) {
            roomLimits.extensions = 20;
            roomLimits.storage = 1;
        }
    
        if (rcl >= 5) {
            roomLimits.extensions = 30;
            roomLimits.towers = 2;
            roomLimits.links = 2;
        }
    
        if (rcl >= 6) {
            roomLimits.extensions = 40;
            roomLimits.links = 3;
            roomLimits.labs = 3;
            roomLimits.terminal = 1;
        }
    
        if (rcl >= 7) {
            roomLimits.extensions = 50;
            roomLimits.spawns = 2;
            roomLimits.towers = 3;
            roomLimits.links = 4;
            roomLimits.extractor = 1;
            roomLimits.labs = 6;
            roomLimits.factory = 1;
        }
    
        if (rcl >= 8) {
            roomLimits.extensions = 60;
            roomLimits.spawns = 3;
            roomLimits.towers = 6;
            roomLimits.links = 6;
            roomLimits.labs = 10;
            roomLimits.observer = 1;
            roomLimits.powerspawn = 1;
            roomLimits.nuker = 1;
        }
    
        return roomLimits;
    }
}