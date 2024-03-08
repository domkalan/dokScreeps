import dokRoom, { dokRoomScoutPlan } from "../dokRoom";
import dokCreep from "./Base";

export default class dokCreepScout extends dokCreep {
    private currentScout: dokRoomScoutPlan | null = null;
    private homeRoom: dokRoom | null = null;
    private hostileCheck: number = 0; 
    private roomScanRan: boolean = false;

    private ticksToGetThere: number = 0;
    private ticksSpentTryingToGet: number = 0;

    private currentRoom: string | null = null;
    private currentRoomFor: number = 0;

    public DoScoutCollectData() {
        if (this.currentScout === null)
            return;

        if (this.homeRoom === null)
            return;

        if (this.hostileCheck === 0)
            this.homeRoom.RunScoutScanOnRoom(this.creepRef.room);

        this.hostileCheck++;
        if (this.hostileCheck <= 10) {

            this.creepRef.say('👋', true);

            if (this.hostileCheck <= 2) {
                this.moveToObjectFar(new RoomPosition(25, 25, this.currentScout.room));
            }
            
            return;
        }

        if (!this.roomScanRan) {
            this.creepRef.say('👀', true);

            this.homeRoom.SetScoutRoomNotHostile(this.creepRef.room);

            this.roomScanRan = true;

            this.currentScout = null;
        }
    }

    public DoScoutPlanWork() {
        if (!this.currentScout)
            return;

        if (!this.roomScanRan && this.creepRef.room.name === this.currentScout.room) {
            this.DoScoutCollectData();

            return;
        }

        this.ticksSpentTryingToGet++;
        if (this.ticksSpentTryingToGet >= this.ticksToGetThere) {
            console.log(`[dokUtil][Scout] room ${this.currentScout.room} is considered inaccessable!`);

            if (this.homeRoom !== null) {
                this.homeRoom.SetScoutRoomInaccessable(this.currentScout.room);

                this.creepRef.say('🤷', true);
            }

            this.currentScout = null;

            return;
        }

        if (this.util.RunEveryTicks(5)) {
            this.creepRef.say(`🚶 ${this.currentScout.room}`, false);
        } else {
            this.creepRef.say(`🚶 ${this.ticksSpentTryingToGet}/${this.ticksToGetThere}`, false);
        }

        if (this.currentRoom !== this.creepRef.room.name) {
            this.currentRoom = this.creepRef.room.name;
            this.currentRoomFor = 0;
        }

        if (this.currentRoomFor == 15 && this.currentRoom !== this.currentScout.room && this.homeRoom !== null) {
            console.log(`[dokUtil][Scout] passing through room ${this.creepRef.room.name}, will run scout since here`);

            this.homeRoom.RunScoutScanOnRoom(this.creepRef.room, true);
        }

        this.currentRoomFor++;
        

        this.moveToObjectFar(new RoomPosition(25, 25, this.currentScout.room));
    }

    public DoCreepWork(): void {
        if (this.homeRoom === null) {
            const homeRoom = this.util.GetDokRoom(this.memory.homeRoom);

            if (!homeRoom)
                return;

            this.homeRoom = homeRoom;
        }

        if (this.currentScout !== null) {
            this.DoScoutPlanWork();

            return;
        }

        const roomInstance = this.util.GetDokRoom(this.memory.homeRoom);

        if (!roomInstance)
            return;

        // break refrence to the main scout array
        const scoutPlans : dokRoomScoutPlan[] = ([] as dokRoomScoutPlan[]).concat(roomInstance.GetScoutPlan()).filter(i => i.inaccessible === false).sort((a, b) => a.lastVisited - b.lastVisited);

        if (scoutPlans.length == 0) {
            this.creepRef.say('No plan!');

            return;
        }

        // reset our internal vars
        this.hostileCheck = 0;
        this.roomScanRan = false;
        this.ticksSpentTryingToGet = 0;

        const nextScoutPlan = scoutPlans.shift();
        
        if (typeof nextScoutPlan === 'undefined')
            return;

        if (this.util.GetTickCount() - nextScoutPlan.lastVisited < 5000) {
            console.log(`[dokUtil] all room scouts are current, pausing scouting until 24 hours`);

            this.homeRoom.PauseScouts();

            this.creepRef.suicide();

            return;
        }

        console.log(`[dokUtil][Scout] got instruction to go scout room ${nextScoutPlan.room}, last tick was ${nextScoutPlan.lastVisited} which was ${this.util.GetTickCount() - nextScoutPlan.lastVisited} ticks ago`);

        // keep track of how many times we tried to scout this room
        if (nextScoutPlan.accessAttempts >= 5) {
            this.homeRoom.SetScoutRoomInaccessable(nextScoutPlan.room);

            return;
        }

        // mark an attempt to get into this room
        this.homeRoom.LogScoutRoomAttempt(nextScoutPlan.room);

        // calc how long it takes to get here
        this.ticksToGetThere = Game.map.getRoomLinearDistance(this.creepRef.room.name, nextScoutPlan.room) * 80;
        
        // do we have enough life to make it there?
        if ((this.creepRef.ticksToLive || 0) < this.ticksToGetThere) {
            this.creepRef.say('🪦⏱️', false);

            this.creepRef.suicide();

            return;
        }

        console.log(`[dokUtil][ScoutCreep] ${this.creepRef.name} will scout room ${nextScoutPlan.room} via ${nextScoutPlan.priorRoom}, lastVisited=${nextScoutPlan.lastVisited}`)

        this.currentScout = nextScoutPlan;

        // start our work
        this.DoScoutPlanWork();
    }
}