import {
  Action,
  applyMiddleware,
  bindActionCreator,
  bindActionCreators,
  combineReducers,
  createStore,
  Middleware,
  Reducer,
} from "../src/index";

type CounterAction =
  | Action<"increment">
  | Action<"add", number>
  | Action<"setLabel", string>;

const counterReducer: Reducer<number, CounterAction> = (state = 0, action) => {
  switch (action.type) {
    case "increment":
      return state + 1;
    case "add":
      return state + (action.payload ?? 0);
    default:
      return state;
  }
};

const labelReducer: Reducer<string, CounterAction> = (state = "idle", action) => {
  if (action.type === "setLabel") {
    return action.payload ?? state;
  }
  return state;
};

describe("mini-state createStore", () => {
  test("initializes state through reducer", () => {
    const store = createStore(counterReducer);

    expect(store.getState()).toBe(0);
  });

  test("dispatch updates state and returns the action", () => {
    const store = createStore(counterReducer);
    const action: CounterAction = { type: "add", payload: 3 };

    expect(store.dispatch(action)).toBe(action);
    expect(store.getState()).toBe(3);
  });

  test("subscribe listens to updates and can unsubscribe", () => {
    const store = createStore(counterReducer);
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    store.dispatch({ type: "increment" });
    unsubscribe();
    store.dispatch({ type: "increment" });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("mini-state combineReducers", () => {
  test("combines multiple reducers into one state object", () => {
    const rootReducer = combineReducers({
      count: counterReducer,
      label: labelReducer,
    });
    const store = createStore(rootReducer);

    store.dispatch({ type: "increment" });
    store.dispatch({ type: "setLabel", payload: "ready" });

    expect(store.getState()).toEqual({
      count: 1,
      label: "ready",
    });
  });
});

describe("mini-state middleware", () => {
  test("runs middleware in sequence and can observe state", () => {
    const calls: string[] = [];
    const logger: Middleware<number, CounterAction> = ({ getState }) => (next) => (action) => {
      calls.push(`before:${action.type}:${getState()}`);
      const result = next(action);
      calls.push(`after:${action.type}:${getState()}`);
      return result;
    };
    const blockNegativeAdd: Middleware<number, CounterAction> = () => (next) => (action) => {
      if (action.type === "add" && typeof action.payload === "number" && action.payload < 0) {
        return { type: "add", payload: 0 };
      }
      return next(action);
    };

    const store = createStore(counterReducer, undefined, applyMiddleware(logger, blockNegativeAdd));

    store.dispatch({ type: "increment" });
    store.dispatch({ type: "add", payload: -10 });

    expect(store.getState()).toBe(1);
    expect(calls).toEqual([
      "before:increment:0",
      "after:increment:1",
      "before:add:1",
      "after:add:1",
    ]);
  });

  test("middleware can dispatch extra actions", () => {
    const mirrorIncrement: Middleware<number, CounterAction> = ({ dispatch }) => (next) => (action) => {
      const result = next(action);
      if (action.type === "increment") {
        dispatch({ type: "add", payload: 4 });
      }
      return result;
    };

    const store = createStore(counterReducer, undefined, applyMiddleware(mirrorIncrement));
    store.dispatch({ type: "increment" });

    expect(store.getState()).toBe(5);
  });
});

describe("mini-state action creators", () => {
  test("bindActionCreator dispatches actions created from arguments", () => {
    const store = createStore(counterReducer);
    const add = bindActionCreator(
      (value: number): CounterAction => ({ type: "add", payload: value }),
      store.dispatch,
    );

    const action = add(7);

    expect(action).toEqual({ type: "add", payload: 7 });
    expect(store.getState()).toBe(7);
  });

  test("bindActionCreators binds an action creator map", () => {
    const store = createStore(counterReducer);
    const actions = bindActionCreators(
      {
        increment: (): CounterAction => ({ type: "increment" }),
        add: (value: number): CounterAction => ({ type: "add", payload: value }),
      },
      store.dispatch,
    );

    actions.increment();
    actions.add(2);

    expect(store.getState()).toBe(3);
  });
});
