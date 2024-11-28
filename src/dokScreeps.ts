import { dokCreep } from "./creeps/Creep";
import { dokFlag } from "./Flags";
import { InstanceManager } from "./InstanceManager";
import { Locks } from "./Locks";
import { Logger } from "./Logger";
import { dokRoom, dokRoomMemory, dokRoomType, RoomState } from "./rooms/Room";
import { Settings } from "./Settings";

export class dokScreeps {
    private initializedAt : number;

    private creeps: dokCreep[] = [];
    private rooms: dokRoom[] = [];
    private flags: dokFlag[] = [];

    private tickCount: number = 0;

    private cpuBucketPause: boolean = false;
    private cpuNoCPUUnlocks: boolean = false;

    constructor() {
        this.initializedAt = Game.time;

        Logger.Log('CORE', `dokScreeps started running at ${this.initializedAt}`);

        this.InitMemory();

        this.GatherCreeps();

        this.GatherRooms();

        Locks.RemoveDeadLocks();

        this.AddConsoleCommands();

        this.DrawInitScreen(1);
    }

    private InitMemory() {
        // ensure basic memory exists
        if (typeof (Memory as any).rooms === 'undefined') {
            (Memory as any).rooms = {};
        }

        if (typeof (Memory as any).creeps === 'undefined') {
            (Memory as any).creeps = {};
        }

        if (typeof (Memory as any).flags === 'undefined') {
            (Memory as any).flags = {};
        }

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

        if (typeof (Memory as any).dokScreeps.pixelGen === 'undefined') {
            (Memory as any).dokScreeps.pixelGen = false;
        }
    }

    private GatherCreeps() {
        this.creeps = [];

        for(const creep of Object.keys(Game.creeps)) {
            this.creeps.push(InstanceManager.ParseRawCreep(Game.creeps[creep], this));
        }

        Logger.Log('CORE', `Found ${this.creeps.length} creep(s) active`);
    }

