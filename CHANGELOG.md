# Changelog

## 2.1.6 (2026-11-09)

### Fixed

- **Empty and Whitespace String Target Handling**: Calling `router.link("")`, `router.push("")`, `router.resolve("")`, or `router.isActive("")` with empty or whitespace-only strings now safely resolves to the current URL rather than throwing an uncaught `Route name must be a non-empty string` error.
- **Hierarchical Ancestor Data Inheritance in Side Slots**: Route elements and context subscribers in parallel side slots now gracefully inherit loader data from ancestor routes in the same side-slot branch when the leaf route defines no loader, rather than incorrectly defaulting directly to the main branch's data.
- **Document Click Interception Hardening**: Document click interception now checks `typeof event.composedPath === 'function'` with fallback tree traversal for environments without native composedPath, and wraps `new URL(href)` in try/catch to gracefully skip malformed or invalid URIs without throwing unhandled exceptions.
- **Full RouteLocation Merging in Directives**: `mergeTargetOptions` in `routerLink` and `activeRoute` directives now merges `params`, `query`, and `hash` on any `RouteLocation` object without requiring explicit `name` or `id` properties.

### Added

- **Hierarchical Merged Route Meta**: `RouterChangeDetail` and `RouteContext` now expose `meta: RouteMeta`, representing the shallow-merged route metadata accumulated from root to leaf along the active branch.
- **Dynamic Route Title Functions**: Route definitions now support dynamic title functions `title?: string | ((detail: RouterChangeDetail) => string)`, allowing document titles to be dynamically generated from route data, params, or navigation details.

## 2.1.5 (2026-11-09)

### Fixed

- **Cross-Origin & Protocol-Relative `router.link` Integrity**: `router.link()` now preserves external origins (e.g. `https://example.com/login`) and protocol-relative URLs (`//cdn.example.com`) without stripping down to local pathnames or prefixing with `basePath`.
- **Targeting Current Route State via `RouteLocation`**: `RouteLocation` objects omitting both `id` and `name` (e.g. `router.push({ query: { page: "2" } })`, `router.push({ hash: "section" })`, `router.push({ params: { id: "42" } })`) now seamlessly target and update the active route instead of throwing an `Unknown route name ""` error.
- **`<router-view>` Reconnection Resilience**: When `<router-view>` is disconnected and subsequently reconnected to the DOM, it now detects reconnection and automatically resynchronizes the active route state into the viewport, avoiding blank views.
- **Custom Elements Definition Race Protection**: Deferred property and context assignment (`whenDefined`) now verifies `element.isConnected` and compares the element's latest context against the closure context, preventing stale async resolutions from overriding subsequent navigations.
- **Scroll Restoration Key Fallback**: `ScrollManager` now falls back gracefully to `url.href` if the navigation entry key is empty or not yet assigned.
- **Traverse-Based History Restoration for Cancelled Traversal**: When a browser history traversal (e.g. Back button) is blocked by a guard, `Router` now attempts to restore the previous entry via `navigationApi.traverseTo` before falling back to `replace`, preventing extraneous history stack entries.

### Added

- **Unified `router.resolve` and `routerView.resolve`**: Added public `resolve(target: RouteTarget)` method to both `Router` and `<router-view>` supporting route paths, `URL` objects, and `RouteLocation` specifications.

## 2.1.4 (2026-11-09)

### Fixed

