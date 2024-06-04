# dokUtil Flags

## Global Flags

- **SkipCreepTick** - Skips ticking of creeps.
- **SkipNonAttackCreepTick** - Skips ticking of creeps that are not Attackers or Defenders. As a safety measure, regular creeps will tick every 10 ticks.
- **SkipRoomTick** - Skips ticking of rooms.
- **SkipPixelGen** - Skips generation of pixels when bucket hits 10,000 cpu.
- **MinesRemove** - Removes all mine flags regardless of room.
- **AttackRemove** - Remove all attack flags regardless of room.
- **AttackersDisband** - Kills all attacker creeps regardless of room.
- **LeaveRoom** - Kills all creeps, destroys all structures, and unclaims the controller of the room the flag is placed in.
- **KillAllCreeps** - Kills all creeps, regardless of room.
- **KillCreepsInRoom** - Kills all creeps that were born from the room the flag is placed in.

## Room Specific Flags
Most room specific flags accept numbers after the name to allow for multiple flags. example: `W0N0 Reserve 1`

### Colony Tasks
- **W0N0 Reserve** - Spawns a colonizer to reserve the room of the placed flag.
- **W0N0 Colonize** - Spawns a colonizer to claim the room of the placed flag.

### Mining Tasks
- **W0N0 Mine** - Spawns a remote miner to mine a resource or deposit.
  - Accepts a number in the 4th argument (example: `W0N0 Mine 0 8`) to specify how many creeps should be spawned.
  - If CanHauler flag is present in room, miners will place resources into container.
- **W0N0 CanHauler** - A hauler creep with primary focus on collecting dropped energy or energy placed in a container.
  - Accepts a number in the 4th argument to specify how many creeps should be spawned.
- **W0N0 PowerHauler** - A hauler creep with primary focus on collecting dropped power.
  - Accepts a number in the 4th argument to specify how many creeps should be spawned.
- **W0N0 PowerMine** - A mining creep focused on destroying power banks and dropping power on the floor for PowerHaulers.

### Construction Tasks
- **W0N0 Construct** - A worker creep with primary focus on building construction sites.
  - Accepts a number in the 4th argument to specify how many creeps should be spawned.
  - Accepts the word Repair in the 5th argument (example: `W0N0 Construct 0 1 Repair`) to specify that damaged builds should be repaired.

### Attacking Tasks
All attacking flags follow room specific rules on how many attackers to spawn.

*Important note about attack flags:* In order for a room to begin spawning attack creeps, a flag must be present with the room name. All attacker creeps parse flags independent of room name. This is done to prevent wasting CPU bucket by spawning attack creeps in every room. A flag of `W0N0 AttackEnable` can be placed to enable attack spawning of a specific room.

Example: A flag of `W6S30 AttackHostilesHere` is placed, `W6S30` will go into attack creep spawn mode. Room `W7S29` has left over attack creeps from a previous task, these creeps will navigate to the `W6S30 AttackHostilesHere` flag.

- **AttackWaypoint** - Instructs attacking creeps to go to waypoint before going to attack flags.
  - Accepts a number in the 2nd argument (example: `AttackWaypoint 1`) to specify waypoint number.
- **AttackHostilesHere** - Attacks a hostile nearest to the flag using attacker creep.
- **AttackStructureHere** - Attacks a hostile structure nearest to the flag using attacker creep.
- **AttackStructure** - Attacks all structures in the room, sorted by closeness to the flag.
- **AttackHostiles** - Attacks all hostiles in the room, sorted by closeness to the flag.
- **AttackConstruction** - Attacks all constructions in the room, sorted by closeness to the flag.
- **AttackStage** - A block all flag, can be used to temporally pause or instruct creeps to regroup.

### Spawning Flags
- **W0N0 UnlockStack** - Remove restrictions from spawning creeps. Creeps will be spawned with maximum power consumption.

### Lab Flags
Placing any of the factory flags will cause the room to spawn a single factory worker.

- **W0N0 Drain** - Instructs factory worker to drain the terminal into storage.
- **W0N0 Transfer energy W0N1** - Instructs the worker to fill the terminal with the resource provided in the 3rd argument to be sent to the room provided in the 4th argument.
- **W0N0 PrepTransfer W0N0** - *Mainly an internal flag*. This flag instructs the worker to begin prepping the terminal for sending resource by filling it with the required energy for transaction.
- **W0N0 Fill energy 1000** - Instructs the worker to fill the structure placed in 1 tile range of the flag with resource provided in the 3rd argument to the limit of the 4th argument.
- **W0N0 PowerProcess** - Instructs the worker to fill the power spawn with power and energy and process power.