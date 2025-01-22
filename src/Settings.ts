

export const Settings : SettingsType = {
    username: 'dokman',

    roomCreepCheck: 5,
    roomCreepSpawn: 10,
    roomScan: 50,
    roomHostileScan: 3,
    roomTowerTick: 1,
    roomConstructionTick: 100,
    roomMaxCreepStack: 20,
    roomNukeCheck: 1000,

    roomControllerSign: [
        'Don\'t test in prod! Unless it is on Screeps...?',
        'Hi mom!',
        'If a creep dies and nobody hears it does it make a sound?',
        'Send source code 😏',
        'Send pixels 😏',
        '$19 Fornite card, who wants it?',
        'Because of Screeps, I sit at my desk way too long',
        'Wasting CPU since 2023',
        'Overmind? 🤢',
        'shard4 when?',
        'sudo rm -rf /'
    ],
    roomControllerSignCheck: 60,

    remUseCan: false,

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
    roomNukeCheck: number,

    roomControllerSign: Array<string> | string | undefined,
    roomControllerSignCheck: number,

    remUseCan: boolean,

    dokScreepsRefresh: number,
    dokScreepsMemoryCleanup: number,

    flagScanInternval: number
}
//#endregion