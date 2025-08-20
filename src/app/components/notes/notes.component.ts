import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotesService } from '../../services/notes.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { NoteForm } from '../../models/note.model';

@Component({
  selector: 'app-notes',
  imports: [CommonModule, ReactiveFormsModule, RichTextEditorComponent],
  styleUrls: ['./notes.component.css'],
  templateUrl: './notes.component.html',
})
export class NotesComponent {
  private notesService = inject(NotesService);
  private fb = inject(FormBuilder);

  // Reactive Forms typés
  newNoteForm: NoteForm;
  editNoteForm: NoteForm;

  editingId: string | null = null;
  notes = this.notesService.notes;

  constructor() {
    this.newNoteForm = this.fb.group({
      title: ['', Validators.required],
      content: [''],
    });

    this.editNoteForm = this.fb.group({
      title: ['', Validators.required],
      content: [''],
    });
  }

  create(): void {
    if (this.newNoteForm.invalid) {
      this.newNoteForm.markAllAsTouched();
      return;
    }

    const formValue = this.newNoteForm.value;
    if (!formValue.title?.trim() && !formValue.content?.trim()) return;

    this.notesService.create({
      title: formValue.title?.trim() || '',
      content: formValue.content || '',
    });

    this.newNoteForm.reset();

    // Fermer l'expansion panel si présent
    try {
      const panel = document.querySelector('details') as HTMLDetailsElement | null;
      if (panel) panel.open = false;
    } catch {
      // ignore
    }
  }

  remove(id: string): void {
    this.notesService.remove(id);
  }

  refresh(): void {
    this.notesService.refresh();
  }

  startEdit(id: string, title: string, content: string): void {
    this.editingId = id;
    this.editNoteForm.patchValue({
      title: title,
      content: content,
    });
  }

  save(id: string): void {
    if (this.editNoteForm.invalid) {
      this.editNoteForm.markAllAsTouched();
      return;
    }

    const formValue = this.editNoteForm.value;
    this.notesService.update(id, {
      title: formValue.title!,
      content: formValue.content!,
    });
    this.cancel();
  }

  cancel(): void {
    this.editingId = null;
    this.editNoteForm.reset();
  }
}
