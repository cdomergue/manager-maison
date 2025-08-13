import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-100 flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 class="text-2xl font-bold mb-6 text-center">Authentification requise</h2>
        <form (ngSubmit)="onSubmit()" #authForm="ngForm">
          <div class="mb-4">
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              class="w-full px-4 py-3 border rounded-lg"
              placeholder="Mot de passe"
              required
            />
          </div>
          @if (error) {
            <div class="text-red-500 mb-4 text-center">
              {{ error }}
            </div>
          }
          <button
            type="submit"
            class="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors"
            [disabled]="!password"
          >
            Valider
          </button>
        </form>
      </div>
    </div>
  `,
})
export class AuthComponent {
  password = '';
  error = '';
  isAuthenticated = false;

  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.authService.isAuthenticated$.subscribe((isAuth) => {
      this.isAuthenticated = isAuth;
      if (isAuth) {
        this.router.navigate(['/']);
      }
    });
  }

  async onSubmit() {
    if (!this.password) return;

    try {
      const isValid = await this.authService.validatePassword(this.password);
      if (!isValid) {
        this.error = 'Mot de passe incorrect';
      }
    } catch {
      this.error = 'Une erreur est survenue';
    }
    this.password = '';
  }
}
