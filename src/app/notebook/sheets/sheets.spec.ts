import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Sheets } from './sheets';

describe('Sheets', () => {
  let component: Sheets;
  let fixture: ComponentFixture<Sheets>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sheets],
    }).compileComponents();

    fixture = TestBed.createComponent(Sheets);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
