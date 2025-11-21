import { Injectable, signal } from '@angular/core';

export interface LogEntry {
  timestamp: Date;
  message: string;
  details?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class DebugService {
  logs = signal<LogEntry[]>([]);

  log(message: string, details?: unknown) {
    let safeDetails = details;

    if (details instanceof Error) {
      safeDetails = {
        name: details.name,
        message: details.message,
        stack: details.stack,
      };
    } else if (typeof details === 'object' && details !== null) {
      // Handle objects that might not be plain JSON (like DOMExceptions)
      try {
        // Test if it stringifies
        JSON.stringify(details);
      } catch {
        // If circular or not stringifiable, try to extract meaningful props
        safeDetails = String(details);
      }
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      message,
      details: safeDetails,
    };
    this.logs.update((logs) => [entry, ...logs].slice(0, 50)); // Keep last 50 logs
    console.log('[DebugService]', message, details);
  }

  clear() {
    this.logs.set([]);
  }
}
