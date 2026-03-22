export type Action<TType extends string = string, TPayload = unknown> = {
  type: TType;
  payload?: TPayload;
};

export type Reducer<TState, TAction extends Action = Action> = (
  state: TState | undefined,
  action: TAction,
) => TState;

export type Unsubscribe = () => void;
export type Listener = () => void;

export interface Store<TState, TAction extends Action = Action> {
  dispatch(action: TAction): TAction;
  getState(): TState;
  subscribe(listener: Listener): Unsubscribe;
}

export type MiddlewareAPI<TState, TAction extends Action = Action> = Pick<
  Store<TState, TAction>,
  "dispatch" | "getState"
>;

export type Middleware<TState, TAction extends Action = Action> = (
  api: MiddlewareAPI<TState, TAction>,
) => (next: (action: TAction) => TAction) => (action: TAction) => TAction;

export type StoreEnhancer = (createStoreFn: any) => any;

export type ActionCreator<TAction extends Action = Action, TArgs extends unknown[] = any[]> = (
  ...args: TArgs
) => TAction;

export type ActionCreatorsMapObject<TAction extends Action = Action> = Record<
  string,
  ActionCreator<TAction, any[]>
>;

export function createStore<TState, TAction extends Action = Action>(
  reducer: Reducer<TState, TAction>,
  preloadedState?: TState,
  enhancer?: StoreEnhancer,
): Store<TState, TAction> {
  if (enhancer) {
    return enhancer(createStore)(reducer, preloadedState);
  }

  let currentState =
    preloadedState === undefined
      ? reducer(undefined, { type: "@@mini-state/INIT" } as TAction)
      : preloadedState;
  const listeners = new Set<Listener>();

  const store: Store<TState, TAction> = {
    dispatch(action: TAction): TAction {
      currentState = reducer(currentState, action);
      const snapshot = Array.from(listeners);
      for (const listener of snapshot) {
        listener();
      }
      return action;
    },

    getState(): TState {
      return currentState;
    },

    subscribe(listener: Listener): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return store;
}

export function combineReducers<TReducers extends Record<string, Reducer<any, any>>>(
  reducers: TReducers,
): Reducer<
  { [K in keyof TReducers]: ReturnType<TReducers[K]> },
  Parameters<TReducers[keyof TReducers]>[1]
> {
  type CombinedState = { [K in keyof TReducers]: ReturnType<TReducers[K]> };
  type CombinedAction = Parameters<TReducers[keyof TReducers]>[1];

  return (state: CombinedState | undefined, action: CombinedAction) => {
    const nextState = {} as CombinedState;
    const previousState = state ?? ({} as CombinedState);

    for (const key of Object.keys(reducers) as Array<keyof TReducers>) {
      nextState[key] = reducers[key](previousState[key], action);
    }

    return nextState;
  };
}

export function applyMiddleware<TState, TAction extends Action = Action>(
  ...middlewares: Array<Middleware<TState, TAction>>
): StoreEnhancer {
  const enhancer = (createStoreFn: typeof createStore) => {
    const enhancedCreateStore = <InnerState, InnerAction extends Action = Action>(
      reducer: Reducer<InnerState, InnerAction>,
      preloadedState?: InnerState,
    ): Store<InnerState, InnerAction> => {
      const store = createStoreFn(reducer, preloadedState) as unknown as Store<
        TState,
        TAction
      >;
      let dispatch: Store<TState, TAction>["dispatch"] = () => {
        throw new Error("Dispatching while constructing middleware is not allowed.");
      };

      const api: MiddlewareAPI<TState, TAction> = {
        getState: store.getState,
        dispatch: (action) => dispatch(action),
      };

      const chain = middlewares.map((middleware) => middleware(api));
      dispatch = compose(...chain)(store.dispatch);

      return {
        ...store,
        dispatch,
      } as unknown as Store<InnerState, InnerAction>;
    };

    return enhancedCreateStore as unknown as typeof createStore;
  };

  return enhancer;
}

export function bindActionCreator<TAction extends Action, TArgs extends unknown[]>(
  actionCreator: ActionCreator<TAction, TArgs>,
  dispatch: (action: TAction) => TAction,
): (...args: TArgs) => TAction {
  return (...args: TArgs) => dispatch(actionCreator(...args));
}

export function bindActionCreators<TAction extends Action, TActionCreators extends ActionCreatorsMapObject<TAction>>(
  actionCreators: TActionCreators,
  dispatch: (action: TAction) => TAction,
): {
  [K in keyof TActionCreators]: (
    ...args: Parameters<TActionCreators[K]>
  ) => ReturnType<TActionCreators[K]>;
} {
  const bound = {} as {
    [K in keyof TActionCreators]: (
      ...args: Parameters<TActionCreators[K]>
    ) => ReturnType<TActionCreators[K]>;
  };

  for (const key of Object.keys(actionCreators) as Array<keyof TActionCreators>) {
    const creator = actionCreators[key];
    bound[key] = ((...args: Parameters<typeof creator>) =>
      dispatch(creator(...args))) as (
      ...args: Parameters<TActionCreators[typeof key]>
    ) => ReturnType<TActionCreators[typeof key]>;
  }

  return bound;
}

function compose<TAction extends Action>(
  ...funcs: Array<
    (next: (action: TAction) => TAction) => (action: TAction) => TAction
  >
): (next: (action: TAction) => TAction) => (action: TAction) => TAction {
  if (funcs.length === 0) {
    return (next) => next;
  }

  return funcs.reduceRight(
    (composed, fn) => (next) => fn(composed(next)),
    (next) => next,
  );
}
