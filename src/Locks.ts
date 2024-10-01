import { dokCreep } from "./creeps/Creep";
import { dokScreeps } from "./dokScreeps";
import { Logger } from "./Logger";

export interface LockEntry {
    item: string,
    creep: string,
    lockedAt: number
}

export class Locks {
    public static PlaceLock(item: { id: string }, creep: dokCreep) {
        if (typeof (Memory as any).dokScreeps.locks === 'undefined') {
            (Memory as any).dokScreeps.locks = [];
        };

        if ((Memory as any).dokScreeps.locks.filter((i : LockEntry) => i.creep === creep.creepRef.id && i.item === item.id).length > 0)
            return true;

        (Memory as any).dokScreeps.locks.push({ item: item.id, creep: creep.creepRef.id });

        return true;
    }

    public static GetLocks(item: { id: string }) {
        if (typeof (Memory as any).dokScreeps.locks === 'undefined') {
            return []
        };

        return (Memory as any).dokScreeps.locks.filter((i : LockEntry) => i.item === item.id);
    }

    public static GetLocksWithoutMe(item: { id : string }, creep : dokCreep) {
        if (typeof (Memory as any).dokScreeps.locks === 'undefined') {
            return []
        };

        return (Memory as any).dokScreeps.locks.filter((i : LockEntry) => i.item === item.id && i.creep !== creep.creepRef.id);
    }

    public static ReleaseLocks(creep: dokCreep) {
        if (typeof (Memory as any).dokScreeps.locks === 'undefined') {
            return true;
        };

        (Memory as any).dokScreeps.locks = (Memory as any).dokScreeps.locks.filter((i : LockEntry) => i.creep !== creep.creepRef.id)
    }

    public static RemoveDeadLocks() {
        let cleanedLocks = 0;

        if (typeof (Memory as any).dokScreeps.locks !== 'undefined') {
            const creepIds = Object.values(Game.creeps).map(i => i.id as string);

            (Memory as any).dokScreeps.locks = (Memory as any).dokScreeps.locks.filter((lock : LockEntry) => {
                if (creepIds.includes(lock.creep)) {
                    return true;
                }

                cleanedLocks++;
                return false;
            });
        }

        Logger.Log('Locks', `${cleanedLocks} ghost lock(s) have been cleaned`);
    }
}