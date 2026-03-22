import {
  BehaviorSubject,
  Observable,
  Subject,
  debounce,
  filter,
  map,
  take,
} from '../src/index';

describe('Observable', () => {
  it('supports subscribe and unsubscribe', () => {
    const values: number[] = [];
    const subject = new Subject<number>();
    const subscription = subject.subscribe((value) => values.push(value));

    subject.next(1);
    subscription.unsubscribe();
    subject.next(2);

    expect(values).toEqual([1]);
    expect(subscription.closed).toBe(true);
  });

  it('supports pipe with map, filter, and take', () => {
    const results: number[] = [];
    const completed = jest.fn();

    const source = new Observable<number>((observer) => {
      [1, 2, 3, 4, 5].forEach((value) => observer.next(value));
      observer.complete?.();
    });

    source
      .pipe(
        map((value) => value * 2),
        filter((value) => value % 4 === 0),
        take(2),
      )
      .subscribe({
        next: (value) => results.push(value),
        complete: completed,
      });

    expect(results).toEqual([4, 8]);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid emissions and flushes the last value on complete', () => {
    jest.useFakeTimers();

    const results: number[] = [];
    const source = new Subject<number>();

    source.pipe(debounce(50)).subscribe((value) => results.push(value));

    source.next(1);
    jest.advanceTimersByTime(20);
    source.next(2);
    jest.advanceTimersByTime(20);
    source.next(3);
    jest.advanceTimersByTime(49);

    expect(results).toEqual([]);

    jest.advanceTimersByTime(1);
    expect(results).toEqual([3]);

    source.next(4);
    jest.advanceTimersByTime(10);
    source.complete();

    expect(results).toEqual([3, 4]);

    jest.useRealTimers();
  });
});

describe('Subject', () => {
  it('multicasts values to all subscribers', () => {
    const left: string[] = [];
    const right: string[] = [];
    const subject = new Subject<string>();

    subject.subscribe((value) => left.push(value));
    subject.subscribe((value) => right.push(value));

    subject.next('a');
    subject.next('b');

    expect(left).toEqual(['a', 'b']);
    expect(right).toEqual(['a', 'b']);
  });
});

describe('BehaviorSubject', () => {
  it('replays the current value to new subscribers', () => {
    const first: number[] = [];
    const second: number[] = [];
    const subject = new BehaviorSubject<number>(10);

    subject.subscribe((value) => first.push(value));
    subject.next(20);
    subject.subscribe((value) => second.push(value));
    subject.next(30);

    expect(first).toEqual([10, 20, 30]);
    expect(second).toEqual([20, 30]);
    expect(subject.getValue()).toBe(30);
  });
});
