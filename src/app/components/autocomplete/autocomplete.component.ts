import {
  Component,
  computed,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface AutocompleteOption {
  id: string;
  name: string;
  category?: string;
}

@Component({
  selector: 'app-autocomplete',
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteComponent),
      multi: true,
    },
  ],
  templateUrl: './autocomplete.component.html',
})
export class AutocompleteComponent implements ControlValueAccessor {
  @Input() options: AutocompleteOption[] = [];
  @Input() placeholder = '';
  @Output() optionSelected = new EventEmitter<AutocompleteOption>();
  @ViewChild('inputElement') inputElement!: ElementRef<HTMLInputElement>;

  inputValue = signal<string>('');
  showDropdown = signal<boolean>(false);
  highlightedIndex = signal<number>(-1);
  selectedOption = signal<AutocompleteOption | null>(null);

  private onChange: (value: string) => void = () => {
    // Implemented via ControlValueAccessor
  };
  private onTouched: () => void = () => {
    // Implemented via ControlValueAccessor
  };

  filteredOptions = computed(() => {
    const query = this.inputValue().toLowerCase().trim();
    if (!query) return this.options;

    return this.options.filter(
      (option) => option.name.toLowerCase().includes(query) || option.category?.toLowerCase().includes(query) || false,
    );
  });

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    this.inputValue.set(value);
    this.showDropdown.set(true);
    this.highlightedIndex.set(-1);
    this.selectedOption.set(null);
    this.onChange(value);
  }

  onFocus(): void {
    this.showDropdown.set(true);
  }

  onBlur(): void {
    // Petit délai pour permettre le clic sur une option
    setTimeout(() => {
      this.showDropdown.set(false);
      this.onTouched();
    }, 150);
  }

  onKeydown(event: KeyboardEvent): void {
    const filtered = this.filteredOptions();

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = Math.min(this.highlightedIndex() + 1, filtered.length - 1);
        this.highlightedIndex.set(nextIndex);
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        const prevIndex = Math.max(this.highlightedIndex() - 1, -1);
        this.highlightedIndex.set(prevIndex);
        break;
      }

      case 'Enter': {
        event.preventDefault();
        const highlighted = this.highlightedIndex();
        if (highlighted >= 0 && filtered[highlighted]) {
          this.selectOption(filtered[highlighted]);
        }
        break;
      }

      case 'Escape':
        this.showDropdown.set(false);
        this.highlightedIndex.set(-1);
        this.inputElement.nativeElement.blur();
        break;
    }
  }

  selectOption(option: AutocompleteOption): void {
    this.selectedOption.set(option);
    this.inputValue.set(option.name);
    this.showDropdown.set(false);
    this.highlightedIndex.set(-1);
    this.onChange(option.id);
    this.optionSelected.emit(option);
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    if (value) {
      const option = this.options.find((opt) => opt.id === value);
      if (option) {
        this.inputValue.set(option.name);
        this.selectedOption.set(option);
      } else {
        this.inputValue.set(value);
      }
    } else {
      this.inputValue.set('');
      this.selectedOption.set(null);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(): void {
    // Implementation si nécessaire
  }

  // Méthode pour réinitialiser le composant
  clear(): void {
    this.inputValue.set('');
    this.selectedOption.set(null);
    this.showDropdown.set(false);
    this.highlightedIndex.set(-1);
    this.onChange('');
  }
}
