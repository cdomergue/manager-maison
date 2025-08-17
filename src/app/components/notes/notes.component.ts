import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotesService } from '../../services/notes.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';

@Component({
  selector: 'app-notes',
  imports: [CommonModule, FormsModule, RichTextEditorComponent],
  styleUrls: ['./notes.component.css'],
  templateUrl: './notes.component.html',
})
export class NotesComponent {
  private notesService = inject(NotesService);

  title = '';
  content = '';
  editingId: string | null = null;
  editTitle = '';
  editContent = '';

  notes = this.notesService.notes;

  create(): void {
    if (!this.title.trim() && !this.content.trim()) return;
    this.notesService.create({ title: this.title.trim(), content: this.content });
    this.title = '';
    this.content = '';
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
    this.editTitle = title;
    this.editContent = content;
  }

  save(id: string): void {
    this.notesService.update(id, { title: this.editTitle, content: this.editContent });
    this.cancel();
  }

  cancel(): void {
    this.editingId = null;
    this.editTitle = '';
    this.editContent = '';
  }
}
