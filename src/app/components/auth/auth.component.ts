import { Component, inject } from '@angular/core';
import { form, Field, submit, required } from '@angular/forms/signals';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  imports: [Field],
  templateUrl: './auth.component.html',
})
export class AuthComponent {
  error = '';

  private authModel = signal({ password: '' });
  authForm = form(this.authModel, (p) => {
    required(p.password);
  });

  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.authService.isAuthenticated$.subscribe((isAuth) => {
      if (isAuth) {
        this.router.navigate(['/']);
      }
    });
  }

  onSubmit() {
    submit(this.authForm, async () => {
      try {
        const isValid = await this.authService.validatePassword(this.authModel().password);
        if (!isValid) {
          this.error = 'Mot de passe incorrect';
        }
      } catch {
        this.error = 'Une erreur est survenue';
      }
      this.authModel.set({ password: '' });
      this.authForm().reset();
    });
  }
}
