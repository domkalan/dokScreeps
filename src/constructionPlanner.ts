import { RoomContext } from 'utils/Context';
import { ConstructionPlanItem, ConstructionPlannerMemory } from './types/construction';
// constructionPlanner.ts

const DEFAULT_MAX_SITES = 2;
const DEFAULT_PLACEMENTS_PER_RUN = 2;
const DEFAULT_INTERVAL = 25;

type PlannedItemState =
    | "planned"
    | "construction"
    | "complete"
    | "blocked"
    | "unavailable";

export class ConstructionPlanner {
    public static run(room: Room, context: RoomContext): void {
        if (!room.controller?.my) {
            return;
        }

        const memory = this.getMemory(room);

        if (!memory.enabled) {
            return;
        }

        // Visuals should run every tick because RoomVisual only lasts one tick.
        this.drawVisuals(room, memory.plan, context);

        this.createBuildTasks(room, context);

        if (Game.time - memory.lastRun < memory.interval) {
            return;
        }

        memory.lastRun = Game.time;

        this.placeConstructionSites(room, memory, context);
    }

    /**
     * Replace the current room blueprint.
     */
    public static setPlan(
        room: Room,
        plan: ConstructionPlanItem[]
    ): void {
        const memory = this.getMemory(room);

        memory.plan = [...plan].sort(
            (a, b) => a.priority - b.priority
        );
    }

    /**
     * Adds items without replacing the existing plan.
     */
    public static addToPlan(
        room: Room,
        items: ConstructionPlanItem[]
    ): void {
        const memory = this.getMemory(room);

        const existing = new Set(
            memory.plan.map(item => this.getPositionKey(item))
        );

        for (const item of items) {
            const key = this.getPositionKey(item);

            if (!existing.has(key)) {
                memory.plan.push(item);
                existing.add(key);
            }
        }

        memory.plan.sort((a, b) => a.priority - b.priority);
    }

    private static getMemory(
        room: Room
    ): ConstructionPlannerMemory {
        if (!room.memory.constructionPlanner) {
            room.memory.constructionPlanner = {
                enabled: true,
                maxSites: DEFAULT_MAX_SITES,
                placementsPerRun: DEFAULT_PLACEMENTS_PER_RUN,
                interval: DEFAULT_INTERVAL,
                lastRun: 0,
                plan: [],
            };
        }

        return room.memory.constructionPlanner;
    }

    private static placeConstructionSites(
        room: Room,
        memory: ConstructionPlannerMemory,
        context: RoomContext
    ): void {
        const roomSites = context.constructionSites;

        let availableSlots = Math.max(
            0,
            memory.maxSites - roomSites.length
        );

        if (availableSlots === 0) {
            return;
        }

        /*
         * Screeps also has an account-wide construction site limit.
         * Avoid issuing placement attempts once that global limit is reached.
         */
        const globalAvailable = Math.max(
            0,
            MAX_CONSTRUCTION_SITES -
            Object.keys(Game.constructionSites).length
        );

        availableSlots = Math.min(
            availableSlots,
            globalAvailable,
            memory.placementsPerRun
        );

        if (availableSlots === 0) {
            return;
        }

        const controllerLevel = room.controller?.level ?? 0;

        const candidates = memory.plan
            .filter(item => item.minRcl <= controllerLevel)
            .sort((a, b) => a.priority - b.priority);

        let placed = 0;

        for (const item of candidates) {
            if (placed >= availableSlots) {
                break;
            }

            const state = this.getItemState(room, item);

            if (state !== "planned") {
                continue;
            }

            const result = room.createConstructionSite(
                item.x,
                item.y,
                item.structureType
            );

            if (result === OK) {
                placed++;

                debugLog(
                    `[ConstructionPlanner] ${room.name}: ` +
                    `placed ${item.structureType} at ` +
                    `${item.x},${item.y}`
                );
            } else if (
                result !== ERR_INVALID_TARGET &&
                result !== ERR_RCL_NOT_ENOUGH
            ) {
                console.warn(
                    `[ConstructionPlanner] ${room.name}: ` +
                    `failed to place ${item.structureType} at ` +
                    `${item.x},${item.y}; result=${result}`
                );
            }
        }
    }