- **Base-Path and Named Route Preservation in Guard Redirects**: Guard redirects (`RouteGuardRedirect`) now properly respect and prepend `basePath` when redirecting to root-relative paths (e.g. `"/login"`), and resolve named routes and `RouteLocation` objects with parameters and query strings via `toRouteUrl`, while preserving relative redirects (e.g. `"./sub"`).
- **Cross-Origin Navigation and Redirects**: Prevented `SecurityError` exceptions from `navigation.navigate()` on external URLs. Cross-origin destinations passed to `router.push`, `router.replace`, or returned from route guards now seamlessly delegate to `window.location.assign` or `window.location.replace`.
- **Navigation API PreventDefault Handling**: `onNavigate` now verifies `!navigateEvent.defaultPrevented` before intercepting, respecting external or third-party cancellation of navigation events.
- **Global CSS Identifier Safety in Scroll Restoration**: Removed direct undeclared `CSS?.escape` identifier access in favor of `window.CSS?.escape`, preventing runtime `ReferenceError: CSS is not defined` in headless, SSR, or Node test environments.
- **Directive Aria-Current Cleanup**: When disconnected, `routerLink` and `activeRoute` directives now clean up `aria-current` attributes along with active classes, preventing stale accessibility state on detached elements.

### Added

- **Convenience History Methods**: Added `router.back()`, `router.forward()`, and `router.go(delta)` to both `Router` and `<router-view>` for seamless programmatic browser history traversal.

### Fixed

- **Side-Slot Route Context Updates**: Track subscriber slot metadata and element locations, ensuring components inside parallel side slots receive their corresponding slot context (`params`, `slot`, `branch`, and `data`) across route updates rather than being overwritten by default child slot context.
- **ChildSlot Property Remount**: Changing `childSlot` property on `<router-view>` now properly remounts active route branches into the updated slot instead of leaving an empty viewport.
- **Component Data State Resetting**: When navigating from a route with loader data to a route without loader data, reused view elements now have their `data` property safely cleared to `undefined`, preventing stale data retention while preserving component default values and `props.data`.
- **RouteLoadContext Parity for `route.load`**: `route.load` now receives full `RouteLoadContext` containing `signal`, `router`, `pathname`, `localPathname`, `params`, `query`, `hash`, and `url`, matching the rich context available to `route.loader`.
- **Targeting Routes by `id` in `RouteLocation`**: `RouteLocation` now accepts `id?: string`, enabling `router.push({ id: "profile" })`, `router.replace({ id: "profile" })`, and `router.link({ id: "profile" })`. Added `router.resolveId(id, options)` for programmatic route ID matching.
- **Merged Query Matching in `isActive`**: `router.isActive()` now merges `target.query` with `options.query` via `mergeQueries`, ensuring multi-param query constraints are evaluated consistently.
- **URL-Decoded Param Comparison in `isActive`**: Param matching in `isActive` now compares decoded segments alongside raw strings, matching encoded and decoded representations accurately.
- **Rel='external' Click Bypass**: Anchor clicks marked with `rel="external"` are now skipped by document-level click interception and `routerLink`, preserving native navigation for external resources.
- **Directive Reconnection Context Restoration**: `routerLink` and `activeRoute` directives now re-subscribe to W3C Context protocol and re-attach route listeners upon reconnection in the DOM, preventing lost reactivity when components are detached and re-attached.
- **Safe Scroll Restoration and Anchor Fallback**: `ScrollManager.prototype.restore` now safely verifies `scrollIntoView` function existence and supports standard HTML `<a name="...">` anchor fragments.

### Fixed

