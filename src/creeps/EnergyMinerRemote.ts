import { dokFlag } from "../Flags";
import { Locks } from "../Locks";
import { Logger } from "../Logger";
import { dokCreep } from "./Creep";

export class dokEnergyMinerRemoteCreep extends dokCreep {
    private focusedFlag: dokFlag | null = null;
    private focusedSource: string | null = null;
    private focusedCan: string | null = null;
    private focusedOnCanConstruct: boolean = false;
    private focusedOnCanRepair: boolean = false;
    private announceLast: number = 0;

    public GatherSource(flag: dokFlag) {
        const homeRoom = this.dokScreepsRef.GetRoomReference(this.fromRoom);
    
        if (typeof homeRoom === 'undefined')
            return;

        if (flag.flagRef.secondaryColor === COLOR_ORANGE) {
            if (this.focusedSource === null) {
                const sourcesHere = this.creepRef.room.find(FIND_SOURCES).filter(i => Locks.GetLocksWithoutMe(i, this).length === 0);
    
                if (sourcesHere.length === 0) {
                    this.creepRef.say('S?');
    
                    return;
                }
    
                this.focusedSource = sourcesHere[0].id;
    
                Locks.PlaceLock(sourcesHere[0], this);
    
                return;
            }
    
            if (this.focusedOnCanConstruct && this.creepRef.store.energy > 0) {
                if (this.focusedCan === null) {
                    const canNearby = this.creepRef.pos.findInRange(FIND_CONSTRUCTION_SITES, 3).filter(i => i.structureType === 'container');
    
                    if (canNearby.length === 0) {
                        this.focusedOnCanConstruct = true;
    
                        this.creepRef.room.createConstructionSite(this.creepRef.pos, 'container');
    
                        return;
                    }
    
                    this.focusedCan = canNearby[0].id;
                }
    
                const focusedCan = Game.getObjectById(this.focusedCan) as ConstructionSite;
    
                if (focusedCan === null) {
                    this.focusedOnCanConstruct = false;
    
                    return;
                }
    
                const depositCode = this.creepRef.build(focusedCan);
    
                if (depositCode === -9) {
                    this.MoveTo(focusedCan);
                }
    
                return;
            }
    
            if (this.creepRef.store.energy >= 50 || this.focusedOnCanRepair) {
                if (this.focusedCan === null) {
                    const canNearby = this.creepRef.pos.findInRange(FIND_STRUCTURES, 3).filter(i => i.structureType === 'container');
    
                    if (canNearby.length === 0) {
                        this.focusedOnCanConstruct = true;
    
                        this.creepRef.room.createConstructionSite(this.creepRef.pos, 'container');
    
                        return;
                    }
    
                    this.focusedCan = canNearby[0].id;
                }
    
                const focusedCan = Game.getObjectById(this.focusedCan) as StructureContainer;

                if (focusedCan === null) {
                    this.focusedCan = null;

                    return;
                }

                this.announceLast++;
                if (focusedCan.store.energy >= focusedCan.store.getCapacity('energy') * 0.25 && this.announceLast >= 10) {
                    this.announceLast = 0;

                    const roomRef = this.GetRoomRefSafe();

                    roomRef.AddPullToHaulQueue(focusedCan.id, 'energy', 3, focusedCan.pos);

                    this.creepRef.say(`⚡️🚚`);

                    const resources = this.creepRef.room.find(FIND_DROPPED_RESOURCES).filter(i => Locks.GetLocksWithoutMe(i, this).length === 0 && i.resourceType === 'energy');

                    if (resources.length > 0) {
                        homeRoom.AddPickupToHaulQueue(resources[0].id, resources[0].resourceType, 3, resources[0].pos);
                    }
                }

                if (focusedCan.hits < focusedCan.hitsMax * 0.5 || this.focusedOnCanRepair) {
                    this.focusedOnCanRepair = true;

                    const repairCode = this.creepRef.repair(focusedCan);

                    if (repairCode === -9) {
                        this.MoveTo(focusedCan);
                    } else if (repairCode === -6) {
                        this.focusedOnCanRepair = false;
                    }

                    return;
                } else {
                    this.creepRef.drop('energy');
                }
    
                const depositCode = this.creepRef.transfer(focusedCan, 'energy');
    
                if (depositCode === -9) {
                    this.MoveTo(focusedCan);
                }
    
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
            } else if (harvestCode == -6) {
                this.sleepTime = 10;
            }

            return;
        }
        
        if (flag.flagRef.secondaryColor === COLOR_GREY) {
            const homeRoom = this.dokScreepsRef.GetRoomReference(this.fromRoom);
    
            if (typeof homeRoom === 'undefined')
                return;

            if (this.focusedSource === null) {
                const mineralsHere = this.creepRef.room.find(FIND_MINERALS).filter(i => Locks.GetLocksWithoutMe(i, this).length === 0);
    
                if (mineralsHere.length === 0) {
                    this.creepRef.say('M?');
    
                    return;
                }
    
                this.focusedSource = mineralsHere[0].id;
    
                Locks.PlaceLock(mineralsHere[0], this);
    
                return;
            }
            
            const targetedSource = Game.getObjectById(this.focusedSource) as Mineral;
    
            if (targetedSource === null) {
                return;
            }
    
            const harvestCode = this.creepRef.harvest(targetedSource);
    
            if (harvestCode == -9) {
                this.MoveTo(targetedSource);
    
                return;
            } else if (harvestCode == -6) {
                this.sleepTime = 10;
            } else if (harvestCode === 0) {
                if (this.creepRef.store.getFreeCapacity(targetedSource.mineralType) <= 0) {
                    this.creepRef.drop(targetedSource.mineralType);
                }

                this.announceLast++;
                if (this.announceLast >= 5) {
                    this.announceLast = 0;

                    const resources = this.creepRef.room.find(FIND_DROPPED_RESOURCES).filter(i => Locks.GetLocksWithoutMe(i, this).length === 0 && i.resourceType === targetedSource.mineralType);

                    if (resources.length > 0) {
                        homeRoom.AddPickupToHaulQueue(resources[0].id, resources[0].resourceType, 3, resources[0].pos);
                    }
                }
            }

            return;
        }
    }

    public DoRemoteWork() {
        if (this.focusedFlag === null) {
            const roomFlags = this.dokScreepsRef.GetAssignedFlags(this.fromRoom);
            const attackFlags = roomFlags.filter(i => i.flagRef?.color === COLOR_ORANGE && Locks.GetLocksWithoutMe({ id: `flag:${i.flagRef.name}` }, this).length === 0);
    
            if (attackFlags.length > 0) {
                this.focusedFlag = attackFlags[0];

                Locks.PlaceLock({ id: `flag:${attackFlags[0].name}` }, this);
            } else {
                this.creepRef.say(`😴`);

                return;
            }
        }

        if (this.focusedFlag === null)
            return;

        // make sure flag still exists
        if (typeof Game.flags[this.focusedFlag.name] === 'undefined') {
            this.focusedFlag = null;

            this.creepRef.say('F?');

            return;
        }
        
        if (this.creepRef.pos.roomName !== this.focusedFlag.flagRef.pos.roomName) {
            this.MoveTo(this.focusedFlag.flagRef);

            return;
        }

        this.GatherSource(this.focusedFlag);
    }

    public Tick(tickNumber: number, instanceTickNumber: number): boolean {
        if (super.Tick(tickNumber, instanceTickNumber)) {
            return true;
        }

        this.DoRemoteWork();
        
        return true;
    }

    public static buildBody: BodyPartConstant[] = [ MOVE, WORK, CARRY ];
    public static buildName: string = 'rem';
}