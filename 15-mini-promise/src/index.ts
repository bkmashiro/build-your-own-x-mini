/**
 * MiniPromise - A Promise/A+ compliant implementation in TypeScript
 *
 * Promise/A+ spec: https://promisesaplus.com/
 */

type PromiseState = 'pending' | 'fulfilled' | 'rejected';

type OnFulfilled<T, R> = ((value: T) => R | MiniPromise<R>) | null | undefined;
type OnRejected<R> = ((reason: unknown) => R | MiniPromise<R>) | null | undefined;

interface Handler<T> {
  promise2: MiniPromise<unknown>;
  onFulfilled: OnFulfilled<T, unknown>;
  onRejected: OnRejected<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/**
 * Promise Resolution Procedure (2.3)
 */
function resolvePromise<T>(
  promise: MiniPromise<T>,
  x: unknown,
  resolve: (value: T) => void,
  reject: (reason: unknown) => void
): void {
  // 2.3.1 If promise and x refer to the same object, reject with TypeError
  if (promise === x) {
    reject(new TypeError('Chaining cycle detected for promise'));
    return;
  }

  // 2.3.2 & 2.3.3: if x is a thenable (object or function with a then method)
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    let called = false;
    try {
      const then = (x as { then?: unknown }).then;
      if (typeof then === 'function') {
        // 2.3.3.3: call then with x as this
        then.call(
          x,
          (y: unknown) => {
            if (called) return;
            called = true;
            resolvePromise(promise, y, resolve, reject);
          },
          (r: unknown) => {
            if (called) return;
            called = true;
            reject(r);
          }
        );
      } else {
        // 2.3.3.4: x is not a thenable, fulfill with x
        resolve(x as T);
      }
    } catch (e) {
      if (!called) {
        reject(e);
      }
    }
  } else {
    // 2.3.4: x is not an object/function, fulfill with x
    resolve(x as T);
  }
}

export class MiniPromise<T> {
  private state: PromiseState = 'pending';
  private value: T | undefined = undefined;
  private reason: unknown = undefined;
  private handlers: Handler<T>[] = [];