- **Centralized `basePath` Navigation & Resolution**: `router.push("/path")`, `router.replace("/path")`, and `router.resolveUrl("/path")` now properly handle paths starting with `/` when a non-root `basePath` is configured, preventing navigation outside `basePath`.
- **Parallel Slot Outlet Active Matching**: `router.isActive()` now inspects all active branches (`detailBranches`) across parallel named slots, properly identifying named routes and route IDs inside auxiliary outlets (such as sidebars and panels) as active.
- **Hierarchical Route Data Inheritance**: `router.getRouteData()` and `detail.data` now gracefully inherit data from the nearest ancestor route in the branch when a leaf route does not declare its own loader.
- **Safe Multi-Class and Empty-Class Toggling in Directives**: `routerLink` and `activeRoute` now use token-splitting class toggle helpers, preventing browser `DOMException` when multiple space-separated classes (e.g. Tailwind `activeClass: "bg-blue-500 font-bold"`) or empty strings (`activeClass: ""`) are passed.
- **Dynamic Active Class Cleanup**: Directives now track previous active classes and cleanly remove old classes upon dynamic option updates or element disconnection.
- **Anchor and Child Click Interception**: Document-level click handler in `RouterCore` and directive click handler now inspect the composed click path to properly respect `data-router-ignore`, `download`, `disabled`, and `aria-disabled="true"` on nested child elements.
- **Slot-Aware Context Protocol**: `<router-view>` now determines the requesting element's slot outlet, providing accurate slot name, branch, params, and route data to components located in parallel named slot outlets.
- **Deferred Directive Router Binding**: Directives scheduled before element attachment now automatically re-seek context once attached, ensuring seamless rendering inside template fragments and microtasks.
- **Directive Active Options Alignment**: `RouterLinkDirectiveOptions` now extends `RouteIsActiveOptions`, allowing query, params, and hash options to be configured alongside `exact`.

## 2.1.1 (2026-11-09)

### Fixed

- **`router.isActive` & `router.link` with `basePath`**: Ensure path and prefix matching compare against local route paths properly, allowing both `/users` and `/app/users` to match when `basePath: "/app"`. `router.link("/users")` now safely prefixes `basePath`.
- **Named Route Strings**: `router.link("route-name")` and `router.push("route-name")` now support direct named route strings without requiring object wrapping.
- **Concurrent Loaders & Waterfall Elimination**: Matched route loaders across branches are now executed in parallel via `Promise.all` with duplicate-route execution prevention.
- **Context Protocol Pre-Subscription**: `<router-view>` now buffers early context subscribers if child components connect before `view.router` is assigned, and cleans up subscribers on disconnect.
- **Universal Element Directives**: `routerLink`, `activeRoute`, and `requestContext` now accept standard `Element` targets (supporting SVG anchors `SVGAElement` and custom elements).

## 2.1.0 (2026-11-09)

### Added

- **Declarative Directives (`routerLink` & `activeRoute`)**:
  - `routerLink(target, options?)`: Lit directive for `<a>` tags with automatic `href` resolution, safe click interception (supporting modifier keys and new windows), active class toggling, and automatic `aria-current="page"` accessibility. Automatically resolves `Router` via DOM context if not explicitly provided.
  - `activeRoute(target, options?)`: Lit directive for any HTML element (e.g. `<li>`, `<button>`) to reflect active route state with custom classes and `aria-current`.
- **Route Data Loaders (`RouteDefinition.loader`)**:
  - Async data prefetching running concurrently during route navigation without request waterfalls.
  - Passes preloaded data to `router.current.data`, `router.getRouteData(selector?)`, `routeContext.data`, and `element.data`.
  - Integrated with `route-loading-start` and `route-loading-end` events.
- **Component & Dynamic Leave Guards**:
  - Component lifecycle hook: rendered custom elements can declare `beforeRouteLeave(detail)` to intercept leaving transitions (e.g., confirming unsaved changes before discarding).
  - `router.registerLeaveGuard(guard)`: dynamically register and unregister global or situational leave guards with automatic URL restoration if blocked.
- **W3C Context Protocol Integration**:
  - Built-in zero-dependency support for the W3C Community Group Context Protocol.
  - Exported `routerContext` and `routeContext` tokens, 100% wire-compatible with `@lit/context` and native DOM `context-request` events.
  - Exported `requestContext` helper for non-decorator DOM consumption.
- **Active Route Matching (`router.isActive`)**:
  - Supports prefix matching, exact matching (`exact: true`), named routes, route selectors with `id`, params matching, query params, and hash fragments.

## 2.0.0 (2026-11-09)

### Removed

- Hash routing mode and the `RouterOptions.mode` / `router.mode` API.

### Changed

- Rename `RouterChangeDetail.historyKey` to `navigationKey` to match the
  Navigation API entry model.

## 1.1.2 (2026-05-16)

