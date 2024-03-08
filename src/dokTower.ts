import dokRoom from "./dokRoom";
import dokUtil from "./dokUtil";

export default class dokTower {
    private util: dokUtil;
    private room: dokRoom;
    private towerRef: StructureTower;

    constructor(util: dokUtil, room: dokRoom, tower: StructureTower) {
        this.util = util;
        this.room = room;
        this.towerRef = tower;
    }

    public RelinkRef(tower: StructureTower) {
        this.towerRef = tower;
    }

    public GetId() {
        return this.towerRef.id;
    }

    public BlastHostiles() {
        const hostiles = this.util.FindCached<Creep>(this.towerRef.room, FIND_HOSTILE_CREEPS);
        const hostilePower = this.util.FindCached<PowerCreep>(this.towerRef.room, FIND_HOSTILE_POWER_CREEPS);

        const hostilesHere : Array<Creep | PowerCreep> = hostilePower.concat(hostiles as any).sort((a, b) => b.hits - a.hits);

        if (hostilesHere.length > 0) {
            this.towerRef.attack(hostilesHere[0]);

            new RoomVisual(this.towerRef.room.name).text('💣', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });

            return true;
        }

        return false;
    }

    public RepairStructures() {
        if (this.towerRef.store.energy < this.towerRef.store.getCapacity('energy') * 0.75) {
            new RoomVisual(this.towerRef.room.name).text('🔋', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });

            return true;
        }

        const structuresBasic = this.util.FindCached<Structure>(this.towerRef.room, FIND_MY_STRUCTURES).filter(i => i.hits < i.hitsMax);
        const structuresExtra = this.util.FindCached<Structure>(this.towerRef.room, FIND_STRUCTURES).filter(i => i.hits < i.hitsMax && ['road', 'container', 'link', 'storage'].includes(i.structureType))

        const structures: Array<Structure> = structuresBasic.concat(structuresExtra).sort((a, b) => a.hits/a.hitsMax - b.hits/b.hitsMax);

        if (structures.length == 0) {
            return false;
        }

        this.towerRef.repair(structures[0]);

        new RoomVisual(this.towerRef.room.name).text('🔨', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });

        return true;
    }

    public Tick() {
        if (this.BlastHostiles()) {
            return;
        }

        if (this.RepairStructures()) {
            return;
        }

        new RoomVisual(this.towerRef.room.name).text('⌛', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });
    }
}