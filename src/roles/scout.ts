import { RoomContext } from 'utils/Context';
import { scanRoom } from '../hive';

export function runPortalLogic(creep: Creep, context: RoomContext): void {
    // check if the creep has a task assigned
    if (!creep.memory.taskId) {
        // check if there are any unassigned scout tasks in the hive memory
        for (const taskId in Memory.hive.tasks) {
            const task = Memory.hive.tasks[taskId];
            if (task.type === 'jump' && !task.assigned && !task.completed) {
                // assign the task to this scout
                task.assigned = creep.name;
                creep.memory.taskId = taskId;

                break;
            }
        }
    }

    if (creep.memory.taskId) {
        const task = Memory.hive.tasks[creep.memory.taskId];

        // check if the task is still valid
        if (!task || task.completed) {
            // the task is no longer valid, so clear the task from memory
            creep.memory.taskId = undefined;

            return;
        }

        // move to the target room
        if (task.roomId !== creep.room.name) {
            creep.travelTo(new RoomPosition(25, 25, task.roomId));

            return;
        }

        // find all portals in the room
        const portals = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_PORTAL
        }) as StructurePortal[];

        const targetPortal = portals.find(portal => portal.id === task.targetId);

        if (targetPortal) {
            // move to the portal
            if (!creep.pos.isNearTo(targetPortal)) {
                creep.travelTo(targetPortal);

                return;
            }

            // use the portal to jump to the target room
            creep.moveTo(targetPortal);

            // mark the task as completed
            task.completed = true;
            creep.memory.taskId = undefined;
        }
    }
}

export function runScanWork(creep: Creep, context: RoomContext): void {
    // check for the next unassigned scan task in the hive memory
    if (!creep.memory.taskId) {
        const tasks = Object.entries(Memory.hive.tasks).filter(([key, task]) => task.type === 'scan' && !task.assigned && !task.completed).sort((a, b) => Game.map.getRoomLinearDistance(a[1].roomId, creep.room.name) - Game.map.getRoomLinearDistance(b[1].roomId, creep.room.name));
        if (tasks.length > 0) {
            tasks[0][1].assigned = creep.name;

            creep.memory.taskId = tasks[0][0];
        }
    }

    // check if the known task is still valid
    if (creep.memory.taskId) {
        const task = Memory.hive.tasks[creep.memory.taskId];
        if (!task || task.completed) {
            // the task is no longer valid, so clear the task from memory
            creep.memory.taskId = undefined;
        }
    } else {
        // if the creep does not have a task, check for any unassigned tasks

        creep.say('Idle');

        return;
    }

    // if the scout has a task, move to the target room and scan it
    if (creep.memory.taskId) {
        const task = Memory.hive.tasks[creep.memory.taskId];

        // move the creep
        if (task.roomId !== creep.room.name) {
            // scan rooms we never been in before
            if (!creep.memory.kv!.inRoom || creep.memory.kv!.inRoom !== creep.room.name) {
                scanRoom(creep.room);

                creep.memory.kv!.inRoom = creep.room.name;
            }

            // show we are peace
            creep.say(`✌️`, true);

            // move to the target room
            creep.travelTo(new RoomPosition(25, 25, task.roomId));

            if (!creep.memory.kv!.travelingRoom || creep.memory.kv!.travelingRoom !== task.roomId) {
                creep.memory.kv!.travelingRoom = task.roomId;
                creep.memory.kv!.travelingFor = Game.time;
            } else if (Game.time - creep.memory.kv!.travelingFor > 400) {
                // if we have been traveling for more than 100 ticks, mark the task as completed
                task.completed = true;
                creep.memory.taskId = undefined;

                // mark the room as inaccessible
                Memory.hive.rooms[task.roomId].inaccessible = true;

                creep.say('Stuck!', true);
            }

            return;
        }

        if (task.roomId === creep.room.name) {
            // mark the room as hostile when we enter
            Memory.hive.rooms[task.roomId].hostile = true;
            Memory.hive.rooms[task.roomId].lastScan = Game.time;

            if (!creep.memory.kv!.inRoomFor) {
                creep.memory.kv!.inRoomFor = 0;
            }

            if (creep.memory.kv!.inRoomFor >= 5) {
                // the creep has been in the room for 5 ticks, so complete the task
                task.completed = true;
                creep.memory.taskId = undefined;

                scanRoom(creep.room);

                creep.say('Thanks!', true);

                creep.memory.kv!.inRoomFor = 0;
            } else {
                creep.travelTo(new RoomPosition(25, 25, task.roomId));
            }

            // increment the inRoomFor counter
            creep.memory.kv!.inRoomFor++;
        }
    }
}

export function runScout(creep: Creep, context: RoomContext): void {
    if (!creep.memory.kv) {
        creep.memory.kv = {};
    }

    runScanWork(creep, context);
}