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
    expect(input.type).toBe('breastfeeding');
    expect(input.durationMinutes).toBeUndefined();
    expect(component.message()).toContain('enregistré');
  });

  it('offers one feeding choice', () => {
    expect(component.types.filter((item) => item.label === 'Tétée').length).toBe(1);
    expect(
      component.types.some(
        (item) => item.value === ('breast-left' as string) || item.value === ('breast-right' as string),
      ),
    ).toBeFalse();
    expect(component.label('breastfeeding')).toBe('Tétée');
  });

  it('saves a feeding with optional duration', async () => {
    component.durationMinutes = 12;
    await component.save();
    expect(create.calls.mostRecent().args[0].type).toBe('breastfeeding');
    expect(create.calls.mostRecent().args[0].durationMinutes).toBe(12);
  });

  it('saves distinct care and bath events with common fields only', async () => {
    for (const type of ['care', 'bath'] as const) {
      component.type = type;
      component.note = 'Après le repas';
      component.durationMinutes = 12;
      component.quantityMl = 80;
      await component.save();
      const input = create.calls.mostRecent().args[0];
      expect(input.type).toBe(type);
      expect(input.note).toBe('Après le repas');
      expect(input.durationMinutes).toBeUndefined();
      expect(input.quantityMl).toBeUndefined();
    }
    expect(component.label('care')).toBe('Soin');
    expect(component.label('bath')).toBe('Bain');
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
    component.type = 'breastfeeding';
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
