import { dokCreep } from "./creeps/Creep";
import { dokFlag } from "./Flags";
import { InstanceManager } from "./InstanceManager";
import { Locks } from "./Locks";
import { Logger } from "./Logger";
import { dokRoom, RoomState } from "./rooms/Room";
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

    public ManuallyRegisterRooms(room: Room) {
        const roomExists = this.rooms.find(i => i.name === room.name);

        if (typeof roomExists !== 'undefined')
            return;

        this.rooms.push(InstanceManager.ParseRawRoom(Game.rooms[room.name], this));
    }

    public RemoveRoom(room : dokRoom) {
        this.rooms = this.rooms.filter(i => i !== room);
    }

    public GetCreepsByRoom(room : string) : dokCreep[] {
        return this.creeps.filter((i) => i.fromRoom === room);
    }

    public GetStructuresByRoom(room : string) : Structure[] {
        return Object.values(Game.structures).filter(i => i.pos.roomName === room);
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

    public GetDokFlags() {
        return this.flags;
    }

    public GetAssignedFlags(room : string) {
        const flags = this.flags.filter(i => i.assignedRoom === room || i.assignedRoom === '*');

        return flags;
    }

    public DoFlagLogic() {
        const flags = this.GetFlags();

        // delete expired flags, do flag logic
        for(const flag of this.flags) {
            if (typeof Game.flags[flag.name] === 'undefined') {
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
            console.log('---------------\n');

            const startingOverlay = new RoomVisual();

            startingOverlay.rect(0, 0, 50, 50, { fill: 'rgba(0, 0, 0, 0.8)' });
            startingOverlay.text('Starting dokScreeps...', 25, 25, { font: '24px' });

            this.tickCount++;

            return;
        }

        this.DrawDebug();

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

    public DrawDebug() {
        const debugOverlay = new RoomVisual();

        debugOverlay.text(`Creeps: ${this.creeps.length}`, 0, 0, { align: 'left' });
        debugOverlay.text(`Rooms: ${this.rooms.filter(i => i.state === RoomState.Controlled).length}`, 0, 1, { align: 'left' });
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
        
        (global as any).ClearConstructionQueue = this.ClearConstructionQueue.bind(this);
        (global as any).ClearAllConstructionQueues = this.ClearAllConstructionQueues.bind(this);

        (global as any).Restart = this.RestartInstance.bind(this);

        (global as any).Help = this.HelpConsoleCommand;
    }

    public HelpConsoleCommand() {
        console.log(`dokScreeps
        \tRemoveDeadLocks() - Remove dead or ghost locks.
        \tResetAllLocks() - Wipe the locks data.

        \tClearConstructionQueue('roomId') - Clears the queued constructions from a room.
        \tClearAllConstructionQueues() - Clears all the construction queues.

        \t Restart() - Restart dokScreeps instance.

        \tHelp() - Displays this help command.
        `)
    }

    public ClearConstructionQueue(room : string) {
        const roomInstance = this.GetRoomReference(room);

        if (typeof roomInstance === 'undefined') {
            return 'Room not found!';
        }

        roomInstance.ClearConstructionQueue();

        return 'Success!'
    }

    public ClearAllConstructionQueues() {
        for(const room of this.rooms) {
            room.ClearConstructionQueue();
        }

        return 'Success!'
    }

    public RestartInstance() {
        dokScreeps._activeInstance = null;

        return 'Success!'
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