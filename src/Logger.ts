export abstract class Logger {
    public static Log(namespace : string, ...args : any) {
        const timeNow = new Date();

        console.log.apply(null, [`${timeNow.toLocaleTimeString()} [dokScreeps][${namespace}]`, ...args])
    }
}