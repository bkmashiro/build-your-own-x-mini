# 22-mini-state

A tiny Redux-style state management library written in TypeScript.

## Features

- `createStore`
- `dispatch`
- `subscribe`
- `getState`
- `combineReducers`
- middleware via `applyMiddleware`
- action creator helpers via `bindActionCreator` and `bindActionCreators`

## Usage

```ts
import {
  applyMiddleware,
  bindActionCreators,
  combineReducers,
  createStore,
} from "./src";

type Action =
  | { type: "increment" }
  | { type: "setMessage"; payload: string };

const countReducer = (state = 0, action: Action) => {
  if (action.type === "increment") {
    return state + 1;
  }
  return state;
};

const messageReducer = (state = "idle", action: Action) => {
  if (action.type === "setMessage") {
    return action.payload;
  }
  return state;
};

const logger =
  ({ getState }: { getState: () => unknown }) =>
  (next: (action: Action) => Action) =>
  (action: Action) => {
    console.log("before", getState());
    const result = next(action);
    console.log("after", getState());
    return result;
  };

const store = createStore(
  combineReducers({
    count: countReducer,
    message: messageReducer,
  }),
  undefined,
  applyMiddleware(logger),
);

const actions = bindActionCreators(
  {
    increment: (): Action => ({ type: "increment" }),
    setMessage: (payload: string): Action => ({ type: "setMessage", payload }),
  },
  store.dispatch,
);

actions.increment();
actions.setMessage("ready");

console.log(store.getState());
```

## Development

```bash
npm install
npm test
npm run build
```