### Changed

- Upgrade the `lit` npm dependency range to `^3.3.3`.

## 1.1.1 (2026-05-16)

### Added

- Hash routing via `new Router({ mode: "hash" })`, including generated
  `/#/base/path` links, hash URL resolution, click interception, and guard
  redirects through the Navigation API.

## 1.0.3 (2026-05-08)

### Added

- `examples/demo/` — interactive demo app with navigation bar, status panel,
  guarded lab route, and dynamic module loading.
- English user guide (`docs/guide.md`).

### Changed

- Demo files moved from `src/` to `examples/demo/` to keep the library source
  directory focused.
- `deno.json` fmt tasks now auto-discover files instead of using an explicit
  file list.
- Removed `experimentalDecorators` from `tsconfig.json`.
- Cleaned up stale build artifacts in `lib/`.

## 1.0.2

### Added

- Slot multi-outlet support. One URL can match multiple child routes targeting
  different named slots in the parent component. Includes full guard, lazy load,
  leave guard, and focus integration. See
  [docs/slot-outlets-design.md](./docs/slot-outlets-design.md).
- `RouteContext.slot` and `RouteContext.branch` — components can now identify
  which slot they were projected into.
- `RouterChangeDetail.slotBranches`, `slotParams`, and `slots` for introspecting
  side-slot matches.
- `RouteLoadingDetail.loadingSlots` for tracking which slots are loading.
- `RouterChangeDetail.toJSON()` for serialization-friendly debugging.
- `batchRouteUpdates()` for atomic multi-step route tree mutations with rollback
  support.
- `router.routes` getter/setter for frozen snapshot access and full tree
  replacement.
- `beforeLeave` guards run for side-slot branches before the main branch, sorted
  by slot name.
- `isSameDetail` extended to compare side-slot branches.
- `data-transition-direction` on `<router-view>` host for CSS direction-aware
  transitions.

### Changed

- `renderedBranches` refactored to `Map<string, HTMLElement[]>` for per-slot
  element tracking.
- `mountBranch` / `mountRouteBranch` unified main-chain and side-chain mount
  logic.
- `validateChildOutlet` extended to all used slots.
- Side-slot focus strategy: focus only moves when the user was already in the
  old side slot.

### Fixed

- Focus no longer stolen from main content when only side slots change.

## 1.0.1

### Added

- Route guards (`guard` and `beforeLeave`) with async support, redirects, and
  `AbortSignal` cancellation.
- Lazy loading (`load`) with deduplication and `AbortSignal` support.
- `route-loading-start` / `route-loading-end` events.
- `route-error` and `route-not-found` events.
- `RouterView` 404 and error fallback views with light DOM slot overrides.
- `router.resolveUrl()` and `router.resolveNamed()` for read-only resolution.
- `router.link()` and `router.linkAttributes()` for named-route reverse routing.
- `router.configure()` for updating multiple options at once.
- `router.push()` and `router.replace()` with `RouteLocation` input.
- `router.start()` / `router.stop()` lifecycle.
- `ScrollManager` with per-history-entry scroll restoration and bounded LRU
  cache.
- `data-route-focus` auto-focus after navigation.
- `<router-view>` `child-slot` and `no-view-transition` attributes.
- `RouteContext` explicit contract replacing legacy `routeDetail`/`routeParams`.

### Changed

- Migrated to current Lit decorator field syntax (`accessor` keyword).

## 1.0.0

### Added

- Route tree declared in TypeScript with `RouteDefinition[]`.
- `URLPattern`-based route matching with specificity ordering.
- Named `<slot>`-based nested route rendering.
- `Navigation API` integration.
- `View Transitions API` support in `<router-view>`.
- `basePath` support for sub-path deployments.
- Same-origin `<a>` click interception (HTML and SVG).
- History entry direction tracking with bounded bookkeeping.
- `route-change` and `route-tree-change` events.
- `RouterView` custom element with `router` property binding.
