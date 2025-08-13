import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-user-select',
  imports: [CommonModule],
  template: `
    @if (!isUserSelected) {
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
          <h2 class="text-xl font-bold mb-6 text-center">Qui êtes-vous ?</h2>
          <div class="space-y-3">
            @for (user of availableUsers; track user.id) {
              <button
                (click)="selectUser(user)"
                class="w-full py-3 px-4 text-lg rounded-lg border-2 transition-all
                       hover:border-blue-500 hover:bg-blue-50
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
