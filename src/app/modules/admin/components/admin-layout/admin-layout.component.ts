import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

const DESKTOP_MQ = '(min-width: 1024px)';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  /** Open by default on desktop; closed on phones/tablets. */
  sidebarOpen = typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches;
  private sub = new Subscription();
  private mq?: MediaQueryList;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.mq = window.matchMedia(DESKTOP_MQ);
    const onMq = () => {
      this.sidebarOpen = this.mq!.matches;
    };
    this.mq.addEventListener('change', onMq);

    this.sub.add(
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
        if (!this.mq?.matches) {
          this.sidebarOpen = false;
        }
      })
    );

    this.sub.add({
      unsubscribe: () => this.mq?.removeEventListener('change', onMq)
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  get isDesktop(): boolean {
    return !!this.mq?.matches;
  }
}
