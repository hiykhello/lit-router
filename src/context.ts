import type { Router, RouteContext } from "./router-core.ts";

/**
 * A context key branded with the type of the value it references, matching the
 * W3C WebComponents Community Group Context Protocol and structurally identical
 * to `@lit/context`'s `Context`.
 */
export type Context<KeyType, ValueType> = KeyType & {
  readonly __context__: ValueType;
};

export type UnknownContext = Context<unknown, unknown>;

export type ContextType<T extends UnknownContext> =
  T extends Context<infer _KeyType, infer ValueType> ? ValueType : never;

export type ContextCallback<ValueType> = (
  value: ValueType,
  unsubscribe?: () => void,
) => void;

export interface ContextRequest<T extends UnknownContext> {
  readonly context: T;
  readonly callback: ContextCallback<ContextType<T>>;
  readonly subscribe?: boolean;
}

export const contextRequestEventName = "context-request" as const;

export class ContextRequestEvent<T extends UnknownContext>
  extends Event
  implements ContextRequest<T>
{
  readonly context: T;
  readonly callback: ContextCallback<ContextType<T>>;
  readonly subscribe?: boolean;

  constructor(
    context: T,
    callback: ContextCallback<ContextType<T>>,
    subscribe?: boolean,
  ) {
    super(contextRequestEventName, { bubbles: true, composed: true });
    this.context = context;
    this.callback = callback;
    this.subscribe = subscribe;
  }
}

export interface RouterContextKey {
  readonly name: "@elelcode/lit-router/context#router";
}

export type RouterContext = Context<RouterContextKey, Router>;

export const routerContext: RouterContext = Object.freeze({
  name: "@elelcode/lit-router/context#router",
}) as RouterContext;

export interface RouteContextKey {
  readonly name: "@elelcode/lit-router/context#route";
}

export type CurrentRouteContext = Context<RouteContextKey, RouteContext>;

export const routeContext: CurrentRouteContext = Object.freeze({
  name: "@elelcode/lit-router/context#route",
}) as CurrentRouteContext;

/**
 * Dispatches a context request event from an element and returns an unsubscribe function.
 */
export function requestContext<T extends UnknownContext>(
  element: Element,
  context: T,
  callback: ContextCallback<ContextType<T>>,
  subscribe?: boolean,
): () => void {
  let unsubscriber: (() => void) | undefined;
  const event = new ContextRequestEvent(
    context,
    (value, unsub) => {
      unsubscriber = unsub;
      callback(value, unsub);
    },
    subscribe,
  );
  element.dispatchEvent(event);
  return () => {
    unsubscriber?.();
  };
}