    public RegisterCreep(creep : dokCreep) {
        this.creeps.push(creep);

        Logger.Log('CORE', `Creep ${creep.creepRef.name} has been registered`);
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
            try {
                creep.Tick(Game.time, this.tickCount);
            } catch(error) {
                Logger.Error('CORE:CreepTicking', `Failed to tick creep ${creep.name}`, error)
            }
        })
    }

    private ProcessTickRooms() {
        this.rooms.forEach(room => {
            try {
                room.Tick(Game.time, this.tickCount);
            } catch(error) {
                Logger.Error('CORE:RoomTicking', `Failed to tick room ${room.name}`, error)
            }
        })
    }

    private ProcessTickCreepsEssential() {
        this.creeps.filter(i => InstanceManager.IsEssentialCreep(i.creepRef)).forEach(creep => {
            try {
                creep.Tick(Game.time, this.tickCount);
            } catch(error) {
                Logger.Error('CORE:CreepTicking', `Failed to tick creep ${creep.name}`, error)
            }
        })
    }

    private ProcessTickRoomsEssential() {
        this.rooms.forEach(room => {
            try {
                room.Tick(Game.time, this.tickCount);
            } catch(error) {
                Logger.Error('CORE:RoomTicking', `Failed to tick room ${room.name}`)
            }
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

        // Clean dead flag memory
        for(const flagMemKey in Memory.flags) {
            if (typeof Game.flags[flagMemKey] === 'undefined') {
                delete Memory.flags[flagMemKey];
            }
        }

        Locks.RemoveDeadLocks();
    }

    public GetFlags() {
        return Object.values(Game.flags).reverse();
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
                Logger.Log('CORE', `Unregistered flag ${flag.name}`)

                this.flags = this.flags.filter(i => i.name !== flag.name);
            }
        }

        // update flag refs
        for(const flag of flags) {
            const existingFlag = this.flags.find(i => i.name === flag.name);

            if (typeof existingFlag === 'undefined') {
                const flagObject = new dokFlag(flag);

                Logger.Log('CORE', `Registered new flag ${flag.name}`);

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

    public MonitorCPUUsage() {
        if (Game.cpu.bucket <= 2000 && !this.cpuBucketPause) {
            this.cpuBucketPause = true;
        } else if (Game.cpu.bucket >= 8000 && this.cpuBucketPause) {
            this.cpuBucketPause = false;
        }

        if (this.cpuBucketPause) {
            Logger.Log(`CPUMonitor:${this.tickCount}`, `CPU is paused low bucket, bucket is at ${Game.cpu.bucket}`);

            if (!Game.cpu.unlocked && typeof (Memory as any).dokScreeps.useCpuUnlock !== 'undefined' && (Memory as any).dokScreeps.useCpuUnlock === true && !this.cpuNoCPUUnlocks) {
                const unlockCode = Game.cpu.unlock();

                if (unlockCode === -6) {
                    Logger.Error(`CPUMonitor:${this.tickCount}`, `Attempted to unlock CPU but failed!`);

                    this.cpuNoCPUUnlocks = true;
                }
            }
        }
    }

    public DrawInitScreen(step: number) {
        const startingOverlay = new RoomVisual();

        startingOverlay.rect(0, 0, 50, 50, { fill: 'rgba(0, 0, 0, 0.8)' });
        startingOverlay.text('Starting dokScreeps...', 25, 25, { font: '24px' });
        startingOverlay.text(`Step ${step}/2`, 25, 26, { font: '12px' });

        this.DrawDebug(this.tickCount);
    }

    public ProcessTick() {
        if (this.tickCount === 0) {
            console.log('---------------\n');

            this.DrawInitScreen(2);

            this.tickCount++;

            return;
        }

        this.DrawDebug(this.tickCount);

        // pixel generation
        if ((Memory as any).dokScreeps.pixelGen === true && typeof Game.cpu.generatePixel !== 'undefined') {
            if (Game.cpu.bucket >= 10000) {
                Game.cpu.generatePixel();

                const startingOverlay = new RoomVisual();

                startingOverlay.rect(0, 0, 50, 50, { fill: 'rgba(0, 0, 0, 0.8)' });
                startingOverlay.text('Pixel Generated', 25, 25, { font: '24px' });

                return;
            }
        }

        this.MonitorCPUUsage();

        this.tickCount++;

        if (this.cpuBucketPause) {
            this.ProcessTickCreepsEssential();

            this.ProcessTickRoomsEssential();

            return;
        }

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

    public DrawDebug(instanceTick: number) {
        const debugOverlay = new RoomVisual();

        let lineNumber = 0;

        debugOverlay.text(`Tick: ${Game.time}, ${instanceTick}`, 0, lineNumber, { align: 'left' });
        lineNumber++;

        debugOverlay.text(`Creeps: ${this.creeps.length}`, 0, lineNumber, { align: 'left' });
        lineNumber++;

        debugOverlay.text(`Controllers: ${this.rooms.filter(i => i.state === RoomState.Controlled).length}`, 0, lineNumber, { align: 'left' });
        lineNumber++;

        debugOverlay.text(`Rooms: ${this.rooms.length}`, 0, lineNumber, { align: 'left' });
        lineNumber++;

        for(const room of this.rooms) {
            switch(room.state) {
                case RoomState.Controlled:
                    debugOverlay.text(`${room.name} (controlled:${room.roomType.toLowerCase()})`, 1, lineNumber, { align: 'left', color: '#03fc49' });

                    break;
                case RoomState.Inactive:
                    debugOverlay.text(`${room.name} (inactive)`, 1, lineNumber, { align: 'left', color: '#6b6b6b' });

                    break;
                case RoomState.Visiting:
                    debugOverlay.text(`${room.name} (visiting)`, 1, lineNumber, { align: 'left', color: '#3a78d6' });

                    break;
                case RoomState.Reserved:
                    debugOverlay.text(`${room.name} (reserved)`, 1, lineNumber, { align: 'left', color: '#853ad6' });
                    
                    break;
                default:
                    break;
            }

            lineNumber++;
        }

        // cpu bucket
        if (this.cpuBucketPause) {
            debugOverlay.text(`Bucket: ⏸️ ${Math.floor(Game.cpu.bucket)}/10000`, 0, lineNumber, { align: 'left' });
        } else if (!Game.cpu.unlocked) {
            debugOverlay.text(`Bucket: ▶️ ${Math.floor(Game.cpu.bucket)}/10000`, 0, lineNumber, { align: 'left' });
        } else if (Game.cpu.unlocked) {
            debugOverlay.text(`Bucket: 🔓▶️ ${Math.floor(Game.cpu.bucket)}/10000`, 0, lineNumber, { align: 'left' });
            debugOverlay.text('Unlocked', 8, 2, { align: 'left', color: 'green' });
        }
        
        debugOverlay.rect(0, lineNumber + 0.5, 8, 0.5, { fill: 'rgba(0, 0, 0, 0.5)' });

        if (Game.cpu.bucket < 2000) {
            debugOverlay.rect(0, lineNumber + 0.5, (Game.cpu.bucket / 10000) * 8, 0.5, { fill: '#fc032c' });
        } else if (Game.cpu.bucket < 4000) {
            debugOverlay.rect(0, lineNumber + 0.5, (Game.cpu.bucket / 10000) * 8, 0.5, { fill: '#fcbe03' });
        } else {
            debugOverlay.rect(0, lineNumber + 0.5, (Game.cpu.bucket / 10000) * 8, 0.5, { fill: '#03a5fc' });
        }
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
        (global as any).ClearRoomData = this.ClearRoomData.bind(this);

        (global as any).KillAllCreeps = this.KillAllCreeps.bind(this);
        (global as any).KillAllCreepsMatching = this.KillAllCreepsMatching.bind(this);

        (global as any).LeaveRoom = this.LeaveRoom.bind(this);
        (global as any).DebugRoomMemory = this.DebugRoomMemory.bind(this);
        (global as any).DebugRoomSpawnQueue = this.DebugRoomSpawnQueue.bind(this);
        (global as any).SetRoomType = this.SetRoomType.bind(this);

        (global as any).AutoUnlockCPU = this.AutoUnlockCPU.bind(this);
        (global as any).PauseCPU = this.PauseCPU.bind(this);

        (global as any).Restart = this.RestartInstance.bind(this);

        // new help command, easy
        (global as any).Help = `dokScreeps
        \tRemoveDeadLocks() - Remove dead or ghost locks.
        \tResetAllLocks() - Wipe the locks data.

        \tClearConstructionQueue('roomId') - Clears the queued constructions from a room.
        \tClearAllConstructionQueues() - Clears all the construction queues.
        \tClearRoomData() - Clears all stored information about rooms.

        \tKillAllCreeps() - Kills all active creeps.
        \tKillAllCreepsMatching(creepName) - Kills creeps filtered by the the name.startsWith.
        \t\tExample: Running KillCreepMatching('bootstrap:32') will kill creep bootstrap:32.
        \t\tUsing "bootstrap" instead will effectively kill all bootstrap creeps.

        \tLeaveRoom(roomName) - Instructs the instance, destroy everything and leave a room.
        \tDebugRoomMemory(roomName) - Instructs the instance to print raw the memory of a room.
        \tDebugRoomSpawnQueue(roomName) - Instructs the instance to print raw the current spawn queue.
        \tSetRoomType(roomName) - Changes the room type to a new room type specified in the instance manager.

        \tAutoUnlockCPU(true/false) - Allows the utility to use a CPU unlocked automatically. (default: false)
        \tPauseCPU([true/false]) - Pauses the CPU to let the CPU bucket refill to its full amount.

        \tRestart() - Restart dokScreeps instance.x

        \tHelp() - Displays this help command.
        `;
        (global as any).help = (global as any).Help;
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

    public AutoUnlockCPU(newValue: boolean) {
        (Memory as any).dokScreeps.useCpuUnlock = newValue;

        return 'Success!'
    }

    public KillAllCreeps() {
        const creepsCount = this.creeps.length;

        this.creeps.forEach(i => i.creepRef.suicide());

        return `Success, killed ${creepsCount} creep(s)!`
    }

    public KillAllCreepsMatching(filter: string) {
        const filterCreeps = this.creeps.filter(i => i.name.startsWith(filter));
        const creepsCount = filterCreeps.length;
        
        filterCreeps.forEach(i => i.creepRef.suicide());

        return `Success, killed ${creepsCount} creep(s)!`
    }

    public LeaveRoom(roomName : string) {
        const roomToLeave = this.rooms.find(i => i.name === roomName);

        if (typeof roomToLeave === 'undefined')
            return `Room ${roomName} not found!`;

        const roomStructures = this.GetStructuresByRoom(roomName);

        for(const structure of roomStructures) {
            if (structure.structureType === 'controller') {
                continue;
            }

            if (structure.structureType === 'constructedWall') {
                continue;
            }

            structure.destroy();
        }

        const creepsHere = this.creeps.filter(i => i.fromRoom === roomName) as dokCreep[];

        for(const creep of creepsHere) {
            creep.creepRef.suicide();
        }

        const roomConstructions = roomToLeave.roomRef.find(FIND_CONSTRUCTION_SITES);

        for(const construction of roomConstructions) {
            construction.remove();
        }

        const controllerStructure = roomStructures.find(i => i.structureType === 'controller') as StructureController;

        if (typeof controllerStructure !== 'undefined') {
            controllerStructure.unclaim();
        }

        this.rooms = this.rooms.filter(i => i.name !== roomName);

        Memory.rooms[roomName] = {};

        return `Success! Room ${roomName} has been left.`;
    }

    public DebugRoomMemory(roomName : string) {
        const roomToDebug = this.rooms.find(i => i.name === roomName);

        if (typeof roomToDebug === 'undefined')
            return `Room ${roomName} not found!`;

        return JSON.stringify(Memory.rooms[roomName], null, 4);
    }

    public DebugRoomSpawnQueue(roomName : string) {
        const roomToDebug = this.rooms.find(i => i.name === roomName);

        if (typeof roomToDebug === 'undefined')
            return `Room ${roomName} not found!`;

        return JSON.stringify(roomToDebug.GetSpawnQueue().map(i => i.creep.buildName).join(', '), null, 4);
    }

    public SetRoomType(roomName : string, roomType: dokRoomType) {
        const roomToDebug = this.rooms.find(i => i.name === roomName);

        if (typeof roomToDebug === 'undefined')
            return `Room ${roomName} not found!`;

        const currentRoomType = (Memory.rooms[roomName] as dokRoomMemory).roomType;

        (Memory.rooms[roomName] as dokRoomMemory).roomType = roomType;

        this.rooms = this.rooms.filter(i => i.name !== roomName);

        const recreatedRoomType = InstanceManager.ParseRawRoom(Game.rooms[roomName], this);

        this.rooms.push(recreatedRoomType);

        return `Success! Room was ${currentRoomType}, but is now ${roomType}`;
    }

    private PauseCPU(newBool : boolean | undefined) {
        if (typeof newBool === 'undefined') {
            this.cpuBucketPause = !this.cpuBucketPause;
        } else {
            this.cpuBucketPause = newBool;
        }
        

        return `Success! CPU bucket pause is now set to ${this.cpuBucketPause}.`;
    }

    private ClearRoomData() {
        this.rooms = [];
        (Memory.rooms as any) = {};

        return this.RestartInstance();
    }

    // #region Static Methods
    private static _activeInstance: dokScreeps | null = null;

    public static RunLoop() {
        // if no active instance exists, create one
        if (this._activeInstance === null) {
            this._activeInstance = new dokScreeps();

            return;
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