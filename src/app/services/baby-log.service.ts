import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { BabyEvent, BabyEventInput } from '../models/baby-event.model';

@Injectable({ providedIn: 'root' })
export class BabyLogService {
  private api = inject(ApiService);
  private storage = inject(StorageService);
  private readonly key = 'baby_events_cache';
  readonly events = signal<BabyEvent[]>(this.storage.getItem<BabyEvent[]>(this.key) || []);
  readonly loading = signal(false);
  readonly cached = signal(true);
  readonly error = signal('');

  async refresh(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      this.store(await firstValueFrom(this.api.get<BabyEvent[]>('/baby-events')));
      this.cached.set(false);
    } catch {
      this.cached.set(true);
      this.error.set(
        'Carnet indisponible. Les données déjà chargées restent consultables. Réessayez avec une connexion.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  async create(input: BabyEventInput): Promise<void> {
    const event = await firstValueFrom(this.api.post<BabyEvent>('/baby-events', input));
    this.store([...this.events(), event]);
  }

  private store(events: BabyEvent[]): void {
    const sorted = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    this.events.set(sorted);
    this.storage.setItem(this.key, sorted);
  }
}
