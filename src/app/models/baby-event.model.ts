export const BABY_TYPES = [
  { value: 'breastfeeding', label: 'Tétée' },
  { value: 'bottle-breast-milk', label: 'Biberon · lait maternel' },
  { value: 'bottle-formula', label: 'Biberon · lait maternisé' },
  { value: 'diaper', label: 'Changement de couche' },
  { value: 'vomit', label: 'Vomissement' },
  { value: 'regurgitation', label: 'Régurgitation' },
  { value: 'care', label: 'Soin' },
  { value: 'bath', label: 'Bain' },
  { value: 'other', label: 'Divers' },
] as const;
export const DIAPER_TYPES = [
  { value: 'nothing', label: 'Rien' },
  { value: 'urine', label: 'Urine' },
  { value: 'stool', label: 'Selle' },
  { value: 'abundant-stool', label: 'Selle abondante' },
  { value: 'urine-stool', label: 'Urine et selle' },
  { value: 'urine-abundant-stool', label: 'Urine et selle abondante' },
] as const;
export type BabyType = (typeof BABY_TYPES)[number]['value'];
export type DiaperType = (typeof DIAPER_TYPES)[number]['value'];
export interface BabyEventInput {
  type: BabyType;
  occurredAt: string;
  diaper?: DiaperType;
  quantityMl?: number;
  durationMinutes?: number;
  note?: string;
}
export interface BabyEvent extends BabyEventInput {
  id: string;
  createdAt: string;
}
