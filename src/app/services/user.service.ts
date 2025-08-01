import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { User, UserType } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly STORAGE_KEY = 'current_user';
  private readonly AVAILABLE_USERS: User[] = [
    { id: 'Christophe', displayName: 'Christophe' },
    { id: 'Laurence', displayName: 'Laurence' }
  ];

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.loadStoredUser();
  }

  private loadStoredUser() {
    const storedUserId = localStorage.getItem(this.STORAGE_KEY);
    if (storedUserId) {
      const user = this.AVAILABLE_USERS.find(u => u.id === storedUserId);
      if (user) {
        this.currentUserSubject.next(user);
      }
    }
  }

  setCurrentUser(userId: UserType) {
    const user = this.AVAILABLE_USERS.find(u => u.id === userId);
    if (user) {
      localStorage.setItem(this.STORAGE_KEY, user.id);
      this.currentUserSubject.next(user);
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getAvailableUsers(): User[] {
    return this.AVAILABLE_USERS;
  }

  isUserSelected(): boolean {
    return this.currentUserSubject.value !== null;
  }
}