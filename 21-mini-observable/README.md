# 21-mini-observable

A tiny RxJS-style reactive stream library implemented in TypeScript.

## Features

- `Observable` with `subscribe()` and `unsubscribe()`
- `pipe()` composition
- Operators: `map`, `filter`, `take`, `debounce`
- Multicasting with `Subject`
- Stateful streams with `BehaviorSubject`

## Usage

```ts
import {
  BehaviorSubject,
  Observable,
  Subject,
  debounce,
  filter,
  map,
  take,
} from './src';

const source = new Observable<number>((observer) => {
  [1, 2, 3, 4, 5].forEach((value) => observer.next(value));
  observer.complete?.();
});

source
  .pipe(
    map((value) => value * 10),
    filter((value) => value >= 20),
    take(2),
  )
  .subscribe({
    next: (value) => console.log(value),
    complete: () => console.log('done'),
  });

const subject = new Subject<string>();
subject.subscribe((value) => console.log('A:', value));
subject.subscribe((value) => console.log('B:', value));
subject.next('hello');

const state$ = new BehaviorSubject<number>(0);
state$.subscribe((value) => console.log('current:', value));
state$.next(1);

subject.pipe(debounce(100)).subscribe((value) => console.log('debounced:', value));
```

## Running

```bash
npm install
npm test
npm run build
```

## Project Structure

```
21-mini-observable/
├── src/index.ts
├── __tests__/observable.test.ts
├── package.json
├── tsconfig.json
└── README.md
```
