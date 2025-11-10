/**
 * Server Context - Gill template pattern
 * Centralized dependency injection for the server
 */
import { ServerConfig } from './get-server-config.js';
import { ApiLogger } from './api-logger.js';
export interface ServerContext {
    config: ServerConfig;
    log: ApiLogger;
}
export declare function getServerContext(): ServerContext;
//# sourceMappingURL=get-server-context.d.ts.map