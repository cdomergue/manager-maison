import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'auth_validated';
  private readonly SALT = '3cfafe-';
  private readonly EXPECTED_HASH = '22e9dec89574d434d6bb9746efffccca949826ac';

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    this.checkStoredAuth();
  }

  private checkStoredAuth() {
    const isAuthenticated = localStorage.getItem(this.STORAGE_KEY) === 'true';
    this.isAuthenticatedSubject.next(isAuthenticated);
  }

  async validatePassword(password: string): Promise<boolean> {
    const textToHash = this.SALT + password;
    const msgBuffer = new TextEncoder().encode(textToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const isValid = hashHex === this.EXPECTED_HASH;
    if (isValid) {
      localStorage.setItem(this.STORAGE_KEY, 'true');
      this.isAuthenticatedSubject.next(true);
    }
    return isValid;
  }
}
