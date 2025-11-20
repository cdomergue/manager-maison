import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { AuthComponent } from './components/auth/auth.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'shopping',
    pathMatch: 'full',
  },
  {
    path: 'shopping',
    loadComponent: () =>
      import('./components/shopping-list/shopping-list.component').then((m) => m.ShoppingListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'notes',
    loadComponent: () => import('./components/notes/notes.component').then((m) => m.NotesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'recipes',
    loadComponent: () => import('./components/recipes/recipes.component').then((m) => m.RecipesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'reminder-notes',
    loadComponent: () =>
      import('./components/reminder-notes/reminder-notes.component').then((m) => m.ReminderNotesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'auth',
    component: AuthComponent,
  },
];
