import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BabyLogService } from '../../services/baby-log.service';
import { BABY_TYPES, DIAPER_TYPES, BabyType, DiaperType, BabyEventInput } from '../../models/baby-event.model';

@Component({
  selector: 'app-baby-log',
  imports: [DatePipe, FormsModule],
  templateUrl: './baby-log.component.html',
  styleUrl: './baby-log.component.css',
})
export class BabyLogComponent implements OnInit {
  readonly log = inject(BabyLogService);
  readonly types = BABY_TYPES;
  readonly diapers = DIAPER_TYPES;
  readonly saving = signal(false);
  readonly message = signal('');
  readonly saveError = signal('');
  type: BabyType = 'breastfeeding';
  diaper: DiaperType = 'nothing';
  occurredAt = this.localNow();
  quantityMl: number | null = null;
  durationMinutes: number | null = null;
  note = '';

  ngOnInit(): void {
    void this.log.refresh();
  }

  localNow(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  label(type: BabyType): string {
    return this.types.find((item) => item.value === type)?.label || type;
  }
  diaperLabel(type: DiaperType): string {
    return this.diapers.find((item) => item.value === type)?.label || type;
  }

  async save(): Promise<void> {
    if (this.saving() || this.log.loading()) return;
    this.saveError.set('');
    this.message.set('');
    const date = new Date(this.occurredAt);
    const amount = this.type.startsWith('bottle-')
      ? this.quantityMl
      : this.type === 'breastfeeding'
        ? this.durationMinutes
        : null;
    if (
      !this.occurredAt ||
      !Number.isFinite(date.getTime()) ||
      (amount !== null && (!Number.isFinite(amount) || amount <= 0)) ||
      (this.type === 'other' && !this.note.trim()) ||
      this.note.length > 2000
    ) {
      this.saveError.set('Vérifiez la date, les valeurs positives et le texte requis pour Divers.');
      return;
    }
    const input: BabyEventInput = { type: this.type, occurredAt: date.toISOString(), note: this.note.trim() };
    if (this.type === 'diaper') input.diaper = this.diaper;
    if (this.type.startsWith('bottle-') && this.quantityMl !== null) input.quantityMl = this.quantityMl;
    if (this.type === 'breastfeeding' && this.durationMinutes !== null) input.durationMinutes = this.durationMinutes;
    this.saving.set(true);
    try {
      await this.log.create(input);
      this.note = '';
      this.quantityMl = null;
      this.durationMinutes = null;
      this.occurredAt = this.localNow();
      this.message.set('Événement enregistré dans le carnet partagé.');
    } catch {
      this.saveError.set(
        'Enregistrement non confirmé. Votre saisie est conservée. Actualisez le carnet avant de réessayer.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
