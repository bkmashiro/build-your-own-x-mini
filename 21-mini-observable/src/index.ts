export type TeardownLogic = void | (() => void) | Subscription;

export interface Observer<T> {
  next: (value: T) => void;
  error?: (error: unknown) => void;
  complete?: () => void;
}

export type PartialObserver<T> = Partial<Observer<T>>;
export type Subscriber<T> = (value: T) => void;
export type OperatorFunction<T, R> = (source: Observable<T>) => Observable<R>;

function isObserver<T>(value: PartialObserver<T> | Subscriber<T>): value is PartialObserver<T> {
  return typeof value === 'object' && value !== null;
}

function toObserver<T>(
  observerOrNext?: PartialObserver<T> | Subscriber<T>,
  error?: (error: unknown) => void,
  complete?: () => void,
): PartialObserver<T> {
  if (!observerOrNext) {
    return {};
  }

  if (isObserver(observerOrNext)) {
    return observerOrNext;
  }

  return {
    next: observerOrNext,
    error,
    complete,
  };
}

export class Subscription {
  private teardowns = new Set<() => void>();
  public closed = false;

  add(teardown?: TeardownLogic): void {
    if (!teardown || teardown === this) {
      return;
    }

    if (teardown instanceof Subscription) {
      this.teardowns.add(() => teardown.unsubscribe());
      return;
    }

    this.teardowns.add(teardown);
  }

  unsubscribe(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    const teardowns = Array.from(this.teardowns);
    this.teardowns.clear();

    for (const teardown of teardowns) {
      teardown();
    }
  }
}

export class Observable<T> {
  constructor(private readonly init: (observer: Observer<T>) => TeardownLogic) {}

  subscribe(
    observerOrNext?: PartialObserver<T> | Subscriber<T>,
    error?: (error: unknown) => void,
    complete?: () => void,
  ): Subscription {
    const destination = toObserver(observerOrNext, error, complete);
    const subscription = new Subscription();

    const observer: Observer<T> = {
      next: (value) => {
        if (subscription.closed || !destination.next) {
          return;
        }

        destination.next(value);
      },
      error: (err) => {
        if (subscription.closed) {
          return;
        }

        destination.error?.(err);
        subscription.unsubscribe();
      },
      complete: () => {
        if (subscription.closed) {
          return;
        }

        destination.complete?.();
        subscription.unsubscribe();
      },
    };

    const teardown = this.init(observer);
    subscription.add(teardown);

    return subscription;
  }

  pipe(): Observable<T>;
  pipe<A>(op1: OperatorFunction<T, A>): Observable<A>;
  pipe<A, B>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): Observable<B>;
  pipe<A, B, C>(
    op1: OperatorFunction<T, A>,
    op2: OperatorFunction<A, B>,
    op3: OperatorFunction<B, C>,
  ): Observable<C>;
  pipe<A, B, C, D>(
    op1: OperatorFunction<T, A>,
    op2: OperatorFunction<A, B>,
    op3: OperatorFunction<B, C>,
    op4: OperatorFunction<C, D>,
  ): Observable<D>;
  pipe(...operators: Array<OperatorFunction<any, any>>): Observable<unknown> {
    return operators.reduce(
      (current, operator) => operator(current),
      this as unknown as Observable<unknown>,
    );
  }
}

export class Subject<T> extends Observable<T> implements Observer<T> {
  protected observers = new Set<Observer<T>>();
  protected isStopped = false;
  protected hasError = false;
  protected thrownError: unknown;

  constructor() {
    super((observer) => {
      if (this.hasError) {
        observer.error?.(this.thrownError);
        return;
      }

      if (this.isStopped) {
        observer.complete?.();
        return;
      }

      this.observers.add(observer);
      return () => {
        this.observers.delete(observer);
      };
    });
  }

  next(value: T): void {
    if (this.isStopped) {
      return;
    }

    for (const observer of Array.from(this.observers)) {
      observer.next(value);
    }
  }

  error(error: unknown): void {
    if (this.isStopped) {
      return;
    }

    this.hasError = true;
    this.thrownError = error;
    this.isStopped = true;

    for (const observer of Array.from(this.observers)) {
      observer.error?.(error);
    }

    this.observers.clear();
  }

  complete(): void {
    if (this.isStopped) {
      return;
    }

    this.isStopped = true;

    for (const observer of Array.from(this.observers)) {
      observer.complete?.();
    }

    this.observers.clear();
  }
}

export class BehaviorSubject<T> extends Subject<T> {
  constructor(private currentValue: T) {
    super();
  }

  override subscribe(
    observerOrNext?: PartialObserver<T> | Subscriber<T>,
    error?: (error: unknown) => void,
    complete?: () => void,
  ): Subscription {
    const subscription = super.subscribe(observerOrNext, error, complete);
    if (!subscription.closed) {
      const observer = toObserver(observerOrNext, error, complete);
      observer.next?.(this.currentValue);
    }
    return subscription;
  }

  override next(value: T): void {
    this.currentValue = value;
    super.next(value);
  }

  getValue(): T {
    return this.currentValue;
  }
}

export function map<T, R>(project: (value: T, index: number) => R): OperatorFunction<T, R> {
  return (source) =>
    new Observable<R>((observer) => {
      let index = 0;
      return source.subscribe({
        next: (value) => observer.next(project(value, index++)),
        error: (err) => observer.error?.(err),
        complete: () => observer.complete?.(),
      });
    });
}

export function filter<T>(predicate: (value: T, index: number) => boolean): OperatorFunction<T, T> {
  return (source) =>
    new Observable<T>((observer) => {
      let index = 0;
      return source.subscribe({
        next: (value) => {
          if (predicate(value, index++)) {
            observer.next(value);
          }
        },
        error: (err) => observer.error?.(err),
        complete: () => observer.complete?.(),
      });
    });
}

export function take<T>(count: number): OperatorFunction<T, T> {
  return (source) =>
    new Observable<T>((observer) => {
      if (count <= 0) {
        observer.complete?.();
        return;
      }

      let seen = 0;
      let pendingUnsubscribe = false;
      let upstream: Subscription | null = null;

      upstream = source.subscribe({
        next: (value) => {
          if (seen >= count) {
            return;
          }

          seen += 1;
          observer.next(value);

          if (seen >= count) {
            observer.complete?.();
            if (upstream) {
              upstream.unsubscribe();
            } else {
              pendingUnsubscribe = true;
            }
          }
        },
        error: (err) => observer.error?.(err),
        complete: () => observer.complete?.(),
      });

      if (pendingUnsubscribe && upstream) {
        upstream.unsubscribe();
      }

      return () => upstream?.unsubscribe();
    });
}

export function debounce<T>(delayMs: number): OperatorFunction<T, T> {
  return (source) =>
    new Observable<T>((observer) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      let latestValue: T | undefined;
      let hasValue = false;

      const flush = () => {
        if (!hasValue) {
          return;
        }

        observer.next(latestValue as T);
        hasValue = false;
        latestValue = undefined;
      };

      const clearTimer = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const upstream = source.subscribe({
        next: (value) => {
          latestValue = value;
          hasValue = true;
          clearTimer();
          timer = setTimeout(() => {
            timer = null;
            flush();
          }, delayMs);
        },
        error: (err) => {
          clearTimer();
          observer.error?.(err);
        },
        complete: () => {
          clearTimer();
          flush();
          observer.complete?.();
        },
      });

      return () => {
        clearTimer();
        upstream.unsubscribe();
      };
    });
}