  constructor(executor: (resolve: (value: T | MiniPromise<T>) => void, reject: (reason?: unknown) => void) => void) {
    const resolve = (value: T | MiniPromise<T>): void => {
      if (this.state !== 'pending') return;
      // Handle thenable resolution
      if (value instanceof MiniPromise) {
        value.then(resolve, reject);
        return;
      }
      this.state = 'fulfilled';
      this.value = value as T;
      this.processHandlers();
    };

    const reject = (reason?: unknown): void => {
      if (this.state !== 'pending') return;
      this.state = 'rejected';
      this.reason = reason;
      this.processHandlers();
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  private processHandlers(): void {
    if (this.state === 'pending') return;
    // 2.2.4: handlers must be called asynchronously (microtask)
    queueMicrotask(() => {
      for (const handler of this.handlers) {
        this.executeHandler(handler);
      }
      this.handlers = [];
    });
  }

  private executeHandler(handler: Handler<T>): void {
    if (this.state === 'fulfilled') {
      if (typeof handler.onFulfilled === 'function') {
        try {
          const result = handler.onFulfilled(this.value as T);
          resolvePromise(
            handler.promise2,
            result,
            handler.resolve,
            handler.reject
          );
        } catch (e) {
          handler.reject(e);
        }
      } else {
        // 2.2.7.3: if onFulfilled is not a function, fulfill promise2 with value
        handler.resolve(this.value);
      }
    } else if (this.state === 'rejected') {
      if (typeof handler.onRejected === 'function') {
        try {
          const result = handler.onRejected(this.reason);
          resolvePromise(
            handler.promise2,
            result,
            handler.resolve,
            handler.reject
          );
        } catch (e) {
          handler.reject(e);
        }
      } else {
        // 2.2.7.4: if onRejected is not a function, reject promise2 with reason
        handler.reject(this.reason);
      }
    }
  }

  // 2.2: then method
  then<R1 = T, R2 = never>(
    onFulfilled?: OnFulfilled<T, R1>,
    onRejected?: OnRejected<R2>
  ): MiniPromise<R1 | R2> {
    let resolvePromise2!: (value: unknown) => void;
    let rejectPromise2!: (reason: unknown) => void;

    const promise2 = new MiniPromise<R1 | R2>((resolve, reject) => {
      resolvePromise2 = resolve as (value: unknown) => void;
      rejectPromise2 = reject;
    });

    const handler: Handler<T> = {
      promise2: promise2 as unknown as MiniPromise<unknown>,
      onFulfilled: onFulfilled as OnFulfilled<T, unknown>,
      onRejected: onRejected as OnRejected<unknown>,
      resolve: resolvePromise2,
      reject: rejectPromise2,
    };

    if (this.state === 'pending') {
      this.handlers.push(handler);
    } else {
      // Already settled: schedule async execution
      queueMicrotask(() => this.executeHandler(handler));
    }

    return promise2;
  }

  catch<R = never>(onRejected?: OnRejected<R>): MiniPromise<T | R> {
    return this.then<T, R>(undefined, onRejected);
  }

  finally(onFinally?: (() => void) | null): MiniPromise<T> {
    return this.then(
      (value) => {
        if (typeof onFinally === 'function') onFinally();
        return value;
      },
      (reason) => {
        if (typeof onFinally === 'function') onFinally();
        throw reason;
      }
    ) as MiniPromise<T>;
  }

  // Static methods

  static resolve<T>(value: T | MiniPromise<T>): MiniPromise<T> {
    if (value instanceof MiniPromise) {
      return value;
    }
    return new MiniPromise<T>((resolve) => resolve(value));
  }

  static reject<T = never>(reason?: unknown): MiniPromise<T> {
    return new MiniPromise<T>((_, reject) => reject(reason));
  }

  static all<T>(promises: (MiniPromise<T> | T)[]): MiniPromise<T[]> {
    return new MiniPromise<T[]>((resolve, reject) => {
      if (promises.length === 0) {
        resolve([]);
        return;
      }

      const results: T[] = new Array(promises.length);
      let remaining = promises.length;

      promises.forEach((p, i) => {
        MiniPromise.resolve(p).then(
          (value) => {
            results[i] = value;
            remaining--;
            if (remaining === 0) {
              resolve(results);
            }
          },
          reject
        );
      });
    });
  }

  static race<T>(promises: (MiniPromise<T> | T)[]): MiniPromise<T> {
    return new MiniPromise<T>((resolve, reject) => {
      promises.forEach((p) => {
        MiniPromise.resolve(p).then(resolve, reject);
      });
    });
  }

  static allSettled<T>(
    promises: (MiniPromise<T> | T)[]
  ): MiniPromise<Array<{ status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }>> {
    return new MiniPromise((resolve) => {
      if (promises.length === 0) {
        resolve([]);
        return;
      }

      const results: Array<{ status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }> =
        new Array(promises.length);
      let remaining = promises.length;

      promises.forEach((p, i) => {
        MiniPromise.resolve(p).then(
          (value) => {
            results[i] = { status: 'fulfilled', value };
            if (--remaining === 0) resolve(results);
          },
          (reason) => {
            results[i] = { status: 'rejected', reason };
            if (--remaining === 0) resolve(results);
          }
        );
      });
    });
  }

  static any<T>(promises: (MiniPromise<T> | T)[]): MiniPromise<T> {
    return new MiniPromise<T>((resolve, reject) => {
      if (promises.length === 0) {
        reject(new AggregateError([], 'All promises were rejected'));
        return;
      }

      const errors: unknown[] = new Array(promises.length);
      let remaining = promises.length;

      promises.forEach((p, i) => {
        MiniPromise.resolve(p).then(resolve, (reason) => {
          errors[i] = reason;
          if (--remaining === 0) {
            reject(new AggregateError(errors, 'All promises were rejected'));
          }
        });
      });
    });
  }
}

export default MiniPromise;
