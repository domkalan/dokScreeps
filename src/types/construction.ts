export interface ConstructionPlanItem {
    x: number;
    y: number;
    structureType: BuildableStructureConstant;
    priority: number;

    /**
     * Minimum controller level before the planner attempts this item.
     */
    minRcl: number;
}

export interface ConstructionPlannerMemory {
    enabled: boolean;

    /**
     * Maximum active construction sites allowed in this room.
     */
    maxSites: number;

    /**
     * Maximum new sites created during a single planner run.
     */
    placementsPerRun: number;

    /**
     * Number of ticks between planner runs.
     */
    interval: number;

    /**
     * Last tick the planner attempted to place sites.
     */
    lastRun: number;

    /**
     * Persistent blueprint for the room.
     */
    plan: ConstructionPlanItem[];
}