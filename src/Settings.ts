

export const Settings : SettingsType = {
    username: 'dokman',

    roomCreepCheck: 5,
    roomCreepSpawn: 10,
    roomScan: 50,
    roomHostileScan: 3,
    roomTowerTick: 1,
    roomConstructionTick: 100,
    roomMaxCreepStack: 20,

    dokScreepsRefresh: 4000,
    dokScreepsMemoryCleanup: 1000,

    flagScanInternval: 5
}

//#region Settings Type
export type SettingsType = {
    username: string,

    roomCreepCheck: number,
    roomCreepSpawn: number,
    roomScan: number,
    roomHostileScan: number,
    roomTowerTick: number,
    roomConstructionTick: number,
    roomMaxCreepStack: number,

    dokScreepsRefresh: number,
    dokScreepsMemoryCleanup: number,

    flagScanInternval: number
}
//#endregion