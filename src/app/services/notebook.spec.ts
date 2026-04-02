import { TestBed } from '@angular/core/testing';

import { Notebook } from './notebook';

describe('Notebook', () => {
  let service: Notebook;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Notebook);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
