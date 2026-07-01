import * as fs from 'fs';
import * as path from 'path';

let logFilePath: string | null = null;
let loggingEnabled = true;

export function initLogger(pluginDir: string, enabled: boolean): void {
  logFilePath = path.join(pluginDir, 'logs', 'speech2text.log');
  loggingEnabled = enabled;
}

export function setLoggingEnabled(enabled: boolean): void {
  loggingEnabled = enabled;
}

export async function logError(
  context: string,
  error: unknown,
  details?: Record<string, unknown>,
): Promise<void> {
  if (!logFilePath || !loggingEnabled) return;
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const lines = [
    `[${timestamp}] ${context}: ${message}`,
    details ? `  details: ${JSON.stringify(details)}` : null,
    stack ? `  stack: ${stack}` : null,
  ].filter((l): l is string => l !== null);

  try {
    await fs.promises.mkdir(path.dirname(logFilePath), { recursive: true });
    await fs.promises.appendFile(logFilePath, lines.join('\n') + '\n');
  } catch {
    // logging must never throw and break the actual operation
  }
}
