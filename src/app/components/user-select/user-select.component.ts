import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-user-select',
  imports: [CommonModule],
  templateUrl: './user-select.component.html',
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