    /**
     * Creates build tasks for active construction sites.
     */
    private static createBuildTasks(room: Room, context: RoomContext): void {
        const sites = context.constructionSites;

        const existingTargets = new Set(
            Object.values(room.memory.tasks)
                .filter(task => task.type === "build")
                .map(task => task.targetId)
        );

        for (const site of sites) {
            if (existingTargets.has(site.id)) {
                continue;
            }

            const taskId =
                `build_${site.id}`;

            room.memory.tasks[taskId] = {
                id: taskId,
                assigned: "",
                type: "build",
                targetId: site.id,
                priority: this.getBuildPriority(site),
                completed: false,
                roomId: room.name,
                created: Game.time,
                expires: Game.time + 1000, // Example expiration time, adjust as needed
            };
        }

        this.removeFinishedBuildTasks(room);
    }

    private static removeFinishedBuildTasks(room: Room): void {
        for (const taskId in room.memory.tasks) {
            const task = room.memory.tasks[taskId];

            if (task.type !== "build") {
                continue;
            }

            const target = Game.getObjectById(
                task.targetId as Id<ConstructionSite>
            );

            if (!target) {
                delete room.memory.tasks[taskId];
            }
        }
    }

    private static getBuildPriority(
        site: ConstructionSite
    ): number {
        switch (site.structureType) {
            case STRUCTURE_SPAWN:
                return 1;

            case STRUCTURE_EXTENSION:
                return 10;

            case STRUCTURE_TOWER:
                return 15;

            case STRUCTURE_STORAGE:
                return 20;

            case STRUCTURE_CONTAINER:
                return 25;

            case STRUCTURE_ROAD:
                return 50;

            case STRUCTURE_RAMPART:
            case STRUCTURE_WALL:
                return 75;

            default:
                return 40;
        }
    }

    private static getItemState(
        room: Room,
        item: ConstructionPlanItem
    ): PlannedItemState {
        if (!this.isInsideRoom(item.x, item.y)) {
            return "blocked";
        }

        if ((room.controller?.level ?? 0) < item.minRcl) {
            return "unavailable";
        }

        const terrain = room.getTerrain().get(item.x, item.y);

        if (terrain === TERRAIN_MASK_WALL) {
            return "blocked";
        }

        const structures = room.lookForAt(
            LOOK_STRUCTURES,
            item.x,
            item.y
        );

        if (
            structures.some(
                structure =>
                    structure.structureType === item.structureType
            )
        ) {
            return "complete";
        }

        if (
            structures.some(
                structure =>
                    !this.canShareTile(
                        structure.structureType,
                        item.structureType
                    )
            )
        ) {
            return "blocked";
        }

        const sites = room.lookForAt(
            LOOK_CONSTRUCTION_SITES,
            item.x,
            item.y
        );

        if (
            sites.some(
                site =>
                    site.structureType === item.structureType
            )
        ) {
            return "construction";
        }

        if (sites.length > 0) {
            return "blocked";
        }

        return "planned";
    }

    /**
     * Roads and ramparts may share tiles with many structures.
     */
    private static canShareTile(
        existing: StructureConstant,
        planned: BuildableStructureConstant
    ): boolean {
        // Ramparts may occupy the same tile as another structure.
        if (
            existing === STRUCTURE_RAMPART ||
            planned === STRUCTURE_RAMPART
        ) {
            return true;
        }

        // Containers and roads can share a tile.
        if (
            (existing === STRUCTURE_CONTAINER &&
                planned === STRUCTURE_ROAD) ||
            (existing === STRUCTURE_ROAD &&
                planned === STRUCTURE_CONTAINER)
        ) {
            return true;
        }

        return false;
    }

