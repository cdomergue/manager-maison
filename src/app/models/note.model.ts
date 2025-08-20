export interface Note {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

// Types pour les Reactive Forms typés
import { FormControl, FormGroup } from '@angular/forms';

export type NoteForm = FormGroup<{
  title: FormControl<string | null>;
  content: FormControl<string | null>;
}>;
