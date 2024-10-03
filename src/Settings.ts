

export const Settings : SettingsType = {
    username: 'dokman',

    roomCreepCheck: 5,
    roomCreepSpawn: 10,
    roomScan: 50,

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

    dokScreepsRefresh: number,
    dokScreepsMemoryCleanup: number,

    flagScanInternval: number
}
//#endregion