    private static drawVisuals(
        room: Room,
        plan: ConstructionPlanItem[],
        context: RoomContext
    ): void {
        const visual = room.visual;

        let planned = 0;
        let constructing = 0;
        let complete = 0;
        let blocked = 0;

        for (const item of plan) {
            const state = this.getItemState(room, item);

            switch (state) {
                case "planned":
                    planned++;

                    visual.circle(item.x, item.y, {
                        radius: 0.38,
                        fill: "transparent",
                        stroke: "#00d8ff",
                        strokeWidth: 0.08,
                        opacity: 0.7,
                    });

                    visual.text(
                        this.getStructureSymbol(
                            item.structureType
                        ),
                        item.x,
                        item.y + 0.13,
                        {
                            font: 0.45,
                            color: "#00d8ff",
                            opacity: 0.9,
                            align: "center",
                        }
                    );
                    break;

                case "construction": {
                    constructing++;

                    const site = room
                        .lookForAt(
                            LOOK_CONSTRUCTION_SITES,
                            item.x,
                            item.y
                        )
                        .find(
                            value =>
                                value.structureType ===
                                item.structureType
                        );

                    const progress = site
                        ? site.progress / site.progressTotal
                        : 0;

                    visual.circle(item.x, item.y, {
                        radius: 0.4,
                        fill: "#ffd166",
                        opacity: 0.18,
                        stroke: "#ffd166",
                        strokeWidth: 0.1,
                    });

                    visual.text(
                        `${Math.floor(progress * 100)}%`,
                        item.x,
                        item.y + 0.12,
                        {
                            font: 0.32,
                            color: "#ffffff",
                            align: "center",
                        }
                    );

                    break;
                }

                case "complete":
                    complete++;
                    break;

                case "blocked":
                    blocked++;

                    visual.line(
                        item.x - 0.3,
                        item.y - 0.3,
                        item.x + 0.3,
                        item.y + 0.3,
                        {
                            color: "#ff4d6d",
                            width: 0.08,
                            opacity: 0.8,
                        }
                    );

                    visual.line(
                        item.x + 0.3,
                        item.y - 0.3,
                        item.x - 0.3,
                        item.y + 0.3,
                        {
                            color: "#ff4d6d",
                            width: 0.08,
                            opacity: 0.8,
                        }
                    );
                    break;
            }
        }

        const activeSites = context.constructionSites.length;

        visual.text(
            `Construction ${activeSites}/${this.getMemory(room).maxSites}`,
            1,
            1,
            {
                align: "left",
                font: 0.65,
                color: "#ffffff",
                backgroundColor: "#111111",
                backgroundPadding: 0.15,
                opacity: 0.9,
            }
        );

        visual.text(
            `Queued: ${planned} | Building: ${constructing}`,
            1,
            1.8,
            {
                align: "left",
                font: 0.45,
                color: "#00d8ff",
                backgroundColor: "#111111",
                backgroundPadding: 0.1,
                opacity: 0.85,
            }
        );

        if (blocked > 0) {
            visual.text(
                `Blocked: ${blocked} | Complete: ${complete}`,
                1,
                2.4,
                {
                    align: "left",
                    font: 0.42,
                    color: "#ff4d6d",
                    backgroundColor: "#111111",
                    backgroundPadding: 0.1,
                    opacity: 0.85,
                }
            );
        }
    }

    private static getStructureSymbol(
        structureType: BuildableStructureConstant
    ): string {
        switch (structureType) {
            case STRUCTURE_SPAWN:
                return "S";

            case STRUCTURE_EXTENSION:
                return "E";

            case STRUCTURE_ROAD:
                return "·";

            case STRUCTURE_CONTAINER:
                return "C";

            case STRUCTURE_STORAGE:
                return "ST";

            case STRUCTURE_TOWER:
                return "T";

            case STRUCTURE_LINK:
                return "L";

            case STRUCTURE_LAB:
                return "B";

            case STRUCTURE_TERMINAL:
                return "TM";

            case STRUCTURE_RAMPART:
                return "R";

            case STRUCTURE_WALL:
                return "W";

            default:
                return "?";
        }
    }

    private static getPositionKey(
        item: ConstructionPlanItem
    ): string {
        return (
            `${item.x}:${item.y}:` +
            `${item.structureType}`
        );
    }

    private static isInsideRoom(
        x: number,
        y: number
    ): boolean {
        /*
         * Avoid room exits. Building directly on exits is usually undesirable.
         */
        return x > 0 && x < 49 && y > 0 && y < 49;
    }
}