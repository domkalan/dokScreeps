import dokRoom from "./dokRoom";
import dokUtil from "./dokUtil";

export default class dokTower {
    private util: dokUtil;
    private room: dokRoom;
    private towerRef: StructureTower;

    private towerEnergyHold: boolean = true;

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
        const hostiles = this.util.FindResource<Creep>(this.towerRef.room, FIND_HOSTILE_CREEPS, 0);
        const hostilePower = this.util.FindResource<PowerCreep>(this.towerRef.room, FIND_HOSTILE_POWER_CREEPS, 0);

        const hostilesHere : Array<Creep | PowerCreep> = hostilePower.concat(hostiles as any).sort((a, b) => b.hits - a.hits);

        if (hostilesHere.length > 0) {
            this.towerRef.attack(hostilesHere[0]);

            new RoomVisual(this.towerRef.room.name).text('💣', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });

            return true;
        }

        return false;
    }

    public RepairStructures() {
        if (this.towerRef.store.energy < this.towerRef.store.getCapacity('energy') * 0.50) {
            this.towerEnergyHold = true;

            return true;
        }

        const structuresBasic = this.util.FindResource<Structure>(this.towerRef.room, FIND_MY_STRUCTURES, 0)
        const structuresExtra = this.util.FindResource<Structure>(this.towerRef.room, FIND_STRUCTURES, 0).filter(i => ['road', 'container', 'link', 'storage', 'extension', 'constructedWall'].includes(i.structureType))

        const structures: Array<Structure> = structuresBasic.concat(structuresExtra).filter(i => i.hits < i.hitsMax).sort((a, b) => a.hits/a.hitsMax - b.hits/b.hitsMax);

        const importantStructures = structures.filter(i => !['rampart', 'constructedWall'].includes(i.structureType));

        const extensions = structuresExtra.filter(i => i.structureType === 'extension') as StructureExtension[];
        const extensionsEmpty = extensions.filter(i => i.store.energy < 50);

        // if half of all extensions are empty, we need to save energy
        if (extensionsEmpty.length > extensions.length * 0.5) {
            new RoomVisual(this.towerRef.room.name).text('😰⚡', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });

            return true;
        }

        // patch to consume less energy
        const structuresFiltered = structures.filter(i => {
            // dont focus on ramparts with 35% or more health
            if (i.structureType === 'rampart' && i.hits > i.hitsMax * 0.2) {
                return false;
            }

            if (i.structureType === 'constructedWall' && i.hits > i.hitsMax * 0.2) {
                return false;
            }

            // all rest can pass
            return true;
        });

        if (importantStructures.length > 0) {
            if(this.towerRef.repair(importantStructures[0]) === OK) {
                new RoomVisual(this.towerRef.room.name).text('⚠️🔨', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });

                return true;
            }
        }

        if (structuresFiltered.length > 0) {
            if (this.towerRef.repair(structuresFiltered[0]) === OK) {          
                new RoomVisual(this.towerRef.room.name).text('☢️🔨', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });

                return true;
            }
        }

        return false;
    }

    public Tick() {
        if (this.BlastHostiles()) {
            return;
        }

        if (this.towerEnergyHold) {
            if (this.towerRef.store.getFreeCapacity('energy') <= 0) {
                this.towerEnergyHold = false;
            } else {
                new RoomVisual(this.towerRef.room.name).text('🔒🔋', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });

                return;
            }
        }

        if (this.RepairStructures()) {
            return;
        }

        new RoomVisual(this.towerRef.room.name).text('⌛', this.towerRef.pos.x, this.towerRef.pos.y + 1.45, { align: 'center' });
    }
}