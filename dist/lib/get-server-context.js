/**
 * Server Context - Gill template pattern
 * Centralized dependency injection for the server
 */
import { getServerConfig } from './get-server-config.js';
import { log } from './api-logger.js';
let context;
export function getServerContext() {
    if (context) {
        return context;
    }
    const config = getServerConfig();
    context = {
        config,
        log,
    };
    return context;
}
//# sourceMappingURL=get-server-context.js.map