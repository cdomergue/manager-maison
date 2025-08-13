import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { AuthComponent } from './components/auth/auth.component';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/tasks/tasks.component').then((m) => m.TasksComponent),
    canActivate: [authGuard],
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
    path: 'notifications',
    loadComponent: () =>
      import('./components/notifications-config/notifications-config.component').then(
        (m) => m.NotificationsConfigComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings.component').then((m) => m.SettingsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./components/category-management/category-management.component').then(
        (m) => m.CategoryManagementComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'auth',
    component: AuthComponent,
  },
];
