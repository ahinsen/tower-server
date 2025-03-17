const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

let currentLogLevel = LOG_LEVELS.INFO; // Default log level

function setLogLevel(level) {
    currentLogLevel = LOG_LEVELS[level.toUpperCase()];
}

function log(level, ...args) {
    if (level >= currentLogLevel) {
        const message = args.join(' ');
        switch (level) {
            case LOG_LEVELS.DEBUG:
                console.log(message);
                break;
            case LOG_LEVELS.INFO:
                console.info(message);
                break;
            case LOG_LEVELS.WARN:
                console.warn(message);
                break;
            case LOG_LEVELS.ERROR:
                console.error(message);
                break;
            default:
                console.log(message);
                break;
        }
    }
}


export { LOG_LEVELS, setLogLevel, log };