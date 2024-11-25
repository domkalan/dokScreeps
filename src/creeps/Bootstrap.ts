import { dokCreep, dokCreepMemory } from "./Creep";

export interface dokBootstrapCreepMemory extends dokCreepMemory {
    focusedTask: number
}

export class dokBootstrapCreep extends dokCreep {
    private focusedSource: string | null = null;
    private focusedSpawn: string | null = null;
    private focusedSpawnConstruct: string | null = null;

    public GatherSource() {
        // once we have a hauler, we are no longer needed
        const creeps = this.dokScreepsRef.GetCreepsByRoom(this.fromRoom);
        const haulerCreeps = creeps.filter(i => i.name.startsWith('hauler'))
        const energyMinerCreeps = creeps.filter(i => i.name.startsWith('energyminer'))
        const servantCreeps = creeps.filter(i => i.name.startsWith('servant'))

        if (haulerCreeps.length > 0 && energyMinerCreeps.length > 0 && servantCreeps.length > 0) {
            this.creepRef.suicide();

            return;
        }

        if (this.focusedSource === null) {
            const homeRoom = this.dokScreepsRef.GetRoomReference(this.fromRoom);

            if (typeof homeRoom === 'undefined') {
                return;
            }

            const sourcesHere = homeRoom.roomRef.find(FIND_SOURCES_ACTIVE);

            this.focusedSource = sourcesHere[0].id;

            return;
        }
        
        const targetedSource = Game.getObjectById(this.focusedSource) as Source;

        if (targetedSource === null) {
            return;
        }

        const harvestCode = this.creepRef.harvest(targetedSource);

        if (harvestCode == -9) {
            this.MoveTo(targetedSource)

            return;
        }

        if (this.creepRef.store.getFreeCapacity() <= 0) {
            (this.creepRef.memory as any).focusedTask = 1;

            this.focusedSource = null;
        }
    }

    public DepositIntoSpawn() {
        const roomStructures = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom);

        // check to make sure that the controller is not in danger
        const roomController = roomStructures.find(i => i.structureType === 'controller') as StructureController | undefined;

        if (typeof roomController !== 'undefined' && roomController.ticksToDowngrade < 5000) {
            (this.creepRef.memory as any).focusedTask = 2;

            return;
        }

        if (this.focusedSpawn === null) {
            const spawns = roomStructures.filter(i => i.structureType === 'spawn') as StructureSpawn[];
            const emptySpawns = spawns.filter(i => i.store.energy < i.store.getCapacity('energy'));

            if (emptySpawns.length === 0) {
                this.DepositIntoExtensions();

                return;
            }

            this.focusedSpawn = emptySpawns[0].id;
        }

        if (this.focusedSpawn === null) {
            return;
        }

        const spawnObject = roomStructures.find(i => i.id === this.focusedSpawn) as StructureSpawn;

        if (typeof spawnObject === 'undefined') {
            return;
        }

        if (spawnObject.store.energy >= spawnObject.store.getCapacity('energy')) {
            this.focusedSpawn = null;

            return;
        }

        const transferCode = this.creepRef.transfer(spawnObject, 'energy');

        if (transferCode == -9) {
            this.MoveTo(spawnObject);

            return;
        } else if (transferCode === -6) {
            (this.creepRef.memory as any).focusedTask = 0;

            this.focusedSpawn = null;
        }
    }

    public DepositIntoExtensions() {
        const roomStructures = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom);

        const extensions = roomStructures.filter(i => i.structureType === 'extension') as StructureExtension[];
        const extensionEmpty = extensions.filter(i => i.store.getFreeCapacity('energy') > 0);

        if (extensionEmpty.length === 0) {
            (this.creepRef.memory as any).focusedTask = 3;

            return;
        }
        
        const transferCode = this.creepRef.transfer(extensionEmpty[0], 'energy');

        if (transferCode === -9) {
            this.MoveTo(extensionEmpty[0]);
        } else if (transferCode === -6) {
            (this.creepRef.memory as any).focusedTask = 0;
        }
    }

    public DepositIntoController() {
        const roomStructures = this.dokScreepsRef.GetStructuresByRoom(this.fromRoom);
        const controllerObject = roomStructures.find(i => i.structureType === 'controller') as StructureController | undefined;

        if (typeof controllerObject === 'undefined') {
            return;
        }

        const upgradeCode = this.creepRef.upgradeController(controllerObject);

        if (upgradeCode == -9) {
            this.MoveTo(controllerObject);

            return;
        }

        if (this.creepRef.store.getUsedCapacity('energy') <= 0) {
            (this.creepRef.memory as any).focusedTask = 0;
        }
    }

    private ConstructSpawn() {
        if (this.focusedSpawnConstruct === null) {
            const constructionSites = this.GetRoomRefSafe().roomRef.find(FIND_CONSTRUCTION_SITES);
            const spawnConstruction = constructionSites.find(i => i.structureType === 'spawn');

            if (typeof spawnConstruction === 'undefined') {
                (this.creepRef.memory as any).focusedTask = 2;

                return;
            }

            this.focusedSpawnConstruct = spawnConstruction.id;
        }

        const spawnConstruction = Game.getObjectById(this.focusedSpawnConstruct) as ConstructionSite;

        if (spawnConstruction === null) {
            (this.creepRef.memory as any).focusedTask = 0;
            this.focusedSpawnConstruct = null;

            return;
        }

        const buildCode = this.creepRef.build(spawnConstruction);

        if (buildCode === -9) {
            this.MoveTo(spawnConstruction);
        } else if (buildCode === -6) {
            (this.creepRef.memory as any).focusedTask = 0;
        }
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        switch((this.creepRef.memory as any).focusedTask) {
            case 0:
                this.GatherSource();

                break;
            case 1:
                this.DepositIntoSpawn();

                break;
            case 2:
                this.DepositIntoController();

                break;
            case 3:
                this.ConstructSpawn();

                break;
            default:
                break;
        }
        
        return false;
    }

    public static buildBody: BodyPartConstant[] = [ MOVE, CARRY, WORK ];
    public static buildName: string = 'bootstrap';

    public static BuildInitialMemory(memParams: dokCreepMemory): dokBootstrapCreepMemory {
        return {
            focusedTask: 0,
            ...memParams
        }
    }

    public static BuildBodyStack(rcl: number, energy: number): BodyPartConstant[] {
        return this.buildBody;
    }
}