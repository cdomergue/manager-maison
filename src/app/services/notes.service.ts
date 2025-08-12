import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { Note } from '../models/note.model';

@Injectable({ providedIn: 'root' })
export class NotesService {
  private notesSignal = signal<Note[]>([]);
  private useLocalStorageSignal = signal(false);

  readonly notes = this.notesSignal.asReadonly();
  readonly notes$ = toObservable(this.notes);
  readonly useLocalStorage = this.useLocalStorageSignal.asReadonly();

  private readonly STORAGE_KEY = 'shared_notes';
  private api = inject(ApiService);
  private storage = inject(StorageService);

  constructor() {
    setTimeout(() => {
      this.api.getConnectionStatus().subscribe(isConnected => {
        if (isConnected) {
          this.useLocalStorageSignal.set(false);
          this.loadFromAPI();
        } else {
          this.useLocalStorageSignal.set(true);
          this.loadFromLocal();
        }
      });
    }, 500);
  }

  refresh(): void {
    if (this.useLocalStorageSignal()) this.loadFromLocal();
    else this.loadFromAPI(true);
  }

  private loadFromAPI(silent = false): void {
    this.api.getNotes().subscribe({
      next: notes => this.notesSignal.set(notes),
      error: () => {
        this.useLocalStorageSignal.set(true);
        this.loadFromLocal();
      }
    });
  }

  private loadFromLocal(): void {
    const stored = this.storage.getItem<Note[]>(this.STORAGE_KEY);
    if (stored) this.notesSignal.set(stored);
  }

  private saveLocal(): void {
    this.storage.setItem(this.STORAGE_KEY, this.notesSignal());
  }

  create(note: { title: string; content: string }): void {
    if (this.useLocalStorageSignal()) {
      const newNote: Note = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        title: note.title,
        content: note.content,
        ownerId: localStorage.getItem('current_user') || 'anonymous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.notesSignal.set([newNote, ...this.notesSignal()]);
      this.saveLocal();
    } else {
      this.api.createNote({ title: note.title, content: note.content }).subscribe({
        next: created => this.notesSignal.set([created, ...this.notesSignal()]),
        error: () => {
          this.useLocalStorageSignal.set(true);
          this.create(note);
        }
      });
    }
  }

  update(id: string, data: Partial<Pick<Note, 'title' | 'content'>>): void {
    if (this.useLocalStorageSignal()) {
      const updated = this.notesSignal().map(n => n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n);
      this.notesSignal.set(updated);
      this.saveLocal();
    } else {
      this.api.updateNote(id, data).subscribe({
        next: serverNote => {
          const updated = this.notesSignal().map(n => n.id === id ? serverNote : n);
          this.notesSignal.set(updated);
        },
        error: () => {
          this.useLocalStorageSignal.set(true);
          this.update(id, data);
        }
      });
    }
  }

  remove(id: string): void {
    if (this.useLocalStorageSignal()) {
      this.notesSignal.set(this.notesSignal().filter(n => n.id !== id));
      this.saveLocal();
    } else {
      this.api.deleteNote(id).subscribe({
        next: () => this.notesSignal.set(this.notesSignal().filter(n => n.id !== id)),
        error: () => {
          this.useLocalStorageSignal.set(true);
          this.remove(id);
        }
      });
    }
  }

  // partage supprimé
}


