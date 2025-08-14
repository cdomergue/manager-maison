import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-user-select',
  imports: [CommonModule],
  template: `
    @if (!isUserSelected) {
      <div
        class="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 shadow-xl border border-gray-200 dark:border-gray-700"
        >
          <h2 class="text-xl font-bold mb-6 text-center text-gray-900 dark:text-white">Qui êtes-vous ?</h2>
          <div class="space-y-3">
            @for (user of availableUsers; track user.id) {
              <button
                (click)="selectUser(user)"
                class="w-full py-3 px-4 text-lg rounded-lg border-2 border-gray-300 dark:border-gray-600 
                       text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 
                       transition-all hover:border-blue-500 dark:hover:border-blue-400 
                       hover:bg-blue-50 dark:hover:bg-blue-900/20
                       focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                {{ user.displayName }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class UserSelectComponent implements OnInit {
  isUserSelected = false;
  availableUsers: User[] = [];

  private userService = inject(UserService);

  ngOnInit() {
    this.availableUsers = this.userService.getAvailableUsers();
    this.userService.currentUser$.subscribe((user) => (this.isUserSelected = !!user));
  }

  selectUser(user: User) {
    this.userService.setCurrentUser(user.id);
  }
}
