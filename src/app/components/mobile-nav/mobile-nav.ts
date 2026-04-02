import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mobile-nav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mobile-nav.html',
  styleUrls: ['./mobile-nav.css']
})
export class MobileNavComponent {
  @Input() currentRoute = '';
  @Input() notebookCount = 0;
  @Input() trashCount = 0;
  @Output() openTrashModal = new EventEmitter<void>();
  @Output() toggleTheme = new EventEmitter<void>();

  constructor(private router: Router) {}

  navigateToHome() {
    this.router.navigate(['/']);
  }

  isActive(route: string): boolean {
    return this.currentRoute === route;
  }
}
