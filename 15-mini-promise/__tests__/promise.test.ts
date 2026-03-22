import { MiniPromise } from '../src/index';

// Helper to flush microtasks
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('MiniPromise - Basic', () => {
  test('resolves with a value', async () => {
    const p = new MiniPromise<number>((resolve) => resolve(42));
    await expect(p).resolves.toBe(42);
  });

  test('rejects with a reason', async () => {
    const p = new MiniPromise<never>((_, reject) => reject(new Error('oops')));
    await expect(p).rejects.toThrow('oops');
  });

  test('executor exception causes rejection', async () => {
    const p = new MiniPromise(() => {
      throw new Error('boom');
    });
    await expect(p).rejects.toThrow('boom');
  });

  test('state is immutable once settled (resolve then reject)', async () => {
    const p = new MiniPromise<number>((resolve, reject) => {
      resolve(1);
      reject(new Error('ignored'));
    });
    await expect(p).resolves.toBe(1);
  });

  test('state is immutable once settled (reject then resolve)', async () => {
    const p = new MiniPromise<number>((resolve, reject) => {
      reject(new Error('first'));
      resolve(2);
    });
    await expect(p).rejects.toThrow('first');
  });
});

describe('MiniPromise - then()', () => {
  test('then returns a new promise', () => {
    const p1 = MiniPromise.resolve(1);
    const p2 = p1.then((v) => v + 1);
    expect(p2).toBeInstanceOf(MiniPromise);
    expect(p2).not.toBe(p1);
  });

  test('then onFulfilled receives the resolved value', async () => {
    const result = await MiniPromise.resolve(10).then((v) => v * 2);
    expect(result).toBe(20);
  });

  test('then onRejected receives the rejection reason', async () => {
    const err = new Error('test');
    const result = await MiniPromise.reject(err).then(null, (r) => (r as Error).message);
    expect(result).toBe('test');
  });

  test('chaining: value passes through when onFulfilled is omitted', async () => {
    const result = await MiniPromise.resolve(5).then().then((v) => v);
    expect(result).toBe(5);
  });

  test('chaining: rejection passes through when onRejected is omitted', async () => {
    const p = MiniPromise.reject(new Error('pass-through')).then((v) => v);
    await expect(p).rejects.toThrow('pass-through');
  });

  test('then onFulfilled returning a value resolves next', async () => {
    const result = await MiniPromise.resolve(1)
      .then((v) => v + 1)
      .then((v) => v + 1)
      .then((v) => v + 1);
    expect(result).toBe(4);
  });

  test('then onFulfilled returning a promise flattens it', async () => {
    const result = await MiniPromise.resolve(1).then((v) =>
      MiniPromise.resolve(v + 10)
    );
    expect(result).toBe(11);
  });

  test('then onFulfilled throwing causes rejection', async () => {
    const p = MiniPromise.resolve(1).then(() => {
      throw new Error('thrown');
    });
    await expect(p).rejects.toThrow('thrown');
  });

  test('then after already resolved fires asynchronously', async () => {
    const order: string[] = [];
    const p = MiniPromise.resolve('hi');
    p.then(() => order.push('async'));
    order.push('sync');
    await flushMicrotasks();
    expect(order).toEqual(['sync', 'async']);
  });

  test('multiple then on same promise', async () => {
    const p = MiniPromise.resolve(42);
    const [a, b] = await Promise.all([p.then((v) => v + 1), p.then((v) => v + 2)]);
    expect(a).toBe(43);
    expect(b).toBe(44);
  });
});

