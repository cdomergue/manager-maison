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
    const entry: LogEntry = {
      timestamp: new Date(),
      message,
      details,
    };
    this.logs.update((logs) => [entry, ...logs].slice(0, 50)); // Keep last 50 logs
    console.log('[DebugService]', message, details);
  }

  clear() {
    this.logs.set([]);
  }
}
