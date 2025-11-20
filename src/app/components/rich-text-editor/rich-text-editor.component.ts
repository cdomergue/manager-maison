import {
  Component,
  ElementRef,
  forwardRef,
  input,
  output,
  ViewChild,
  ViewEncapsulation,
  AfterViewInit,
} from '@angular/core';

import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-rich-text-editor',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './rich-text-editor.component.html',
  styles: [
    `
      [data-placeholder]:empty::before {
        content: attr(data-placeholder);
        color: oklch(70.7% 0.022 261.325);
        pointer-events: none;
      }
      [data-placeholder]:empty {
        position: relative;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
})
export class RichTextEditorComponent implements ControlValueAccessor, AfterViewInit {
  placeholder = input<string>('Tapez votre contenu...');
  minHeight = input<string>('128px');

  contentChange = output<string>();

  @ViewChild('editor') editorRef?: ElementRef<HTMLElement>;

  content = '';
  private pendingValue: string | null = null;

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

  private onChange: (value: string) => void = () => {
    // Implemented via ControlValueAccessor
  };
  private onTouched: () => void = () => {
    // Implemented via ControlValueAccessor
  };

  get editor(): HTMLElement | null {
    return this.editorRef?.nativeElement || null;
  }

  ngAfterViewInit(): void {
    // Si nous avons une valeur en attente, l'appliquer maintenant
    if (this.pendingValue !== null) {
      this.writeValue(this.pendingValue);
      this.pendingValue = null;
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.content = value || '';
    if (this.editor) {
      this.editor.innerHTML = this.content;

      // Si la valeur est vide, s'assurer que l'éditeur est complètement vide pour le placeholder
      if (!this.content.trim()) {
        this.editor.innerHTML = '';
      }
    } else {
      // Si l'éditeur n'est pas encore prêt, stocker la valeur pour plus tard
      this.pendingValue = this.content;
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.editor) {
      this.editor.contentEditable = isDisabled ? 'false' : 'true';
    }
  }

  format(command: string, value?: string): void {
    if (!this.editor) return;
    this.editor.focus();
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
    this.updateToolbarState();
  }

  insertLink(): void {
    if (!this.editor) return;
    this.editor.focus();
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

    this.sanitizeLinks();
    this.onEditorInput();
  }

  unlink(): void {
    if (!this.editor) return;
    this.editor.focus();
    try {
      document.execCommand('unlink');
    } catch {
      void 0;
    }
    this.onEditorInput();
  }

  private sanitizeLinks(): void {
    if (!this.editor) return;
    const anchors = Array.from(this.editor.querySelectorAll('a')) as HTMLAnchorElement[];
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

  onEditorInput(): void {
    if (!this.editor) return;

    this.content = this.editor.innerHTML;

    // Vérifier si le contenu est réellement vide (ignorer les balises vides et espaces)
    const textContent = this.editor.textContent || '';
    const isContentEmpty = textContent.trim() === '';

    // Si le contenu est vide, nettoyer complètement l'éditeur pour que le placeholder fonctionne
    if (isContentEmpty) {
      this.editor.innerHTML = '';
      this.content = '';
    }

    this.onChange(this.content);
    this.onTouched();
    this.contentChange.emit(this.content);
    this.updateToolbarState();
  }

  private updateToolbarState(): void {
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
      while (node && node !== this.editor) {
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

  onEditorFocus(): void {
    this.updateToolbarState();
  }
}