describe('MiniPromise - catch()', () => {
  test('catch handles rejection', async () => {
    const result = await MiniPromise.reject(new Error('err')).catch(
      (e) => (e as Error).message
    );
    expect(result).toBe('err');
  });

  test('catch does not fire on resolved promise', async () => {
    const fn = jest.fn();
    await MiniPromise.resolve(1).catch(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  test('error propagates through catch chain', async () => {
    const result = await MiniPromise.resolve(1)
      .then(() => {
        throw new Error('middle');
      })
      .catch((e) => `caught: ${(e as Error).message}`);
    expect(result).toBe('caught: middle');
  });

  test('catch recovery continues chain', async () => {
    const result = await MiniPromise.reject(new Error('x'))
      .catch(() => 'recovered')
      .then((v) => `${v}!`);
    expect(result).toBe('recovered!');
  });
});

describe('MiniPromise - finally()', () => {
  test('finally fires on resolve', async () => {
    const fn = jest.fn();
    const result = await MiniPromise.resolve(99).finally(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe(99);
  });

  test('finally fires on reject', async () => {
    const fn = jest.fn();
    const p = MiniPromise.reject(new Error('fin')).finally(fn);
    await expect(p).rejects.toThrow('fin');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('finally passes through original value', async () => {
    const result = await MiniPromise.resolve(7)
      .finally(() => 999) // return value ignored
      .then((v) => v);
    expect(result).toBe(7);
  });

  test('finally passes through original rejection', async () => {
    const p = MiniPromise.reject(new Error('orig'))
      .finally(() => {
        /* no-op */
      })
      .catch((e) => (e as Error).message);
    await expect(p).resolves.toBe('orig');
  });
});

describe('MiniPromise.resolve()', () => {
  test('resolves non-promise value', async () => {
    await expect(MiniPromise.resolve(42)).resolves.toBe(42);
  });

  test('returns the same promise if passed a MiniPromise', () => {
    const p = MiniPromise.resolve(1);
    expect(MiniPromise.resolve(p)).toBe(p);
  });

  test('resolves a thenable', async () => {
    const thenable = { then: (res: (v: number) => void) => res(55) };
    const result = await MiniPromise.resolve(1).then(() => thenable as unknown as MiniPromise<number>);
    expect(result).toBe(55);
  });
});

describe('MiniPromise.reject()', () => {
  test('creates a rejected promise', async () => {
    await expect(MiniPromise.reject(new Error('rej'))).rejects.toThrow('rej');
  });

  test('reject with undefined', async () => {
    await expect(MiniPromise.reject()).rejects.toBeUndefined();
  });
});

describe('MiniPromise.all()', () => {
  test('resolves all promises', async () => {
    const result = await MiniPromise.all([
      MiniPromise.resolve(1),
      MiniPromise.resolve(2),
      MiniPromise.resolve(3),
    ]);
    expect(result).toEqual([1, 2, 3]);
  });

  test('resolves with empty array', async () => {
    const result = await MiniPromise.all([]);
    expect(result).toEqual([]);
  });

  test('rejects if any promise rejects', async () => {
    const p = MiniPromise.all([
      MiniPromise.resolve(1),
      MiniPromise.reject(new Error('fail')) as unknown as MiniPromise<number>,
      MiniPromise.resolve(3),
    ]);
    await expect(p).rejects.toThrow('fail');
  });

  test('rejects with first rejection reason', async () => {
    const p = MiniPromise.all([
      MiniPromise.reject(new Error('first')) as unknown as MiniPromise<number>,
      MiniPromise.reject(new Error('second')) as unknown as MiniPromise<number>,
    ]);
    await expect(p).rejects.toThrow('first');
  });

  test('preserves order of results', async () => {
    const result = await MiniPromise.all([
      new MiniPromise<number>((res) => setTimeout(() => res(3), 30)),
      new MiniPromise<number>((res) => setTimeout(() => res(1), 10)),
      new MiniPromise<number>((res) => setTimeout(() => res(2), 20)),
    ]);
    expect(result).toEqual([3, 1, 2]);
  });

  test('accepts plain values (non-promises)', async () => {
    const result = await MiniPromise.all([1, 2, MiniPromise.resolve(3)] as (MiniPromise<number> | number)[]);
    expect(result).toEqual([1, 2, 3]);
  });
});

describe('MiniPromise.race()', () => {
  test('resolves with first settled value', async () => {
    const result = await MiniPromise.race([
      new MiniPromise<number>((res) => setTimeout(() => res(2), 20)),
      new MiniPromise<number>((res) => setTimeout(() => res(1), 10)),
    ]);
    expect(result).toBe(1);
  });

  test('rejects if first settled is rejected', async () => {
    const p = MiniPromise.race([
      new MiniPromise<number>((_, rej) => setTimeout(() => rej(new Error('fast-fail')), 10)),
      new MiniPromise<number>((res) => setTimeout(() => res(1), 50)),
    ]);
    await expect(p).rejects.toThrow('fast-fail');
  });

  test('resolves immediately with first already-resolved', async () => {
    const result = await MiniPromise.race([
      MiniPromise.resolve(42),
      new MiniPromise<number>((res) => setTimeout(() => res(99), 100)),
    ]);
    expect(result).toBe(42);
  });
});

describe('MiniPromise.allSettled()', () => {
  test('returns fulfilled/rejected status for all', async () => {
    const results = await MiniPromise.allSettled([
      MiniPromise.resolve(1),
      MiniPromise.reject(new Error('e')) as unknown as MiniPromise<number>,
      MiniPromise.resolve(3),
    ]);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1]).toEqual({ status: 'rejected', reason: new Error('e') });
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });

  test('empty array resolves immediately', async () => {
    const results = await MiniPromise.allSettled([]);
    expect(results).toEqual([]);
  });
});

describe('MiniPromise.any()', () => {
  test('resolves with first fulfilled value', async () => {
    const result = await MiniPromise.any([
      MiniPromise.reject(new Error('a')) as unknown as MiniPromise<number>,
      MiniPromise.resolve(2),
      MiniPromise.resolve(3),
    ]);
    expect(result).toBe(2);
  });

  test('rejects with AggregateError if all reject', async () => {
    const p = MiniPromise.any([
      MiniPromise.reject(new Error('a')) as unknown as MiniPromise<number>,
      MiniPromise.reject(new Error('b')) as unknown as MiniPromise<number>,
    ]);
    await expect(p).rejects.toBeInstanceOf(AggregateError);
  });

  test('rejects with AggregateError for empty array', async () => {
    const p = MiniPromise.any<number>([]);
    await expect(p).rejects.toBeInstanceOf(AggregateError);
  });
});

describe('Promise/A+ - Chaining cycle detection', () => {
  test('rejects when promise returned from then is itself', async () => {
    const p: MiniPromise<unknown> = MiniPromise.resolve(1).then(() => p);
    await expect(p).rejects.toThrow(TypeError);
    await expect(p).rejects.toThrow('Chaining cycle detected');
  });
});

describe('Promise/A+ - Async behavior', () => {
  test('handlers are called asynchronously', async () => {
    const log: string[] = [];
    MiniPromise.resolve(1).then(() => log.push('then'));
    log.push('sync');
    await flushMicrotasks();
    expect(log).toEqual(['sync', 'then']);
  });

  test('deeply nested chain resolves correctly', async () => {
    const result = await MiniPromise.resolve(0)
      .then((v) => MiniPromise.resolve(v + 1))
      .then((v) => MiniPromise.resolve(v + 1))
      .then((v) => MiniPromise.resolve(v + 1))
      .then((v) => MiniPromise.resolve(v + 1))
      .then((v) => v);
    expect(result).toBe(4);
  });

  test('error recovery in chain', async () => {
    const result = await MiniPromise.resolve(1)
      .then(() => {
        throw new Error('step2');
      })
      .catch(() => 'recovered')
      .then((v) => `${v}!`)
      .then((v) => `${v}!`);
    expect(result).toBe('recovered!!');
  });
});
