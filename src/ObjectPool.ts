export type GameObject = RoomObject | null;

export abstract class ObjectPool {
    private static pool: {[ key: string ] : GameObject}

    public static getObjectById(id : string) : GameObject {
        if (typeof this.pool[id] !== 'undefined') {
            return this.pool[id];
        }

        const object = Game.getObjectById(id) as Structure;

        if (object === null)
            return null;

        this.pool[id] = object;

        return object;
    }

    public static resetPool() {
        this.pool = {};
    }
}