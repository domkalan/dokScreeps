import { Slots } from "./Slots";

export interface SeatsResult {
    item: string,
    seats: number
}

export class Seats {
    public static GetSeatsForItem(room: Room, item: { id: string, pos: RoomPosition }) : number {
        if (typeof (Memory as any).dokScreeps.seats === 'undefined') {
            (Memory as any).dokScreeps.seats = [];
        }

        const locksItem = ((Memory as any).dokScreeps.seats as SeatsResult[]).find(i => i.item === item.id);

        if (typeof locksItem === 'undefined') {
            const slotsOnItem = Slots.GetFreeSlots(room, item, 1, 0, ['swamp', 'road']);

            slotsOnItem.forEach(i => {
                if (i.code === 0) {
                    new RoomVisual(room.name).circle(i.pos.x, i.pos.y, { fill: '#000000', opacity: 0.1 });

                    return;
                }

                new RoomVisual(room.name).circle(i.pos.x, i.pos.y, { fill: '#ff4f00' });
            });

            const seatsOnItem = slotsOnItem.filter(i => i.code === 1);

            (Memory as any).dokScreeps.seats.push({ item: item.id, seats: seatsOnItem.length });

            return seatsOnItem.length;
        }

        return locksItem.seats;
    }
}