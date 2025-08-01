import {Routes} from '@angular/router';
import {authGuard} from './guards/auth.guard';
import {AuthComponent} from './components/auth/auth.component';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'notifications',
    loadComponent: () => import('./components/notifications-config/notifications-config.component').then(m => m.NotificationsConfigComponent),
    canActivate: [authGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'auth',
    component: AuthComponent
  }
];
