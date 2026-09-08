import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BabyLogComponent } from './baby-log.component';
import { BabyLogService } from '../../services/baby-log.service';

describe('BabyLogComponent', () => {
  let component: BabyLogComponent;
  let create: jasmine.Spy;

  beforeEach(() => {
    create = jasmine.createSpy('create').and.resolveTo();
    TestBed.configureTestingModule({
      providers: [{ provide: BabyLogService, useValue: { create, loading: signal(false) } }],
    });
    component = TestBed.runInInjectionContext(() => new BabyLogComponent());
    component.occurredAt = '2026-09-07T14:25';
  });

  it('saves backdated feeding without optional duration', async () => {
    await component.save();
    const input = create.calls.mostRecent().args[0];
    expect(input.occurredAt).toBe(new Date('2026-09-07T14:25').toISOString());
    expect(input.durationMinutes).toBeUndefined();
    expect(component.message()).toContain('enregistré');
  });

  it('omits hidden fields after changing event type', async () => {
    component.type = 'bottle-breast-milk';
    component.durationMinutes = 10;
    component.quantityMl = 80;
    await component.save();
    expect(create.calls.mostRecent().args[0].quantityMl).toBe(80);
    expect(create.calls.mostRecent().args[0].durationMinutes).toBeUndefined();
  });

  it('requires text for divers and positive optional amounts', async () => {
    component.type = 'other';
    component.note = '  ';
    await component.save();
    expect(create).not.toHaveBeenCalled();
    component.type = 'breast-left';
    component.durationMinutes = -2;
    await component.save();
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps input on failed persistence', async () => {
    create.and.rejectWith(new Error('offline'));
    component.note = 'Après le bain';
    await component.save();
    expect(component.note).toBe('Après le bain');
    expect(component.occurredAt).toBe('2026-09-07T14:25');
    expect(component.saveError()).toContain('saisie est conservée');
    expect(component.saving()).toBeFalse();
  });
});
