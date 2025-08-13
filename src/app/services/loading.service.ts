import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendingRequestsCount = signal<number>(0);
  readonly isLoading = computed(() => this.pendingRequestsCount() > 0);

  startRequest(): void {
    this.pendingRequestsCount.set(this.pendingRequestsCount() + 1);
  }

  endRequest(): void {
    const next = this.pendingRequestsCount() - 1;
    this.pendingRequestsCount.set(next < 0 ? 0 : next);
  }
}
