export abstract class Logger {
    public static Log(namespace : string, ...args : any) {
        const timeNow = new Date();

        console.log.apply(null, [`${timeNow.toLocaleTimeString()} [dokScreeps][${namespace}]`, ...args])
    }

    public static Warn(namespace : string, ...args : any) {
        const timeNow = new Date();

        console.log.apply(null, [`${timeNow.toLocaleTimeString()} <font color="orange">[dokScreeps][${namespace}]`, ...args, '<font/>'])
    }

    public static Error(namespace : string, ...args : any) {
        const timeNow = new Date();

        console.log.apply(null, [`${timeNow.toLocaleTimeString()} <font color="red">[dokScreeps][${namespace}]`, ...args, '<font/>'])
    }
}