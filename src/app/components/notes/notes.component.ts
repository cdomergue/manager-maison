import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { form, Field, submit, required, FieldTree } from '@angular/forms/signals';
import { NotesService } from '../../services/notes.service';

interface NoteFormModel {
  title: string;
  content: string;
}

@Component({
  selector: 'app-notes',
  imports: [CommonModule, Field],
  styleUrls: ['./notes.component.css'],
  templateUrl: './notes.component.html',
})
export class NotesComponent {
  private notesService = inject(NotesService);

  private newNoteModel = signal<NoteFormModel>({ title: '', content: '' });
  newNoteForm: FieldTree<NoteFormModel> = form(this.newNoteModel, (p) => {
    required(p.title);
  });

  private editNoteModel = signal<NoteFormModel>({ title: '', content: '' });
  editNoteForm: FieldTree<NoteFormModel> = form(this.editNoteModel, (p) => {
    required(p.title);
  });

  editingId: string | null = null;
  notes = this.notesService.notes;

  create(): void {
    submit(this.newNoteForm, async () => {
      const formValue = this.newNoteModel();
      if (!formValue.title?.trim() && !formValue.content?.trim()) return;

      this.notesService.create({
        title: formValue.title?.trim() || '',
        content: formValue.content || '',
      });

      this.newNoteModel.set({ title: '', content: '' });
      this.newNoteForm().reset();

      try {
        const panel = document.querySelector('details') as HTMLDetailsElement | null;
        if (panel) panel.open = false;
      } catch {
        // ignore
      }
    });
  }

  remove(id: string): void {
    this.notesService.remove(id);
  }

  refresh(): void {
    this.notesService.refresh();
  }

  startEdit(id: string, title: string, content: string): void {
    this.editingId = id;
    this.editNoteModel.set({ title, content });
    this.editNoteForm().reset();
  }

  save(id: string): void {
    submit(this.editNoteForm, async () => {
      const formValue = this.editNoteModel();
      this.notesService.update(id, {
        title: formValue.title,
        content: formValue.content,
      });
      this.cancel();
    });
  }

  cancel(): void {
    this.editingId = null;
    this.editNoteModel.set({ title: '', content: '' });
    this.editNoteForm().reset();
  }
}
