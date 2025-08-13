import { Component, ElementRef, inject, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotesService } from '../../services/notes.service';

@Component({
  selector: 'app-notes',

  imports: [CommonModule, FormsModule],
  encapsulation: ViewEncapsulation.None,
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

  @ViewChild('createEditor') createEditorRef?: ElementRef<HTMLElement>;
  @ViewChild('editEditor') editEditorRef?: ElementRef<HTMLElement>;

  notes = this.notesService.notes;

  // Toolbar reactive state
  toolbar = {
    bold: false,
    italic: false,
    strike: false,
    ul: false,
    ol: false,
    block: 'P',
    link: false,
  };

  private activeEditor: 'create' | 'edit' = 'create';

  create(): void {
    if (!this.title.trim() && !this.content.trim()) return;
    // Récupérer le HTML actuel depuis l'éditeur pour éviter toute inversion liée au binding
    const currentHtml = this.createEditor?.innerHTML ?? this.content;
    this.notesService.create({ title: this.title.trim(), content: currentHtml });
    this.title = '';
    this.content = '';
    if (this.createEditor) this.createEditor.innerHTML = '';
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
    setTimeout(() => {
      if (this.editEditor) this.editEditor.innerHTML = this.editContent || '';
    });
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

  get createEditor(): HTMLElement | null {
    return this.createEditorRef?.nativeElement || null;
  }

  get editEditor(): HTMLElement | null {
    return this.editEditorRef?.nativeElement || null;
  }

  getCurrentEditor(): HTMLElement | null {
    return this.activeEditor === 'create' ? this.createEditor : this.editEditor;
  }

  setActiveEditor(which: 'create' | 'edit'): void {
    this.activeEditor = which;
    this.onEditorInput(this.getCurrentEditor());
  }

  format(editor: HTMLElement | null, command: string, value?: string): void {
    if (!editor) return;
    editor.focus();
    try {
      if (command === 'formatBlock' && value) {
        const ok = document.execCommand('formatBlock', false, value);
        if (!ok) {
          document.execCommand('formatBlock', false, `<${value.toLowerCase()}>`);
        }
      } else {
        document.execCommand(command, false, value);
      }
    } catch {
      void 0;
    }
  }

  insertLink(editor: HTMLElement | null): void {
    if (!editor) return;
    editor.focus();
    const raw = window.prompt('URL du lien (http(s)://...)')?.trim();
    if (!raw) return;
    let href = raw;
    if (!/^https?:\/\//i.test(href)) {
      href = `https://${href}`;
    }
    try {
      const url = new URL(href);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
      href = url.href;
    } catch {
      return;
    }

    const selection = window.getSelection();
    const hasSelection = !!selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed;
    try {
      if (hasSelection) {
        document.execCommand('createLink', false, href);
      } else {
        const anchorHtml = `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`;
        document.execCommand('insertHTML', false, anchorHtml);
      }
    } catch {
      void 0;
    }

    this.sanitizeLinks(editor);
    this.onEditorInput(editor);
  }

  unlink(editor: HTMLElement | null): void {
    if (!editor) return;
    editor.focus();
    try {
      document.execCommand('unlink');
    } catch {
      void 0;
    }
    this.onEditorInput(editor);
  }

  private sanitizeLinks(root: HTMLElement): void {
    const anchors = Array.from(root.querySelectorAll('a')) as HTMLAnchorElement[];
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      if (!href) {
        a.replaceWith(...Array.from(a.childNodes));
        continue;
      }
      try {
        const url = new URL(href, window.location.origin);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          a.replaceWith(...Array.from(a.childNodes));
          continue;
        }
        a.href = url.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } catch {
        a.replaceWith(...Array.from(a.childNodes));
      }
    }
  }

  onEditorInput(editor: HTMLElement | null): void {
    if (!editor) return;
    // Sauvegarder le contenu dans le bon buffer
    if (this.activeEditor === 'create') {
      this.content = editor.innerHTML;
    } else {
      this.editContent = editor.innerHTML;
    }

    // Rafraîchir l'état des boutons via queryCommandState et le bloc via queryCommandValue
    try {
      this.toolbar.bold = document.queryCommandState('bold');
      this.toolbar.italic = document.queryCommandState('italic');
      this.toolbar.strike = document.queryCommandState('strikeThrough');
      this.toolbar.ul = document.queryCommandState('insertUnorderedList');
      this.toolbar.ol = document.queryCommandState('insertOrderedList');
      const block = (document.queryCommandValue('formatBlock') || '').toString().toUpperCase();
      if (block.includes('H1')) this.toolbar.block = 'H1';
      else if (block.includes('H2')) this.toolbar.block = 'H2';
      else if (block.includes('H3')) this.toolbar.block = 'H3';
      else this.toolbar.block = 'P';
    } catch {
      void 0;
    }

    // Déterminer si la sélection courante est dans un lien
    try {
      const sel = window.getSelection();
      let node: Node | null | undefined = sel?.anchorNode || null;
      let inLink = false;
      while (node && node !== editor) {
        if ((node as HTMLElement).nodeName === 'A') {
          inLink = true;
          break;
        }
        node = node.parentNode;
      }
      this.toolbar.link = inLink;
    } catch {
      void 0;
    }
  }
}
