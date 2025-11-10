/**
 * API Logger - Gill template pattern
 * Structured logging for the application
 */
function formatMessage(level, message, args) {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + JSON.stringify(args) : '';
    return `${timestamp} [${level}] ${message}${argsStr}`;
}
export const log = {
    debug: (message, ...args) => {
        console.debug(formatMessage('DEBUG', message, args));
    },
    info: (message, ...args) => {
        console.log(formatMessage('INFO', message, args));
    },
    warn: (message, ...args) => {
        console.warn(formatMessage('WARN', message, args));
    },
    error: (message, ...args) => {
        console.error(formatMessage('ERROR', message, args));
    },
};
//# sourceMappingURL=api-logger.js.map