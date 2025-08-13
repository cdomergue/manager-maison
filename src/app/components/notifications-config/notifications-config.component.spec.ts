import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsConfigComponent } from './notifications-config.component';

describe('NotificationsConfigComponent', () => {
  let component: NotificationsConfigComponent;
  let fixture: ComponentFixture<NotificationsConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsConfigComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
