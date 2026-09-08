import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BabyLogService } from './baby-log.service';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { BabyEvent } from '../models/baby-event.model';

describe('BabyLogService', () => {
  const earlier: BabyEvent = {
    id: '1',
    type: 'vomit',
    occurredAt: '2026-09-07T10:00:00.000Z',
    createdAt: '2026-09-08T10:00:00.000Z',
  };
  const later: BabyEvent = { ...earlier, id: '2', type: 'regurgitation', occurredAt: '2026-09-08T10:00:00.000Z' };
  let service: BabyLogService;
  let get: jasmine.Spy;
  let post: jasmine.Spy;
  let setItem: jasmine.Spy;
  beforeEach(() => {
    get = jasmine.createSpy().and.returnValue(of([earlier, later]));
    post = jasmine.createSpy().and.returnValue(of(earlier));
    setItem = jasmine.createSpy();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { get, post } },
        { provide: StorageService, useValue: { getItem: () => [later], setItem } },
      ],
    });
    service = TestBed.inject(BabyLogService);
  });
  it('sorts by occurrence and caches server data', async () => {
    await service.refresh();
    expect(service.events().map((event) => event.id)).toEqual(['2', '1']);
    expect(setItem).toHaveBeenCalled();
    expect(service.cached()).toBeFalse();
  });
  it('retains cached history when the server is unavailable', async () => {
    get.and.returnValue(throwError(() => new Error('offline')));
    await service.refresh();
    expect(service.events()).toEqual([later]);
    expect(service.cached()).toBeTrue();
    expect(service.error()).toBeTruthy();
  });
  it('inserts a backdated event chronologically only after server confirmation', async () => {
    await service.create(earlier);
    expect(service.events().map((event) => event.id)).toEqual(['2', '1']);
    post.and.returnValue(throwError(() => new Error('offline')));
    await expectAsync(service.create(later)).toBeRejected();
    expect(service.events().length).toBe(2);
  });
});
