# @elelcode/lit-router

A Navigation API-first router for Web Components and Lit, built around native
browser capabilities such as `URLPattern`, the `Navigation API`, and the
`View Transitions API`.

`lit-router` is Navigation API-first: it intercepts and commits same-document
navigations through `window.navigation`, not `popstate`, `hashchange`, or direct
`history.pushState()` / `history.replaceState()` calls.

Docs:

- English guide: [docs/guide.md](./docs/guide.md)
- Chinese guide: [docs/guide.zh-CN.md](./docs/guide.zh-CN.md)
- English API reference: [docs/api.md](./docs/api.md)
- 中文 API 参考: [docs/api.zh-CN.md](./docs/api.zh-CN.md)
- v2 migration guide: [docs/migration-v2.md](./docs/migration-v2.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

## Highlights

- **Modern Web Standards-Native**: built on native `Navigation API`, `URLPattern`, `View Transitions API`, and native `<slot>`s.
- **Ultra-lightweight & Dependency-Free**: ~15KB gzip output bundle with 0 external dependencies (peer dependency on `lit ^3.0.0` only).
- **Declarative Lit Directives**: `${routerLink()}` and `${activeRoute()}` for frictionless templates with automatic `aria-current="page"` and active class management.
- **Route Data Loaders**: async data prefetching (`loader`) that runs concurrently during navigation, eliminating waterfalls and passing data to `RouteContext.data` and `element.data`.
- **Component & Dynamic Leave Guards**: component-level `beforeRouteLeave` hooks and `router.registerLeaveGuard()` to safeguard unsaved user input.
- **W3C Context Protocol**: wire-compatible with `@lit/context` and native DOM events (`routerContext`, `routeContext`, `requestContext`).
- **Comprehensive Route Matching**: `router.isActive()` supports paths, prefixes, named routes, selectors, params, query parameters, and hashes.
- **Dynamic Route Trees**: insert, delete, or replace branches at runtime with atomic `batchRouteUpdates()` and rollback on failure.
- **Zero-Wrapper Projection**: no wrapper container components required; `<router-view>` projects directly into native `<slot>` elements.
- **Race-Safe**: abort signals cancel stale async loads, guards, and transition promises immediately when newer navigations occur.

## Architecture Comparison: @elelcode/lit-router vs. lit-ui-router

| Feature / Dimension           | `lit-ui-router` (UI-Router for Lit)                           | `@elelcode/lit-router` (This Package)                                 |
| :---------------------------- | :------------------------------------------------------------ | :-------------------------------------------------------------------- |
| **Foundation & Architecture** | Heavy `@uirouter/core` state machine (AngularJS-era legacy)   | **Navigation API-First** (Native modern web platform)                 |
| **Route Matching**            | Custom regex parser and state path engine                     | **Native `URLPattern`** (Browser-native, standard-compliant)          |
| **Page Transitions**          | Manual DOM manipulation or simulated CSS classes              | **Native `View Transitions API`** with direction awareness            |
| **View Organization**         | Custom `<ui-view>` component tree with complex context wiring | **Native `<slot>` elements** with multi-outlet parallel projection    |
| **Component Hierarchy**       | Requires top-level `<ui-router .uiRouter=${router}>` wrapper  | **Zero Wrapper Container**; clean standalone `<router-view>`          |
| **Declarative Directives**    | `uiSref` / `srefHref` directives                              | **`routerLink` & `activeRoute`** with automatic a11y (`aria-current`) |
| **Data Prefetching**          | State-machine `resolve`                                       | **Concurrent `loader`** with AbortSignal & waterfall elimination      |
| **Leave Guards**              | State-machine `uiCanExit`                                     | **Component `beforeRouteLeave`** + `registerLeaveGuard()`             |
| **Context Protocol**          | Proprietary `@lit/context` wiring                             | **Standard W3C Context Protocol** (0 extra dependencies)              |
| **Bundle Footprint**          | **> 300KB** unminified (> 90KB gzip with `@uirouter/core`)    | **~60KB** bundle (**~15KB gzip**), ~6x smaller                        |

## Install

```bash
npm install @elelcode/lit-router lit
```

Local development commands:

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

## Docs

- Overview and quick start: this page
- [English guide](./docs/guide.md)
- [中文指南](./docs/guide.zh-CN.md)
- [English API reference](./docs/api.md)
- [中文 API 参考](./docs/api.zh-CN.md)
- [v2 Migration Guide](./docs/migration-v2.md)
- [Slot outlets design](./docs/slot-outlets-design.md)
- [Changelog](./CHANGELOG.md)

## Quick Start

```ts
import { Router } from "@elelcode/lit-router";
import "@elelcode/lit-router";

const router = new Router({
  routes: [
    { path: "", component: "home-page" },
    {
      path: "settings",
      component: "settings-layout",
      children: [
        { path: "", component: "settings-home" },
        { path: "profile", component: "settings-profile" },
      ],
    },
  ],
});

document.querySelector("router-view")!.router = router;
```

```html
<router-view></router-view>
```

## Route Definitions

Each route is a `RouteDefinition`:

```ts
const routes = [
  {
    path: "users/:id",
    title: "User :id",
    component: "user-page",
    meta: { requiresAuth: true },
    props: { pageSize: 20 },
    guard: ({ leaf, params }) =>
      leaf?.meta?.requiresAuth && params.id === "me" ? "/profile" : true,
    load: () => import("./pages/user-page.ts"),
  },
];
```

Supported fields:

- `id`: optional stable tree-management identifier used for runtime route-tree
  updates.
- `name`: optional stable route name used by `router.link()` and named
  navigation.
- `path`: route path segment. Use `""` for index routes and `"*"` for catch-all.
- `slot`: parent slot name used by this route. Defaults to `"route-child"`;
  `"404"` and `"error"` are reserved fallback slot names.
- `title`: optional document title template. `:param` placeholders are expanded.
- `viewTransitionName`: optional CSS `view-transition-name` used by
  `<router-view>` for this route when it is the leaf route.
- `component`: custom element tag name or a factory function.
- `children`: nested route tree rendered through a named slot.
- `meta`: route metadata for guards, events, and route context. It is not
  assigned to the rendered DOM element.
- `props`: extra properties assigned to the rendered element with a shallow
  `Object.assign`.
- `guard`: async or sync route guard. Return `false` to block, or a string / URL
  / redirect object to redirect.
- `beforeLeave`: async or sync leave guard for the branch being unloaded. Return
  `false` to stay on the current page, or a redirect to reroute instead.
- `load`: async loader used for first-entry code splitting. It receives
  `{ signal }`, so fetches or imports can be cancelled when navigation becomes
  stale.

Route matching is compiled with specificity ordering, so static segments win
over params, and params win over catch-all routes even if the declarations are
not listed in that order.

## Runtime Route Tree Updates

Insert or delete route branches when auth, feature flags, or plugin modules
change:

```ts
router.insertRoutes([
  { path: "admin", name: "admin", component: "admin-page" },
]);

router.insertRoutes(
  [{ id: "settings-audit-plugin", path: "audit", component: "audit-page" }],
  {
    parentId: "settings-shell",
  },
);

router.removeRoute({ id: "settings-audit-plugin" });
```

Inserted child routes still require the parent route component to expose the
configured child slot.

Use `name` for navigation and reverse routing. Use `id` when you need to manage
route-tree branches that do not need a public navigation name.

If you need to stage multiple changes, batch them into a single refresh:

```ts
router.batchRouteUpdates(() => {
  router.insertRoutes([
    { path: "alpha", name: "alpha", component: "alpha-page" },
  ]);
  router.insertRoutes([{ path: "beta", name: "beta", component: "beta-page" }]);
});
```

If the batch callback throws, the router rolls back that batch instead of
leaving a partially applied route tree.

The batch callback must stay synchronous. If you need async work, finish it
first and then enter `batchRouteUpdates()`.

If you need to swap the whole tree at once, you can still replace it directly:

```ts
router.setRoutes([
  { path: "", component: "home-page" },
  { path: "admin", component: "admin-page" },
]);
```

`router.configure({ routes })` remains available when you need to update
multiple router options together.

## Route Context Contract

Route components should use the explicit `RouteContext` contract:

```ts
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { RouteContext } from "@elelcode/lit-router";

@customElement("user-page")
class UserPage extends LitElement {
  @property({ attribute: false })
  accessor routeContext: RouteContext | undefined;

  render() {
    return html` <h1>User ${this.routeContext?.params.id}</h1> `;
  }
}
```

If you prefer imperative updates, the component may implement:

```ts
setRouteContext(context: RouteContext): void
```

Components must expose either `routeContext` or `setRouteContext()`. The router
no longer injects legacy `routeDetail` / `routeParams` fields.

`routeContext.slot` identifies the slot this component was projected into, and
`routeContext.branch` contains the branch for that slot.

## Nested Routes

If a route declares `children`, the parent component must provide a slot for the
child branch:

```html
<slot name="route-child"></slot>
```

Or set a custom slot name on `<router-view child-slot="content">`.

Sibling child routes can target additional parent slots with `slot`:

```ts
{
  path: "settings",
  component: "settings-layout",
  children: [
    { path: "profile", component: "settings-profile" },
    { path: "profile", slot: "sidebar", component: "profile-sidebar" },
  ],
}
```

`RouterChangeDetail.slotBranches` exposes matched non-main slot branches.

## Navigation

Programmatic navigation:

```ts
router.push("/settings/profile");
router.replace("/settings");
router.push({ name: "user-detail", params: { id: "123" } });
const href = router.link({
  name: "user-detail",
  params: { id: "123" },
  query: { tab: "activity" },
});
const attrs = router.linkAttributes(
  { name: "user-detail", params: { id: "123" } },
  { replace: true },
);
const match = router.resolveUrl("/users/123");
const namedMatch = router.resolveNamed("user-detail", {
  params: { id: "123" },
});
```

Named reverse routing supports literal segments, `:param`, `:param(<pattern>)`,
`*`, and optional `?` tokens such as `:lang?/docs`. Route tokens with `+` or `*`
modifiers are still rejected during `router.link()` generation.

Anchor navigation:

- Same-origin links inside the configured `basePath` are intercepted.
- Plain fragments such as `#section` are left to the browser.
- Same-origin links outside `basePath` fall back to the browser.
- Both HTML and SVG `<a>` elements are supported.
- Add `data-router-replace` to an anchor to use replace-style navigation.
- Use `router.linkAttributes(location, { replace: true })` when creating
  replace-style links from JavaScript.

Leave guards run only for the suffix being unloaded. Shared parent routes are
not re-checked when sibling child routes switch.

## Declarative Lit Directives

Use `routerLink` and `activeRoute` directly inside your Lit HTML templates for clean, accessible navigation:

```ts
import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { activeRoute, routerLink } from "@elelcode/lit-router";

@customElement("app-nav")
class AppNav extends LitElement {
  render() {
    return html`
      <nav>
        <!-- routerLink automatically wires href, clicks, active class, and aria-current -->
        <a ${routerLink("/dashboard", { activeClass: "active", exact: true })}>
          Dashboard
        </a>
        <a ${routerLink("/users")}>Users</a>
        <a ${routerLink({ name: "settings", query: { tab: "profile" } })}>
          Settings
        </a>

        <!-- activeRoute turns any element (e.g., <li>, <button>) into an active-state indicator -->
        <li ${activeRoute("/analytics", { activeClass: "tab-selected" })}>
          <a href="/analytics">Analytics</a>
        </li>
      </nav>
    `;
  }
}
```

When used inside `<router-view>`, `routerLink` automatically resolves the `Router` instance from DOM context.

## Route Data Loaders (Prefetching)

Define a `loader` on your `RouteDefinition` to fetch data concurrently during navigation:

```ts
const routes = [
  {
    path: "users/:id",
    name: "user-detail",
    component: "user-profile",
    loader: async ({ params, signal }) => {
      const response = await fetch(`/api/users/${params.id}`, { signal });
      return response.json();
    },
  },
];
```

The preloaded data is passed to:

1. `router.current.data` and `router.getRouteData()`
2. `routeContext.data`
3. `element.data = context.data` (if the element defines a `data` property)

While the loader is running, `<router-view>` and `Router` dispatch `route-loading-start` and `route-loading-end` events for global progress indicators.

## Component & Dynamic Leave Guards

### Component-Level `beforeRouteLeave`

Prevent users from accidentally navigating away from unsaved forms by declaring a `beforeRouteLeave` method directly in the component:

```ts
@customElement("edit-post-page")
class EditPostPage extends LitElement {
  hasUnsavedChanges = true;

  beforeRouteLeave(detail) {
    if (this.hasUnsavedChanges) {
      return confirm(
        "You have unsaved changes. Are you sure you want to leave?",
      );
    }
    return true;
  }
}
```

### Dynamic `router.registerLeaveGuard`

Register dynamic leave guards programmatically:

```ts
const unregister = router.registerLeaveGuard((detail) => {
  if (isUploading) {
    return confirm("Upload in progress. Cancel and leave?");
  }
  return true;
});

// Later, when upload completes:
unregister();
```

## Active Route Checking (`router.isActive`)

Check whether a path, prefix, or named route is active:

```ts
// Path prefix match
router.isActive("/users"); // true for /users and /users/42

// Exact path match
router.isActive("/users", { exact: true });

// Named route
router.isActive("user-detail");

// Target with params, query, or hash
router.isActive({
  name: "user-detail",
  params: { id: "42" },
  query: { tab: "posts" },
  hash: "comments",
});
```

## W3C Context Protocol Integration

`@elelcode/lit-router` natively implements the W3C Context Protocol with zero extra dependencies:

```ts
import { LitElement, html } from "lit";
import { consume } from "@lit/context";
import {
  type RouteContext,
  type Router,
  routeContext,
  routerContext,
} from "@elelcode/lit-router";

class UserStatusWidget extends LitElement {
  @consume({ context: routerContext, subscribe: true })
  accessor router: Router | undefined;

  @consume({ context: routeContext, subscribe: true })
  accessor route: RouteContext | undefined;

  render() {
    return html`
      <p>Path: ${this.route?.detail.localPathname}</p>
      <p>User: ${this.route?.data?.name}</p>
    `;
  }
}
```

Or consume imperatively without `@lit/context`:

```ts
import { requestContext, routerContext } from "@elelcode/lit-router";

requestContext(
  this,
  routerContext,
  (router) => {
    console.log("Found router:", router);
  },
  true,
);
```

## RouterView

`<router-view>` supports:

- `.router`: attach a `Router` instance directly.
- `child-slot`: customize the slot used for nested children.
- `no-view-transition`: disable page-level view transitions for that outlet.

Fallback views:

- If navigation resolves to `route-not-found`, `<router-view>` renders a default
  404 fallback instead of leaving the viewport blank.
- If navigation throws `route-error`, `<router-view>` renders a default error
  fallback.
- You can override both with light DOM slots:

```html
<router-view>
  <not-found-page slot="404"></not-found-page>
  <route-error-page slot="error"></route-error-page>
</router-view>
```

Focus handling:

- After navigation, the view tries to focus `[data-route-focus]`.
- If none is found, it focuses the route viewport itself.
- The `router-view` `route-change` event fires only after that outlet finishes
  DOM commit, scroll restore, and focus management.
- The host element exposes `data-transition-direction="forward|backward|none"`
  so CSS can distinguish push, pop, and replace-style transitions.

Scroll and hash behavior:

- Scroll restoration is tracked per Navigation API entry, not just by URL.
- Hash targets are resolved with `document.getElementById()`.
- If an anchor lives inside a component shadow tree, expose that `id` on the
  host element in light DOM so hash scrolling stays O(1).

Recommended pattern:

```html
<h1 data-route-focus tabindex="-1">User Detail</h1>
```

## Events

Listen on either the `Router` instance or `<router-view>`:

```ts
router.addEventListener("route-change", (event) => {
  console.log(event.detail.pathname);
});
```

Available events:

- `route-change`: successful route transition. On `Router`, it fires after the
  URL/current state is committed. `event.detail.direction` reports
  `forward|backward|none`. On `<router-view>`, it fires later, after the
  rendered branch has mounted.
- `route-tree-change`: route definitions changed at runtime. Use this for menus,
  plugin registries, or permission-driven shells. `event.detail.routeCount` is
  cheap to read; `event.detail.routes` is a frozen read-only snapshot.
- `route-error`: guard, load, or commit failure.
- `route-loading-start` / `route-loading-end`: async route loading entered or
  finished. `event.detail.pending` is the current in-flight loading count.
- `route-not-found`: no matching route for the current URL.

## Examples

### `examples/minimal/` — Feature Playground

A compact playground covering the full feature set.

- index routes
- nested slot-based rendering
- lazy route loading with `route-loading-start` / `route-loading-end`
- guarded redirects and `beforeLeave`
- runtime `insertRoutes()` / `removeRoute()`
- explicit route context delivery
- route error / 404 fallback slots
- direction-aware `router-view[data-transition-direction]`

Key files:

- [examples/minimal/main.ts](./examples/minimal/main.ts)
- [examples/minimal/example-pages.ts](./examples/minimal/example-pages.ts)
- [examples/minimal/lazy-drafts.ts](./examples/minimal/lazy-drafts.ts)

### `examples/demo/` — Interactive Demo

A full interactive demo with navigation bar, status panel, guarded lab route,
and dynamic module loading. Run it with:

```bash
npm run dev
```

Key files:

- [examples/demo/app-root.ts](./examples/demo/app-root.ts)
- [examples/demo/demo-pages.ts](./examples/demo/demo-pages.ts)
- [examples/demo/lazy-drafts-panel.ts](./examples/demo/lazy-drafts-panel.ts)

## Production Notes

- This package is published directly to npm as standard ESM with bundled TypeScript declaration files.
- The peer dependency specifies `lit@^3.0.0`.
- The router intentionally depends on the native `URLPattern` API. Use a modern
  browser baseline or load a `URLPattern` polyfill before `router.start()`.
- The router requires the `Navigation API` for same-document navigations and
  does not provide a History API or hash routing fallback.
- Only one started `Router` instance is supported per document at a time.
- Route guards, lazy loaders, and route commits are async and race-aware.
- Navigation entry direction bookkeeping is bounded instead of growing without
  limit during very long-lived sessions.
- `router-view` keeps a bounded scroll-position cache instead of allowing
  unbounded growth during long sessions.
- For production shells, render explicit UI for `route-error` and
  `route-not-found`.

## API Reference

The full exported API surface is documented in [docs/api.md](./docs/api.md).
