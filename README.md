# dokScreeps
dokScreeps is the source code for what is running on my Screeps.com account dokman.

## Flags
Information on flags can be viewed in the [FLAGS.md](FLAGS.md) file.

## Locking System
A locking system is used to prevent creeps from crowding a resource. Lock capacity for a resource is calculated based on empty tiles around a specific object and stored as seats. Once seats are generated for a resource, they are stored in memory to save CPU time. You may find it useful or needed at times to clear your seats if creating constructions around lockable structures or resources.

## Creep Inheritance
All creeps are inherited from [dokCreepBase](src/creeps/Base.ts) to perform base functions like depositing into extensions/spawn and upgrading a controller. Pathing instructions are also managed from dokCreepBase.

## RCL Based Creep Limits
Until a room hits RCL (room control level) 7, creep limits will gradually increase with each RCL unlock. Once hitting RCL 7, the room will go into a state with reduced creeps to conserve CPU. Creep limits are based on CARRY body parts for [dokCreepBase](src/creeps/Base.ts) creeps.

## Shell Rooms (coming soon)
Shell rooms are rooms defined by a shell flag (`W0N0 ShellRoom`), and basically operated at minimal capacity. This is done for rooms that do not need to have full presence, such as a resource outpost. Extensions will be limited to 5, all creep classes will be limited to a single instance, excluding HeavyMiners.