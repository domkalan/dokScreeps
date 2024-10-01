export class Distance {
    public static GetDistance(pos1: RoomPosition, pos2: RoomPosition, doLongDistanceCalc: boolean = true) {
        var a = pos1.x - pos2.x;
        var b = pos1.y - pos2.y;

        let distance = Math.sqrt( a*a + b*b );

        // add further distance if rooms do not match
        if (pos1.roomName !== pos2.roomName) {
            if (doLongDistanceCalc) {
                distance * Game.map.getRoomLinearDistance(pos1.roomName, pos2.roomName);
            } else {
                return Infinity;
            }
        }

        if (distance < 0)
            distance = distance * -1;

        return distance;
    }
}