import {Component, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {UserSelectComponent} from './components/user-select/user-select.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UserSelectComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Manager de la maison');
}
