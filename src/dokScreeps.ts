import { dokCreep } from "./creeps/Creep";
import { dokFlag } from "./Flags";
import { InstanceManager } from "./InstanceManager";
import { Locks } from "./Locks";
import { Logger } from "./Logger";
import { dokRoom } from "./rooms/Room";
import { Settings } from "./Settings";

export class dokScreeps {
    private initializedAt : number;

    private creeps: dokCreep[] = [];
    private rooms: dokRoom[] = [];
    private flags: dokFlag[] = [];

    private tickCount: number = 0;

    constructor() {
        this.initializedAt = Game.time;

        Logger.Log('dokScreeps', `dokScreeps started running at ${this.initializedAt}`);

        this.InitMemory();

        this.GatherCreeps();

        this.GatherRooms();

        Locks.RemoveDeadLocks();

        this.AddConsoleCommands();
    }

    private InitMemory() {
        if (typeof (Memory as any).dokScreeps === 'undefined') {
            (Memory as any).dokScreeps = {};
        }
        
        if (typeof (Memory as any).dokScreeps.startedAt === 'undefined') {
            (Memory as any).dokScreeps.startedAt = Game.time;
        }

        if (typeof (Memory as any).dokScreeps.memoryVersion === 'undefined') {
            (Memory as any).dokScreeps.memoryVersion = 0;
        }

        if (typeof (Memory as any).dokScreeps.creepsCount === 'undefined') {
            (Memory as any).dokScreeps.creepsCount = 0;
        }
    }

    private GatherCreeps() {
        this.creeps = [];

        for(const creep of Object.keys(Game.creeps)) {
            this.creeps.push(InstanceManager.ParseRawCreep(Game.creeps[creep], this));
        }

        Logger.Log('dokScreeps', `Found ${this.creeps.length} creep(s) active`);
    }

    public RegisterCreep(creep : dokCreep) {
        this.creeps.push(creep);

        Logger.Log('dokScreeps', `Creep ${creep.creepRef.name} has been registered`);
    }

    public RemoveCreep(creep: dokCreep) {
        this.creeps = this.creeps.filter(i => i !== creep);

        delete Memory.creeps[creep.name];
    }

    private GatherRooms() {
        this.rooms = [];

        for(const room of Object.keys(Game.rooms)) {
            this.rooms.push(InstanceManager.ParseRawRoom(Game.rooms[room], this));
        }
    }

    public RemoveRoom(room : dokRoom) {
        this.rooms = this.rooms.filter(i => i !== room);
    }

    public GetCreepsByRoom(room : string) : dokCreep[] {
        return this.creeps.filter((i) => i.fromRoom === room);
    }

    public GetStructuresByRoom(room : string) : Structure[] {
        return Object.values(Game.structures);
    }

    public GetRoomReference(room : string) : dokRoom | undefined {
        return this.rooms.find(i => i.roomRef.name === room);
    }

    public GetRooms() {
        return this.rooms;
    }

    private ProcessTickCreeps() {
        this.creeps.forEach(creep => {
            creep.Tick(Game.time, this.tickCount);
        })
    }

    private ProcessTickRooms() {
        this.rooms.forEach(room => {
            room.Tick(Game.time, this.tickCount);
        })
    }

    private RefreshRefrences() {
        this.GatherCreeps();

        this.GatherRooms();
    }

    public CleanUnusedMemory() {
        // Clean dead creeps memory
        for(const creepMemKey in Memory.creeps) {
            if (typeof Game.creeps[creepMemKey] === 'undefined') {
                delete Memory.creeps[creepMemKey];
            }
        }

        Locks.RemoveDeadLocks();
    }

    public GetFlags() {
        return Object.values(Game.flags);
    }

    public GetAssignedFlags(room : string) {
        const flags = this.flags.filter(i => i.assignedRoom === room || i.assignedRoom === '*');

        return flags;
    }

    public DoFlagLogic() {
        const flags = this.GetFlags();

        // delete expired flags, do flag logic
        for(const flag of this.flags) {
            const placedFlag = flags.find(i => i.name);

            if (typeof placedFlag !== 'undefined') {
                Logger.Log('dokScreeps', `Unregistered flag ${flag.name}`)

                this.flags = this.flags.filter(i => i.name !== flag.name);
            }
        }

        // update flag refs
        for(const flag of flags) {
            const existingFlag = this.flags.find(i => i.name === flag.name);

            if (typeof existingFlag === 'undefined') {
                const flagObject = new dokFlag(flag);

                Logger.Log('dokScreeps', `Registered new flag ${flag.name}`);

                this.flags.push(flagObject);

                continue;
            } else {
                existingFlag.flagRef = flag;
            }
        }

        // do flag logic
        for(const flag of this.flags) {
            flag.DoFlagLogic(this);
        }
    }

    public ProcessTick() {
        if (this.tickCount === 0) {
            new RoomVisual().text('Starting dokScreeps...', 25, 25, { font: '24px' });

            this.tickCount++;

            return;
        }

        this.tickCount++;

        if (this.tickCount % Settings.dokScreepsRefresh === 0) {
            this.RefreshRefrences();
        }

        if (this.tickCount % Settings.dokScreepsMemoryCleanup === 0) {
            this.CleanUnusedMemory();
        }

        if (this.tickCount % Settings.flagScanInternval === 0) {
            this.DoFlagLogic();
        }

        this.ProcessTickRooms();

        this.ProcessTickCreeps();
    }

    public GetCreepCounter(): number {
        return (Memory as any).dokScreeps.creepsCount;
    }

    public BumpCreepCounter(): number {
        (Memory as any).dokScreeps.creepsCount = (Memory as any).dokScreeps.creepsCount + 1;

        return (Memory as any).dokScreeps.creepsCount;
    }

    public AddConsoleCommands() {
        (global as any).RemoveDeadLocks = Locks.RemoveDeadLocks;
        (global as any).ResetAllLocks = Locks.ResetAllLocks;
        (global as any).Help = this.HelpConsoleCommand;
    }

    public HelpConsoleCommand() {
        console.log(`dokScreeps
        \tRemoveDeadLocks() - Remove dead or ghost locks.
        \tResetAllLocks() - Wipe the locks data.

        \tHelp() - Displays this help command.
        `)
    }

    // #region Static Methods
    private static _activeInstance: dokScreeps | null = null;

    public static RunLoop() {
        // if no active instance exists, create one
        if (this._activeInstance === null) {
            this._activeInstance = new dokScreeps();
        }

        this._activeInstance.ProcessTick();
    }

    public static GetInstance() : dokScreeps {
        if (this._activeInstance === null)
            throw new Error('No active instance of dokScreeps exists!');

        return this._activeInstance;
    }
    // #endregion
}