export abstract class Logger {
    public static readonly COLOR_RED = '\u001b[31m';
    public static readonly COLOR_GREEN = '\u001b[32m';
    public static readonly COLOR_YELLOW = '\u001b[33m';
    public static readonly COLOR_BLUE = '\u001b[34m';
    public static readonly COLOR_MAGENTA = '\u001b[35m';
    public static readonly COLOR_CYAN = '\u001b[36m';
    public static readonly COLOR_RESET = '\u001b[0m';

    public static Log(namespace : string, ...args : any) {
        const timeNow = new Date();

        console.log.apply(null, [`${timeNow.toLocaleTimeString()} [dokScreeps][${namespace}]`, ...args])
    }

    public static Error(namespace : string, ...args : any) {
        const timeNow = new Date();

        console.error.apply(null, [`${this.COLOR_RED}${timeNow.toLocaleTimeString()} [dokScreeps:ERROR][${namespace}]`, ...args])
    }
}