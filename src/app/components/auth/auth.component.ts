import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth',
  imports: [FormsModule],
  templateUrl: './auth.component.html',
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
