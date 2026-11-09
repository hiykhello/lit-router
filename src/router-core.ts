import { browserDocument, browserWindow } from "./browser-env.ts";

type NavigationHistoryMode = "push" | "replace";
type MaybePromise<T> = T | Promise<T>;
export type NavigationDirection = "forward" | "backward" | "none";

export type RouteComponentFactory = (detail: RouterChangeDetail) => HTMLElement;
export type RouteParamValue = string | number | boolean;
export type RouteParamsInput = Record<
  string,
  RouteParamValue | null | undefined
>;
export type RouteQueryValue = string | number | boolean;
export type RouteQueryInit =
  | string
  | URLSearchParams
  | Record<string, RouteQueryValue | RouteQueryValue[] | null | undefined>;
export interface RouteLocation {
  name?: string;
  id?: string;
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}

export type RouteTarget = string | URL | RouteLocation;

export interface RouteIsActiveOptions {
  exact?: boolean;
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}

export interface RouteResolveOptions {
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}

export interface RouterLinkOptions {
  replace?: boolean;
}

export interface RouterLinkAttributes {
  href: string;
  "data-router-replace"?: "";
}

export type RouteGuardRedirect =
  | RouteTarget
  | {
      to: RouteTarget;
      replace?: boolean;
    };

export type RouteGuardResult = boolean | void | RouteGuardRedirect;
export type RouteGuard = (
  detail: RouterChangeDetail & {
    from: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  },
) => MaybePromise<RouteGuardResult>;
export type RouteLeaveGuard = (
  detail: RouterChangeDetail & {
    to: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  },
) => MaybePromise<RouteGuardResult>;

export interface RouteLoadContext {
  signal: AbortSignal;
  router?: Router;
  pathname?: string;
  localPathname?: string;
  params?: Record<string, string>;
  query?: URLSearchParams;
  hash?: string;
  url?: URL;
}

export type RouteLoader<T = unknown> = (
  context: RouteLoadContext,
) => MaybePromise<T>;

export type RouteMeta = Record<string, unknown>;

export interface RouteDefinition<TData = unknown> {
  id?: string;
  name?: string;
  path: string;
  slot?: string;
  title?: string | ((detail: RouterChangeDetail) => string);
  viewTransitionName?: string;
  /**
   * 路由组件。
   * 如果当前路由声明了 `children`，组件模板中需要提供
   * `<slot name="..."></slot>` 作为子路由出口。
   * 默认 slot 名为 `route-child`，也可以通过 router-view 的 `child-slot`
   * 属性修改。
   */
  component?: string | RouteComponentFactory;
  children?: RouteDefinition[];
  guard?: RouteGuard;
  beforeLeave?: RouteLeaveGuard;
  load?: (context?: RouteLoadContext) => Promise<unknown>;
  loader?: RouteLoader<TData>;
  meta?: RouteMeta;
  props?: Record<string, unknown>;
}

export type ReadonlyRouteDefinition = Readonly<
  Omit<RouteDefinition, "children" | "meta" | "props"> & {
    children?: readonly ReadonlyRouteDefinition[];
    meta?: Readonly<RouteMeta>;
    props?: Readonly<Record<string, unknown>>;
  }
>;

interface NavigationApi extends EventTarget {
  navigate: (
    url: string,
    options?: { history?: NavigationHistoryMode },
  ) => unknown;
  currentEntry?: {
    key?: string;
  };
}

interface NavigationDestination {
  url: string;
  key?: string;
}

interface NavigationRouteEvent extends Event {
  canIntercept?: boolean;
  destination: NavigationDestination;
  downloadRequest?: string | null;
  formData?: FormData | null;
  navigationType?: "push" | "replace" | "reload" | "traverse";
  intercept?: (options: {
    handler: () => Promise<void> | void;
    scroll?: "manual" | "after-transition";
  }) => void;
}

interface RedirectInstruction {
  to: URL;
  replace: boolean;
}

interface RouteTransitionOptions {
  history: NavigationHistoryMode | "none";
  skipIfSame?: boolean;
  redirectDepth?: number;
}

interface ActiveNavigation {
  id: number;
  url: URL;
  history: NavigationHistoryMode | "none";
  navigationKey?: string;
  detail: RouterChangeDetail | null;
  abortController: AbortController;
}

interface RouteRecord {
  route: RouteDefinition;
  params: Record<string, string>;
}

interface MatchedBranch {
  records: RouteRecord[];
  params: Record<string, string>;
}

type MatchedSlotBranches = Record<string, MatchedBranch>;

type NamedRouteBranch = RouteDefinition[];

interface CompiledRouteDefinition {
  route: RouteDefinition;
  normalizedPath: string;
  pattern: URLPattern | null;
  children: CompiledRouteDefinition[];
  childrenBySlot: Map<string, CompiledRouteDefinition[]>;
  minSegments: number;
  maxSegments: number;
  specificity: number[];
  sortIndex: number;
}

export interface RouterChangeDetail {
  pathname: string;
  localPathname: string;
  basePath: string;
  search: string;
  query: URLSearchParams;
  hash: string;
  params: Record<string, string>;
  branch: RouteDefinition[];
  leaf?: RouteDefinition;
  slotBranches?: Record<string, RouteDefinition[]>;
  slotParams?: Record<string, Record<string, string>>;
  slots?: Record<string, RouterSlotDetail>;
  url: URL;
  navigationKey: string;
  direction: NavigationDirection;
  routeData?: Map<RouteDefinition, unknown>;
  data?: unknown;
  meta?: RouteMeta;
  toJSON?: () => RouterChangeDetailJson;
}

export interface RouterSlotDetail {
  branch: RouteDefinition[];
  leaf?: RouteDefinition;
  params: Record<string, string>;
}

export interface RouterSlotDetailJson {
  branch: RouteDefinition[];
  leaf?: RouteDefinition;
  params: Record<string, string>;
}

export interface RouterChangeDetailJson {
  pathname: string;
  localPathname: string;
  basePath: string;
  search: string;
  query: Record<string, string | string[]>;
  hash: string;
  params: Record<string, string>;
  branch: RouteDefinition[];
  leaf?: RouteDefinition;
  slotBranches?: Record<string, RouteDefinition[]>;
  slotParams?: Record<string, Record<string, string>>;
  slots?: Record<string, RouterSlotDetailJson>;
  url: string;
  navigationKey: string;
  direction: NavigationDirection;
  data?: unknown;
  meta?: RouteMeta;
}

export interface RouteContext<TData = unknown> {
  detail: RouterChangeDetail;
  params: Record<string, string>;
  slot: string;
  branch: RouteDefinition[];
  data?: TData;
  meta?: RouteMeta;
}

export interface RouteContextReceiver<TData = unknown> {
  routeContext?: RouteContext<TData>;
  setRouteContext?: (context: RouteContext<TData>) => void;
  data?: TData;
}

export interface RouteNotFoundDetail {
  url: URL;
  basePath: string;
  direction: NavigationDirection;
}

export interface RouteErrorDetail {
  url: URL;
  error: unknown;
  phase: "guard" | "load" | "commit" | "unknown";
  direction: NavigationDirection;
}

export interface RouteLoadingDetail {
  url: URL;
  branch: RouteDefinition[];
  loadingSlots?: string[];
  pending: number;
  direction: NavigationDirection;
}

export interface RouterOptions {
  routes?: RouteDefinition[];
  basePath?: string;
  beforeRoute?: RouteGuard;
  autoStart?: boolean;
}

export interface RouteInsertOptions {
  parentId?: string;
  parentName?: string;
  index?: number;
}

export interface RouteSelector {
  id?: string;
  name?: string;
}

export interface RouteTreeChangeDetail {
  reason: "replace" | "insert" | "remove" | "batch";
  routeCount: number;
  routes: readonly ReadonlyRouteDefinition[];
}

export interface RouterEventMap {
  "route-change": RouterChangeDetail;
  "route-error": RouteErrorDetail;
  "route-loading-start": RouteLoadingDetail;
  "route-loading-end": RouteLoadingDetail;
  "route-not-found": RouteNotFoundDetail;
  "route-tree-change": RouteTreeChangeDetail;
}

export type RouterEvent<K extends keyof RouterEventMap = keyof RouterEventMap> =
  CustomEvent<RouterEventMap[K]>;

export type RouterEventListener<K extends keyof RouterEventMap> = (
  this: Router,
  event: RouterEvent<K>,
) => void;

function resolveRouteSelector(selector: string | RouteSelector): {
  type: "id" | "name";
  value: string;
} {
  if (typeof selector === "string") {
    return { type: "name", value: normalizeRouteName(selector) };
  }

  if (selector.id && selector.name) {
    throw new Error("Route selector must not include both id and name.");
  }

  if (selector.id) {
    return { type: "id", value: normalizeRouteId(selector.id) };
  }

  if (selector.name) {
    return { type: "name", value: normalizeRouteName(selector.name) };
  }

  throw new Error(
    "Route selector must include either a route id or route name.",
  );
}

const ROOT_PATH = "/";
const DEFAULT_CHILD_SLOT = "route-child";
const RESERVED_ROUTE_SLOTS = new Set(["404", "error"]);
const ROUTE_TOKEN_PATTERN = /:([A-Za-z0-9_-]+)(\([^)]*\))?([?+*])?/g;
const EXACT_PATH_END_SPECIFICITY = 3;
const MAX_NAVIGATION_ENTRY_ORDERS = 256;
const NAVIGATION_ENTRY_ORDER_PRUNE_TO = 128;

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === ROOT_PATH) {
    return ROOT_PATH;
  }

  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.startsWith(ROOT_PATH) ? trimmed : `${ROOT_PATH}${trimmed}`;
}

function normalizeBasePath(basePath: string): string {
  return normalizePathname(basePath || ROOT_PATH);
}

function stripBasePath(pathname: string, basePath: string): string | null {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedBase = normalizeBasePath(basePath);

  if (normalizedBase === ROOT_PATH) {
    return normalizedPathname;
  }

  if (normalizedPathname === normalizedBase) {
    return ROOT_PATH;
  }

  if (!normalizedPathname.startsWith(`${normalizedBase}/`)) {
    return null;
  }

  return normalizePathname(normalizedPathname.slice(normalizedBase.length));
}

function splitSegments(pathname: string): string[] {
  const normalized = normalizePathname(pathname);
  return normalized === ROOT_PATH
    ? []
    : normalized.slice(1).split("/").filter(Boolean);
}

function normalizeRoutePath(path: string): string {
  if (!path || path === ROOT_PATH) {
    return ROOT_PATH;
  }

  if (path === "*") {
    return "*";
  }

  return normalizePathname(path.startsWith(ROOT_PATH) ? path : `/${path}`);
}

function normalizeRouteName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Route name must be a non-empty string.");
  }
  return normalized;
}

function normalizeRouteId(id: string): string {
  const normalized = id.trim();
  if (!normalized) {
    throw new Error("Route id must be a non-empty string.");
  }
  return normalized;
}

function normalizeRouteSlot(slot: string | undefined): string {
  if (slot === undefined) {
    return DEFAULT_CHILD_SLOT;
  }

  const normalized = slot.trim();
  if (!normalized) {
    throw new Error("Route slot must be a non-empty string.");
  }

  if (RESERVED_ROUTE_SLOTS.has(normalized)) {
    throw new Error(`Route slot "${normalized}" is reserved.`);
  }

  return normalized;
}

function candidatePrefixes(segments: string[]): string[] {
  const prefixes = new Array<string>(segments.length + 1);
  prefixes[0] = ROOT_PATH;

  let current = "";
  for (let index = 0; index < segments.length; index += 1) {
    current += `${ROOT_PATH}${segments[index]}`;
    prefixes[index + 1] = current;
  }

  return prefixes;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function hasUrlPatternSupport(): boolean {
  return typeof URLPattern !== "undefined";
}

function createPattern(
  path: string,
  routePatternCache: Map<string, URLPattern | null>,
): URLPattern | null {
  const normalizedPath = path === "*" ? "*" : normalizeRoutePath(path);
  const cachedPattern = routePatternCache.get(normalizedPath);
  if (cachedPattern !== undefined) {
    return cachedPattern;
  }

  if (!hasUrlPatternSupport()) {
    return null;
  }

  try {
    const pattern = new URLPattern({
      pathname: normalizedPath,
    });
    routePatternCache.set(normalizedPath, pattern);
    return pattern;
  } catch {
    routePatternCache.set(normalizedPath, null);
    return null;
  }
}

interface PatternMatch {
  consumedCount: number;
  params: Record<string, string>;
}

interface PendingRouteLoad {
  promise: Promise<void>;
  signal: AbortSignal;
}

function routeSegmentRange(path: string): {
  minSegments: number;
  maxSegments: number;
} {
  const normalizedPath = normalizeRoutePath(path);
  if (normalizedPath === ROOT_PATH) {
    return { minSegments: 0, maxSegments: 0 };
  }

  if (normalizedPath === "*") {
    return { minSegments: 0, maxSegments: Number.POSITIVE_INFINITY };
  }

  let minSegments = 0;
  let maxSegments = 0;

  for (const segment of splitSegments(normalizedPath)) {
    const tokens = Array.from(segment.matchAll(ROUTE_TOKEN_PATTERN));
    if (tokens.length === 0) {
      minSegments += 1;
      maxSegments += 1;
      continue;
    }

    let hasRequiredContent = false;
    let lastIndex = 0;
    let segmentCanExpand = false;

    for (const match of tokens) {
      const [token, _key, _pattern, modifier] = match;
      const staticPrefix = segment.slice(lastIndex, match.index);
      if (staticPrefix) {
        hasRequiredContent = true;
      }

      if (modifier === "+" || !modifier) {
        hasRequiredContent = true;
      }

      if (modifier === "+" || modifier === "*") {
        segmentCanExpand = true;
      }

      lastIndex = (match.index ?? 0) + token.length;
    }

    if (segment.slice(lastIndex)) {
      hasRequiredContent = true;
    }

    if (hasRequiredContent) {
      minSegments += 1;
    }
    maxSegments = segmentCanExpand ? Number.POSITIVE_INFINITY : maxSegments + 1;
  }

  return { minSegments, maxSegments };
}

function decodePatternParams(
  groups: Record<string, string | undefined>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(groups)) {
    if (value) {
      params[key] = decodeSegment(value);
    }
  }
  return params;
}

function execPatternMatches(
  route: CompiledRouteDefinition,
  remainingSegments: string[],
  prefixes: string[],
): PatternMatch[] {
  const normalized = route.normalizedPath;

  if (normalized === "*") {
    return [
      {
        consumedCount: remainingSegments.length,
        params: { "*": remainingSegments.join("/") },
      },
    ];
  }

  if (!route.pattern) {
    return [];
  }

  const matches: PatternMatch[] = [];
  const maxConsumedCount = Math.min(
    route.maxSegments,
    remainingSegments.length,
  );

  for (
    let consumedCount = route.minSegments;
    consumedCount <= maxConsumedCount;
    consumedCount += 1
  ) {
    const result = route.pattern.exec({
      pathname: prefixes[consumedCount],
    });
    if (!result) {
      continue;
    }

    matches.push({
      consumedCount,
      params: decodePatternParams(result.pathname.groups),
    });
  }

  return matches;
}

function shallowEqualRecord(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function isSameDetail(
  current: RouterChangeDetail,
  next: RouterChangeDetail,
): boolean {
  if (
    current.pathname !== next.pathname ||
    current.localPathname !== next.localPathname ||
    current.basePath !== next.basePath ||
    current.search !== next.search ||
    current.hash !== next.hash ||
    current.branch.length !== next.branch.length
  ) {
    return false;
  }

  if (!shallowEqualRecord(current.params, next.params)) {
    return false;
  }

  if (!current.branch.every((route, index) => route === next.branch[index])) {
    return false;
  }

  const currentSlots = current.slotBranches ?? {};
  const nextSlots = next.slotBranches ?? {};
  const currentSlotNames = Object.keys(currentSlots).sort();
  const nextSlotNames = Object.keys(nextSlots).sort();

  if (currentSlotNames.length !== nextSlotNames.length) {
    return false;
  }

  const currentSlotParams = current.slotParams ?? {};
  const nextSlotParams = next.slotParams ?? {};
  for (const slotName of currentSlotNames) {
    if (
      !shallowEqualRecord(
        currentSlotParams[slotName] ?? {},
        nextSlotParams[slotName] ?? {},
      )
    ) {
      return false;
    }
  }

  return currentSlotNames.every((slotName, index) => {
    if (slotName !== nextSlotNames[index]) {
      return false;
    }

    const currentBranch = currentSlots[slotName] ?? [];
    const nextBranch = nextSlots[slotName] ?? [];
    return (
      currentBranch.length === nextBranch.length &&
      currentBranch.every(
        (route, branchIndex) => route === nextBranch[branchIndex],
      )
    );
  });
}

function sharedBranchPrefixLength(
  current: RouteDefinition[],
  next: RouteDefinition[],
): number {
  let index = 0;
  const maxLength = Math.min(current.length, next.length);

  while (index < maxLength && current[index] === next[index]) {
    index += 1;
  }

  return index;
}

function branchRoutes(branch: MatchedBranch): RouteDefinition[] {
  return branch.records.map((record) => record.route);
}

function createSlotDetail(branch: MatchedBranch): RouterSlotDetail {
  const routes = branchRoutes(branch);
  return {
    branch: routes,
    leaf: routes.at(-1),
    params: branch.params,
  };
}

function queryToJson(
  query: URLSearchParams,
): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};
  query.forEach((value, key) => {
    const existing = output[key];
    if (existing === undefined) {
      output[key] = value;
      return;
    }

    output[key] = Array.isArray(existing)
      ? [...existing, value]
      : [existing, value];
  });
  return output;
}

function detailToJSON(this: RouterChangeDetail): RouterChangeDetailJson {
  return {
    pathname: this.pathname,
    localPathname: this.localPathname,
    basePath: this.basePath,
    search: this.search,
    query: queryToJson(this.query),
    hash: this.hash,
    params: this.params,
    branch: this.branch,
    leaf: this.leaf,
    slotBranches: this.slotBranches,
    slotParams: this.slotParams,
    slots: this.slots,
    url: this.url.href,
    navigationKey: this.navigationKey,
    direction: this.direction,
    data: this.data,
    meta: this.meta,
  };
}

function collectMatchedRoutes(detail: RouterChangeDetail): RouteDefinition[] {
  const routes: RouteDefinition[] = [];
  const seen = new Set<RouteDefinition>();

  for (const route of detail.branch) {
    seen.add(route);
    routes.push(route);
  }

  const slotBranches = detail.slotBranches ?? {};
  for (const slotName of Object.keys(slotBranches).sort()) {
    for (const route of slotBranches[slotName] ?? []) {
      if (seen.has(route)) {
        continue;
      }

      seen.add(route);
      routes.push(route);
    }
  }

  return routes;
}

export function collectLeavingRoutes(
  from: RouterChangeDetail,
  to: RouterChangeDetail | null,
): RouteDefinition[] {
  const routes: RouteDefinition[] = [];
  const seen = new Set<RouteDefinition>();
  const fromSlotBranches = from.slotBranches ?? {};
  const toSlotBranches = to?.slotBranches ?? {};

  for (const slotName of Object.keys(fromSlotBranches).sort()) {
    const fromBranch = fromSlotBranches[slotName] ?? [];
    const toBranch = toSlotBranches[slotName] ?? [];
    const prefixLength = sharedBranchPrefixLength(fromBranch, toBranch);
    for (const route of fromBranch.slice(prefixLength).reverse()) {
      if (from.branch.includes(route) || seen.has(route)) {
        continue;
      }

      seen.add(route);
      routes.push(route);
    }
  }

  const mainPrefixLength = sharedBranchPrefixLength(
    from.branch,
    to?.branch ?? [],
  );
  for (const route of from.branch.slice(mainPrefixLength).reverse()) {
    if (seen.has(route)) {
      continue;
    }

    seen.add(route);
    routes.push(route);
  }

  return routes;
}

function detailBranches(detail: RouterChangeDetail): RouteDefinition[][] {
  const branches = Object.values(detail.slotBranches ?? {});
  return detail.branch.length ? [detail.branch, ...branches] : branches;
}

function buildNamedRouteIndex(
  routes: RouteDefinition[],
  parentBranch: NamedRouteBranch = [],
  index = new Map<string, NamedRouteBranch>(),
): Map<string, NamedRouteBranch> {
  for (const route of routes) {
    const branch = [...parentBranch, route];

    if (route.name) {
      const name = normalizeRouteName(route.name);
      if (index.has(name)) {
        throw new Error(`Duplicate route name "${name}" detected.`);
      }
      index.set(name, branch);
    }

    if (route.children?.length) {
      buildNamedRouteIndex(route.children, branch, index);
    }
  }

  return index;
}

function buildRouteIdIndex(
  routes: RouteDefinition[],
  parentBranch: NamedRouteBranch = [],
  index = new Map<string, NamedRouteBranch>(),
): Map<string, NamedRouteBranch> {
  for (const route of routes) {
    const branch = [...parentBranch, route];

    if (route.id) {
      const id = normalizeRouteId(route.id);
      if (index.has(id)) {
        throw new Error(`Duplicate route id "${id}" detected.`);
      }
      index.set(id, branch);
    }

    if (route.children?.length) {
      buildRouteIdIndex(route.children, branch, index);
    }
  }

  return index;
}

function segmentSpecificity(segment: string): number {
  if (segment === "*") {
    return 1;
  }

  const tokens = Array.from(segment.matchAll(ROUTE_TOKEN_PATTERN));
  if (tokens.length === 0) {
    return 5;
  }

  if (tokens.some(([, , , modifier]) => modifier === "*" || modifier === "+")) {
    return 1;
  }

  if (tokens.some(([, , , modifier]) => modifier === "?")) {
    return 2;
  }

  return 4;
}

function routeSpecificity(path: string): number[] {
  const normalizedPath = normalizeRoutePath(path);
  if (normalizedPath === ROOT_PATH) {
    return [];
  }

  if (normalizedPath === "*") {
    return [1];
  }

  return splitSegments(normalizedPath).map((segment) =>
    segmentSpecificity(segment),
  );
}

function compareRouteSpecificity(
  left: CompiledRouteDefinition,
  right: CompiledRouteDefinition,
): number {
  const maxLength = Math.max(left.specificity.length, right.specificity.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftScore =
      index < left.specificity.length
        ? left.specificity[index]
        : EXACT_PATH_END_SPECIFICITY;
    const rightScore =
      index < right.specificity.length
        ? right.specificity[index]
        : EXACT_PATH_END_SPECIFICITY;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
  }

  return left.sortIndex - right.sortIndex;
}

function groupBySlot(
  routes: CompiledRouteDefinition[],
): Map<string, CompiledRouteDefinition[]> {
  const map = new Map<string, CompiledRouteDefinition[]>();
  for (const route of routes) {
    const slot = normalizeRouteSlot(route.route.slot);
    let group = map.get(slot);
    if (!group) {
      group = [];
      map.set(slot, group);
    }
    group.push(route);
  }
  return map;
}

function buildCompiledRoutes(
  routes: RouteDefinition[],
  routePatternCache: Map<string, URLPattern | null>,
): CompiledRouteDefinition[] {
  const compiled = routes.map((route, sortIndex) => {
    normalizeRouteSlot(route.slot);
    const normalizedPath = normalizeRoutePath(route.path);
    const { minSegments, maxSegments } = routeSegmentRange(normalizedPath);
    const children = route.children?.length
      ? buildCompiledRoutes(route.children, routePatternCache)
      : [];
    return {
      route,
      normalizedPath,
      pattern:
        normalizedPath === "*"
          ? null
          : createPattern(normalizedPath, routePatternCache),
      children,
      childrenBySlot: groupBySlot(children),
      minSegments,
      maxSegments,
      specificity: routeSpecificity(normalizedPath),
      sortIndex,
    };
  });
  compiled.sort(compareRouteSpecificity);
  return compiled;
}

function cloneRouteDefinition(route: RouteDefinition): RouteDefinition {
  return {
    ...route,
    meta: route.meta ? { ...route.meta } : undefined,
    props: route.props ? { ...route.props } : undefined,
    children: route.children?.length
      ? cloneRouteDefinitions(route.children)
      : undefined,
  };
}

function cloneRouteDefinitions(routes: RouteDefinition[]): RouteDefinition[] {
  return routes.map((route) => cloneRouteDefinition(route));
}

function freezeRouteDefinition(
  route: RouteDefinition,
): ReadonlyRouteDefinition {
  const snapshot: ReadonlyRouteDefinition = {
    ...route,
    meta: route.meta ? Object.freeze({ ...route.meta }) : undefined,
    props: route.props ? Object.freeze({ ...route.props }) : undefined,
    children: route.children?.length
      ? freezeRouteDefinitions(route.children)
      : undefined,
  };
  return Object.freeze(snapshot);
}

function freezeRouteDefinitions(
  routes: RouteDefinition[],
): readonly ReadonlyRouteDefinition[] {
  return Object.freeze(routes.map((route) => freezeRouteDefinition(route)));
}

function countRouteDefinitions(routes: RouteDefinition[]): number {
  return routes.reduce(
    (count, route) => count + 1 + countRouteDefinitions(route.children ?? []),
    0,
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function normalizeInsertionIndex(
  index: number | undefined,
  length: number,
): number {
  if (index === undefined) {
    return length;
  }

  if (!Number.isInteger(index) || index < 0 || index > length) {
    throw new Error(
      `Route insertion index must be an integer between 0 and ${length}.`,
    );
  }

  return index;
}

function removeNamedRouteFromTree(
  routes: RouteDefinition[],
  name: string,
): boolean {
  const directIndex = routes.findIndex((route) =>
    route.name ? normalizeRouteName(route.name) === name : false,
  );
  if (directIndex >= 0) {
    routes.splice(directIndex, 1);
    return true;
  }

  for (const route of routes) {
    if (!route.children?.length) {
      continue;
    }

    if (removeNamedRouteFromTree(route.children, name)) {
      if (route.children.length === 0) {
        route.children = undefined;
      }
      return true;
    }
  }

  return false;
}

function removeRouteByIdFromTree(
  routes: RouteDefinition[],
  id: string,
): boolean {
  const directIndex = routes.findIndex((route) =>
    route.id ? normalizeRouteId(route.id) === id : false,
  );
  if (directIndex >= 0) {
    routes.splice(directIndex, 1);
    return true;
  }

  for (const route of routes) {
    if (!route.children?.length) {
      continue;
    }

    if (removeRouteByIdFromTree(route.children, id)) {
      if (route.children.length === 0) {
        route.children = undefined;
      }
      return true;
    }
  }

  return false;
}

function encodeRouteParamValue(
  key: string,
  value: RouteParamValue | null | undefined,
): string {
  if (value === null || value === undefined) {
    throw new Error(`Missing route param "${key}".`);
  }

  return encodeURIComponent(String(value));
}

function expandSplatSegments(
  value: RouteParamValue | null | undefined,
): string[] {
  if (value === null || value === undefined) {
    throw new Error('Missing route param "*".');
  }

  return String(value)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
}

function fillRouteSegment(segment: string, params: RouteParamsInput): string[] {
  if (segment === "*") {
    return expandSplatSegments(params["*"]);
  }

  let supported = false;
  let output = "";
  let lastIndex = 0;

  for (const match of segment.matchAll(ROUTE_TOKEN_PATTERN)) {
    supported = true;
    const [token, key, _pattern, modifier] = match;
    if (modifier && modifier !== "?") {
      throw new Error(
        `Route path segment "${segment}" uses unsupported reverse-routing modifier "${modifier}" in token "${token}".`,
      );
    }

    output += segment.slice(lastIndex, match.index);
    if (
      modifier === "?" &&
      (params[key] === null || params[key] === undefined)
    ) {
      lastIndex = (match.index ?? 0) + token.length;
      continue;
    }
    output += encodeRouteParamValue(key, params[key]);
    lastIndex = (match.index ?? 0) + token.length;
  }

  if (!supported) {
    return [segment];
  }

  output += segment.slice(lastIndex);
  return output ? [output] : [];
}

function buildLocalPathname(
  branch: NamedRouteBranch,
  params: RouteParamsInput = {},
): string {
  const segments: string[] = [];

  for (const route of branch) {
    const normalizedPath = normalizeRoutePath(route.path);
    if (normalizedPath === ROOT_PATH) {
      continue;
    }

    for (const segment of splitSegments(normalizedPath)) {
      segments.push(...fillRouteSegment(segment, params));
    }
  }

  return segments.length ? `/${segments.join("/")}` : ROOT_PATH;
}

function toSearchParams(query?: RouteQueryInit): URLSearchParams {
  if (!query) {
    return new URLSearchParams();
  }

  if (typeof query === "string") {
    return new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  }

  if (query instanceof URLSearchParams) {
    return new URLSearchParams(query);
  }

  const searchParams = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      searchParams.append(key, String(value));
    }
  }

  return searchParams;
}

function mergeQueries(
  base?: RouteQueryInit,
  override?: RouteQueryInit,
): URLSearchParams | undefined {
  if (!base && !override) {
    return undefined;
  }
  const result = toSearchParams(base);
  if (override) {
    const overrideParams = toSearchParams(override);
    const seen = new Set<string>();
    for (const key of overrideParams.keys()) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.delete(key);
      for (const val of overrideParams.getAll(key)) {
        result.append(key, val);
      }
    }
  }
  return result;
}

function createSearchString(query?: RouteQueryInit): string {
  const params = toSearchParams(query);
  const search = params.toString();
  return search ? `?${search}` : "";
}

function normalizeHash(hash?: string): string {
  if (!hash) {
    return "";
  }

  return hash.startsWith("#") ? hash : `#${hash}`;
}

function matchSlotRoutes(
  routes: CompiledRouteDefinition[],
  remainingSegments: string[],
  parentRecords: RouteRecord[] = [],
  parentParams: Record<string, string> = {},
): MatchedSlotBranches {
  const slotResults: MatchedSlotBranches = {};
  const matchCache = new Map<string, PatternMatch[]>();
  const prefixes = candidatePrefixes(remainingSegments);

  for (const route of routes) {
    const slot = normalizeRouteSlot(route.route.slot);
    if (slot in slotResults) {
      continue;
    }

    const normalizedPath = route.normalizedPath;
    const cacheKey = normalizedPath;
    let matches = matchCache.get(cacheKey);
    if (!matches) {
      matches = execPatternMatches(route, remainingSegments, prefixes);
      matchCache.set(cacheKey, matches);
    }

    if (matches.length === 0) {
      continue;
    }

    for (const match of matches) {
      const record: RouteRecord = {
        route: route.route,
        params: {
          ...parentParams,
          ...match.params,
        },
      };

      const nextRemaining = remainingSegments.slice(match.consumedCount);
      const branch = [...parentRecords, record];
      const childResults = route.children.length
        ? matchSlotRoutes(route.children, nextRemaining, branch, record.params)
        : {};
      const defaultChildBranch = childResults[DEFAULT_CHILD_SLOT];
      const terminalMatch =
        nextRemaining.length === 0 || normalizedPath === "*";
      const acceptedBranch =
        defaultChildBranch ??
        (terminalMatch ? { records: branch, params: record.params } : null);

      if (!acceptedBranch) {
        continue;
      }

      slotResults[slot] = acceptedBranch;
      for (const [childSlot, childBranch] of Object.entries(childResults)) {
        if (childSlot === DEFAULT_CHILD_SLOT || childSlot in slotResults) {
          continue;
        }

        slotResults[childSlot] = childBranch;
      }
      break;
    }
  }

  return slotResults;
}

export class Router extends EventTarget {
  private static activeRouter?: Router;

  private routeTree: RouteDefinition[] = [];
  basePath: string;
  beforeRoute?: RouteGuard;

  current: RouterChangeDetail = {
    pathname: ROOT_PATH,
    localPathname: ROOT_PATH,
    basePath: ROOT_PATH,
    search: "",
    query: new URLSearchParams(),
    hash: "",
    params: {},
    branch: [],
    url: new URL(browserWindow().location.href),
    navigationKey: "",
    direction: "none",
  };

  private readonly loadedRoutes = new WeakSet<RouteDefinition>();
  private readonly pendingRouteLoads = new WeakMap<
    RouteDefinition,
    PendingRouteLoad
  >();
  private readonly routePatternCache = new Map<string, URLPattern | null>();
  private compiledRoutes: CompiledRouteDefinition[] = [];
  private routeIds = new Map<string, NamedRouteBranch>();
  private namedRoutes = new Map<string, NamedRouteBranch>();
  private readonlyRoutes: readonly ReadonlyRouteDefinition[] = Object.freeze(
    [],
  );
  private routeCount = 0;
  private readonly navigationEntryOrders = new Map<string, number>();
  private nextNavigationEntryOrder = 0;
  private navigationId = 0;
  private activeNavigation?: ActiveNavigation;
  private browserNavigation?: NavigationApi;
  private readonly maxRedirectDepth = 3;
  private readonly pendingRedirectDepths = new Map<string, number>();
  private activeRouteLoads = 0;
  private started = false;
  private routeMutationDepth = 0;
  private pendingRouteRefreshSkipIfSame?: boolean;
  private pendingRouteTreeChange = false;
  private lastRouteErrorDetail?: RouteErrorDetail;
  private lastRouteNotFoundDetail?: RouteNotFoundDetail;
  private readonly dynamicLeaveGuards = new Set<RouteLeaveGuard>();

  addEventListener<K extends keyof RouterEventMap>(
    type: K,
    listener: RouterEventListener<K> | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener:
      | EventListenerOrEventListenerObject
      | RouterEventListener<keyof RouterEventMap>
      | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    );
  }

  removeEventListener<K extends keyof RouterEventMap>(
    type: K,
    listener: RouterEventListener<K> | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener:
      | EventListenerOrEventListenerObject
      | RouterEventListener<keyof RouterEventMap>
      | null,
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    );
  }

  private readonly onDocumentClick = (event: MouseEvent) => {
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    let anchor: Element | undefined;
    if (path.length > 0) {
      anchor = path.find((item) => this.isNavigableAnchor(item)) as
        Element | undefined;
    } else {
      let current: Node | null = event.target as Node | null;
      while (current) {
        if (this.isNavigableAnchor(current)) {
          anchor = current;
          break;
        }
        current = current.parentElement;
      }
    }

    if (!anchor) {
      return;
    }

    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = anchor.getAttribute("target");
    if (target && target !== "_self") {
      return;
    }

    const rel = anchor.getAttribute("rel");
    if (rel && rel.split(/\s+/).includes("external")) {
      return;
    }

    // Check if anchor or any clicked child element should be ignored
    if (path.length > 0) {
      for (const item of path) {
        if (item instanceof Element) {
          if (
            item.hasAttribute("data-router-ignore") ||
            item.hasAttribute("download") ||
            item.hasAttribute("disabled") ||
            item.getAttribute("aria-disabled") === "true"
          ) {
            return;
          }
        }
        if (item === anchor) {
          break;
        }
      }
    } else {
      let current = event.target as Element | null;
      while (current && current !== anchor.parentElement) {
        if (
          current.hasAttribute("data-router-ignore") ||
          current.hasAttribute("download") ||
          current.hasAttribute("disabled") ||
          current.getAttribute("aria-disabled") === "true"
        ) {
          return;
        }
        current = current.parentElement;
      }
    }

    const href = this.getAnchorHref(anchor);
    if (!href || href.startsWith("#")) {
      return;
    }

    const browser = browserWindow();
    let url: URL;
    try {
      url = new URL(href, browser.location.href);
    } catch {
      return;
    }
    if (url.origin !== browser.location.origin) {
      return;
    }

    if (!this.managesUrl(url)) {
      return;
    }

    const shouldReplace = anchor.hasAttribute("data-router-replace");
    event.preventDefault();
    this.navigate(url, shouldReplace ? "replace" : "push");
  };

  private readonly onNavigate = (event: Event) => {
    const navigateEvent = event as NavigationRouteEvent;

    if (
      navigateEvent.defaultPrevented ||
      !navigateEvent.canIntercept ||
      !navigateEvent.intercept
    ) {
      return;
    }

    if (navigateEvent.downloadRequest || navigateEvent.formData) {
      return;
    }

    const nextUrl = new URL(navigateEvent.destination.url);
    if (nextUrl.origin !== browserWindow().location.origin) {
      return;
    }

    if (!this.managesUrl(nextUrl)) {
      return;
    }

    const redirectDepth = this.consumePendingRedirectDepth(nextUrl);

    navigateEvent.intercept({
      scroll: "manual",
      handler: async () => {
        await this.routeTo(nextUrl, {
          history: "none",
          navigationKey: navigateEvent.destination.key,
          redirectDepth,
        });
      },
    });
  };

  constructor(options: RouterOptions = {}) {
    super();
    this.routeTree = cloneRouteDefinitions(options.routes ?? []);
    this.basePath = normalizeBasePath(options.basePath ?? ROOT_PATH);
    this.beforeRoute = options.beforeRoute;
    this.current = {
      ...this.current,
      basePath: this.basePath,
      url: new URL(browserWindow().location.href),
    };
    this.rebuildRouteState();

    if (options.autoStart !== false) {
      this.start();
    }
  }

  get routes(): readonly ReadonlyRouteDefinition[] {
    return this.readonlyRoutes;
  }

  set routes(routes: RouteDefinition[]) {
    this.replaceRouteTree(routes, {
      skipIfSame: false,
      reason: "replace",
    });
  }

  start(): void {
    if (this.started) {
      return;
    }

    if (!hasUrlPatternSupport()) {
      throw new Error(
        "Router requires URLPattern support. Use a modern browser or provide a URLPattern polyfill before starting the router.",
      );
    }

    if (Router.activeRouter && Router.activeRouter !== this) {
      throw new Error(
        "Only one Router instance can be started at a time in single-router mode.",
      );
    }

    const navigationApi = this.requireNavigationApi();
    this.browserNavigation = navigationApi;
    this.ensureNavigationEntryOrder(this.getCurrentNavigationEntryKey());
    this.started = true;
    Router.activeRouter = this;
    browserDocument().addEventListener("click", this.onDocumentClick);
    navigationApi.addEventListener("navigate", this.onNavigate);
    void this.routeTo(new URL(browserWindow().location.href), {
      history: "none",
      skipIfSame: false,
    });
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.activeNavigation?.abortController.abort();
    this.navigationId += 1;
    this.activeNavigation = undefined;
    this.started = false;
    if (Router.activeRouter === this) {
      Router.activeRouter = undefined;
    }
    browserDocument().removeEventListener("click", this.onDocumentClick);
    this.browserNavigation?.removeEventListener("navigate", this.onNavigate);
    this.browserNavigation = undefined;
  }

  configure(
    options: Pick<RouterOptions, "routes" | "basePath" | "beforeRoute">,
  ): void {
    if ("routes" in options) {
      this.routeTree = cloneRouteDefinitions(options.routes ?? []);
      this.rebuildRouteState();
      this.notifyRouteTreeChanged("replace");
    }

    if (options.basePath !== undefined) {
      this.basePath = normalizeBasePath(options.basePath);
    }

    if ("beforeRoute" in options) {
      this.beforeRoute = options.beforeRoute;
    }

    this.requestRouteRefresh(false);
  }

  setRoutes(routes: RouteDefinition[]): void {
    this.replaceRouteTree(routes, {
      skipIfSame: false,
      reason: "replace",
    });
  }

  insertRoutes(
    routes: RouteDefinition[],
    options: RouteInsertOptions = {},
  ): void {
    if (routes.length === 0) {
      return;
    }

    const additions = cloneRouteDefinitions(routes);
    const insertedIds = buildRouteIdIndex(additions);
    const insertedNames = buildNamedRouteIndex(additions);
    for (const id of insertedIds.keys()) {
      if (this.routeIds.has(id)) {
        throw new Error(`Duplicate route id "${id}" detected.`);
      }
    }
    for (const name of insertedNames.keys()) {
      if (this.namedRoutes.has(name)) {
        throw new Error(`Duplicate route name "${name}" detected.`);
      }
    }

    let siblings = this.routeTree;
    if (options.parentId && options.parentName) {
      throw new Error("Provide either parentId or parentName, not both.");
    }

    if (options.parentId || options.parentName) {
      const parent = this.resolveRouteBranch({
        id: options.parentId,
        name: options.parentName,
      }).at(-1);
      if (!parent) {
        throw new Error("Unknown parent route.");
      }
      siblings = parent.children ??= [];
    }

    const insertionIndex = normalizeInsertionIndex(
      options.index,
      siblings.length,
    );

    siblings.splice(insertionIndex, 0, ...additions);
    this.rebuildRouteState();
    this.notifyRouteTreeChanged("insert");
    this.requestRouteRefresh(true);
  }

  removeRoute(selector: string | RouteSelector): boolean {
    const resolvedSelector = resolveRouteSelector(selector);
    const removed =
      resolvedSelector.type === "id"
        ? removeRouteByIdFromTree(this.routeTree, resolvedSelector.value)
        : removeNamedRouteFromTree(this.routeTree, resolvedSelector.value);
    if (!removed) {
      return false;
    }

    this.rebuildRouteState();
    this.notifyRouteTreeChanged("remove");
    this.requestRouteRefresh(true);
    return true;
  }

  batchRouteUpdates(update: () => void): void {
    const isOutermostBatch = this.routeMutationDepth === 0;
    const snapshot = isOutermostBatch
      ? {
          routeTree: cloneRouteDefinitions(this.routeTree),
          basePath: this.basePath,
          beforeRoute: this.beforeRoute,
        }
      : undefined;

    this.routeMutationDepth += 1;
    try {
      const result = update();
      if (isPromiseLike(result)) {
        throw new Error("batchRouteUpdates callback must be synchronous.");
      }
    } catch (error) {
      if (isOutermostBatch && snapshot) {
        this.routeTree = snapshot.routeTree;
        this.basePath = snapshot.basePath;
        this.beforeRoute = snapshot.beforeRoute;
        this.rebuildRouteState();
        this.pendingRouteTreeChange = false;
        this.pendingRouteRefreshSkipIfSame = undefined;
      }
      throw error;
    } finally {
      this.routeMutationDepth -= 1;
    }

    if (this.routeMutationDepth > 0) {
      return;
    }

    const pendingRouteTreeChange = this.pendingRouteTreeChange;
    const pendingRouteRefreshSkipIfSame = this.pendingRouteRefreshSkipIfSame;
    this.pendingRouteTreeChange = false;
    this.pendingRouteRefreshSkipIfSame = undefined;

    if (pendingRouteTreeChange) {
      this.dispatchRouteTreeChange("batch");
    }

    if (pendingRouteRefreshSkipIfSame !== undefined) {
      this.requestRouteRefresh(pendingRouteRefreshSkipIfSame);
    }
  }

  push(url: string | URL | RouteLocation): void {
    this.navigate(url, "push");
  }

  replace(url: string | URL | RouteLocation): void {
    this.navigate(url, "replace");
  }

  back(): void {
    const nav = this.navigationApi as NavigationApi & { back?: () => void };
    if (typeof nav.back === "function") {
      nav.back();
    } else {
      browserWindow().history.back();
    }
  }

  forward(): void {
    const nav = this.navigationApi as NavigationApi & { forward?: () => void };
    if (typeof nav.forward === "function") {
      nav.forward();
    } else {
      browserWindow().history.forward();
    }
  }

  go(delta: number): void {
    browserWindow().history.go(delta);
  }

  resolve(target: RouteTarget): RouterChangeDetail | null {
    const url = this.toRouteUrl(target);
    return this.resolveMatched(url);
  }

  resolveUrl(target: string | URL): RouterChangeDetail | null {
    const url = this.toRouteUrl(target);
    return this.resolveMatched(url);
  }

  resolveNamed(
    name: string,
    options: RouteResolveOptions = {},
  ): RouterChangeDetail | null {
    return this.resolveMatched(this.toRouteUrl({ name, ...options }));
  }

  resolveId(
    id: string,
    options: RouteResolveOptions = {},
  ): RouterChangeDetail | null {
    return this.resolveMatched(this.toRouteUrl({ id, ...options }));
  }

  link(target: RouteTarget): string {
    const url = this.toRouteUrl(target);
    const browser = browserWindow();
    if (url.origin !== browser.location.origin) {
      return url.href;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  }

  linkAttributes(
    target: RouteTarget,
    options: RouterLinkOptions = {},
  ): RouterLinkAttributes {
    const href = this.link(target);
    return options.replace ? { href, "data-router-replace": "" } : { href };
  }

  registerLeaveGuard(guard: RouteLeaveGuard): () => void {
    this.dynamicLeaveGuards.add(guard);
    return () => {
      this.dynamicLeaveGuards.delete(guard);
    };
  }

  isActive(
    target: RouteTarget | RouteSelector,
    options: RouteIsActiveOptions = {},
  ): boolean {
    if (this.current.branch.length === 0) {
      return false;
    }

    const allBranches = detailBranches(this.current);

    if (
      typeof target === "object" &&
      target !== null &&
      !(target instanceof URL)
    ) {
      if ("id" in target && typeof target.id === "string" && target.id.trim()) {
        const id = normalizeRouteId(target.id);
        const isMatch = options.exact
          ? allBranches.some((b) => b[b.length - 1]?.id === id)
          : allBranches.some((b) => b.some((r) => r.id === id));
        if (!isMatch) {
          return false;
        }
        const location = target as RouteLocation;
        const combinedParams = {
          ...location.params,
          ...options.params,
        };
        const combinedQuery = mergeQueries(location.query, options.query);
        const targetHash = location.hash ?? options.hash;
        return this.matchesParamsAndQuery(
          combinedParams,
          combinedQuery,
          targetHash,
        );
      }

      if (
        "name" in target &&
        typeof target.name === "string" &&
        target.name.trim()
      ) {
        const name = normalizeRouteName(target.name);
        const isMatch = options.exact
          ? allBranches.some((b) => b[b.length - 1]?.name === name)
          : allBranches.some((b) => b.some((r) => r.name === name));
        if (!isMatch) {
          return false;
        }
        const location = target as RouteLocation;
        const combinedParams = {
          ...location.params,
          ...options.params,
        };
        const combinedQuery = mergeQueries(location.query, options.query);
        const targetHash = location.hash ?? options.hash;
        return this.matchesParamsAndQuery(
          combinedParams,
          combinedQuery,
          targetHash,
        );
      }
    }

    if (
      typeof target === "string" &&
      Boolean(target.trim()) &&
      !target.startsWith("/") &&
      !target.startsWith(".") &&
      !target.includes("/") &&
      this.namedRoutes.has(normalizeRouteName(target))
    ) {
      const name = normalizeRouteName(target);
      const isMatch = options.exact
        ? allBranches.some((b) => b[b.length - 1]?.name === name)
        : allBranches.some((b) => b.some((r) => r.name === name));
      if (!isMatch) {
        return false;
      }
      return this.matchesParamsAndQuery(
        options.params,
        options.query,
        options.hash,
      );
    }

    const targetUrl = this.toRouteUrl(target as RouteTarget);
    const currentUrl = this.current.url;
    const currentLocalPath = normalizePathname(this.current.localPathname);
    const targetLocalPath =
      stripBasePath(normalizePathname(targetUrl.pathname), this.basePath) ??
      normalizePathname(targetUrl.pathname);

    if (options.exact) {
      if (currentLocalPath !== targetLocalPath) {
        return false;
      }
    } else {
      if (targetLocalPath === ROOT_PATH) {
        if (currentLocalPath !== ROOT_PATH) {
          return false;
        }
      } else {
        const prefix = targetLocalPath.endsWith("/")
          ? targetLocalPath
          : `${targetLocalPath}/`;
        if (
          currentLocalPath !== targetLocalPath &&
          !currentLocalPath.startsWith(prefix)
        ) {
          return false;
        }
      }
    }

    if (targetUrl.search) {
      for (const [key, value] of targetUrl.searchParams) {
        if (!currentUrl.searchParams.getAll(key).includes(value)) {
          return false;
        }
      }
    }

    if (targetUrl.hash && targetUrl.hash !== currentUrl.hash) {
      return false;
    }

    return this.matchesParamsAndQuery(
      options.params,
      options.query,
      options.hash,
    );
  }

  private matchesParamsAndQuery(
    params?: RouteParamsInput,
    query?: RouteQueryInit,
    hash?: string,
  ): boolean {
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
          continue;
        }
        const valStr = String(value);
        const decodedVal = decodeSegment(valStr);
        const matchesVal = (currentVal: string | undefined) =>
          currentVal === valStr ||
          (currentVal !== undefined &&
            decodeSegment(currentVal) === decodedVal);

        let paramMatched = matchesVal(this.current.params[key]);
        if (!paramMatched && this.current.slotParams) {
          for (const sp of Object.values(this.current.slotParams)) {
            if (matchesVal(sp[key])) {
              paramMatched = true;
              break;
            }
          }
        }
        if (!paramMatched) {
          return false;
        }
      }
    }

    if (query) {
      const expectedQuery = toSearchParams(query);
      for (const [key, val] of expectedQuery) {
        if (!this.current.query.getAll(key).includes(val)) {
          return false;
        }
      }
    }

    if (hash !== undefined && normalizeHash(hash) !== this.current.hash) {
      return false;
    }

    return true;
  }

  getRouteData<T = unknown>(selector?: RouteSelector | string): T | undefined {
    if (!selector) {
      if (this.current.data !== undefined) {
        return this.current.data as T;
      }
      if (this.current.routeData) {
        for (let i = this.current.branch.length - 1; i >= 0; i--) {
          const r = this.current.branch[i];
          if (r && this.current.routeData.has(r)) {
            return this.current.routeData.get(r) as T;
          }
        }
      }
      return undefined;
    }

    const { type, value } = resolveRouteSelector(selector);
    let route: RouteDefinition | undefined;
    for (const branch of detailBranches(this.current)) {
      route = branch.find((r) =>
        type === "id" ? r.id === value : r.name === value,
      );
      if (route) {
        break;
      }
    }
    if (route && this.current.routeData) {
      return this.current.routeData.get(route) as T | undefined;
    }
    return undefined;
  }

  cloneRoutes(): RouteDefinition[] {
    return cloneRouteDefinitions(this.routeTree);
  }

  get lastError(): RouteErrorDetail | undefined {
    return this.lastRouteErrorDetail;
  }

  get lastNotFound(): RouteNotFoundDetail | undefined {
    return this.lastRouteNotFoundDetail;
  }

  private replaceRouteTree(
    routes: RouteDefinition[],
    options: {
      skipIfSame: boolean;
      reason: RouteTreeChangeDetail["reason"];
    },
  ): void {
    this.routeTree = cloneRouteDefinitions(routes);
    this.rebuildRouteState();
    this.notifyRouteTreeChanged(options.reason);
    this.requestRouteRefresh(options.skipIfSame);
  }

  private requireNavigationApi(): NavigationApi {
    const navigation = (
      browserWindow() as Window & {
        navigation?: NavigationApi;
      }
    ).navigation;

    if (!navigation || typeof navigation.navigate !== "function") {
      throw new Error(
        "Router is Navigation API-first and requires window.navigation.navigate; it does not provide a History API fallback.",
      );
    }

    return navigation;
  }

  private get navigationApi(): NavigationApi {
    return this.browserNavigation ?? this.requireNavigationApi();
  }

  private isNavigableAnchor(item: unknown): item is Element {
    return (
      item instanceof Element &&
      item.tagName.toUpperCase() === "A" &&
      !item.hasAttribute("data-router-ignore")
    );
  }

  private getAnchorHref(anchor: Element): string | null {
    return anchor.getAttribute("href") ?? anchor.getAttribute("xlink:href");
  }

  private ensureNavigationEntryOrder(key: string): number {
    const existingOrder = this.navigationEntryOrders.get(key);
    if (existingOrder !== undefined) {
      return existingOrder;
    }

    const nextOrder = this.nextNavigationEntryOrder;
    this.navigationEntryOrders.set(key, nextOrder);
    this.nextNavigationEntryOrder += 1;
    this.pruneNavigationEntryOrders();
    return nextOrder;
  }

  private pruneNavigationEntryOrders(): void {
    if (this.navigationEntryOrders.size <= MAX_NAVIGATION_ENTRY_ORDERS) {
      return;
    }

    const currentKey = this.current.navigationKey;
    const keepThreshold =
      this.nextNavigationEntryOrder - NAVIGATION_ENTRY_ORDER_PRUNE_TO;

    for (const [key, order] of this.navigationEntryOrders) {
      if (this.navigationEntryOrders.size <= NAVIGATION_ENTRY_ORDER_PRUNE_TO) {
        break;
      }

      if (key === currentKey || order >= keepThreshold) {
        continue;
      }

      this.navigationEntryOrders.delete(key);
    }
  }

  private getCurrentNavigationEntryKey(): string {
    const navigationEntryKey = this.navigationApi.currentEntry?.key;
    if (navigationEntryKey) {
      return navigationEntryKey;
    }

    throw new Error(
      "Router is Navigation API-first and requires window.navigation.currentEntry.key for per-entry state.",
    );
  }

  private tryGetCurrentNavigationEntryKey(): string | undefined {
    try {
      return this.navigationApi.currentEntry?.key;
    } catch {
      return undefined;
    }
  }

  private resolveNavigationDirection(
    history: NavigationHistoryMode | "none",
    nextNavigationKey: string,
  ): NavigationDirection {
    if (history === "push") {
      return "forward";
    }

    if (history === "replace" || !this.current.navigationKey) {
      return "none";
    }

    if (this.current.navigationKey === nextNavigationKey) {
      return "none";
    }

    const currentOrder = this.navigationEntryOrders.get(
      this.current.navigationKey,
    );
    const nextOrder = this.navigationEntryOrders.get(nextNavigationKey);
    if (
      currentOrder === undefined ||
      nextOrder === undefined ||
      currentOrder === nextOrder
    ) {
      return "none";
    }

    return nextOrder > currentOrder ? "forward" : "backward";
  }

  private resolveAttemptDirection(
    history: NavigationHistoryMode | "none",
    navigationKey?: string,
  ): NavigationDirection {
    if (history === "push") {
      return "forward";
    }

    if (history === "replace") {
      return "none";
    }

    const nextNavigationKey =
      navigationKey || this.getCurrentNavigationEntryKey();
    this.ensureNavigationEntryOrder(nextNavigationKey);
    return this.resolveNavigationDirection("none", nextNavigationKey);
  }

  private navigate(
    target: string | URL | RouteLocation,
    mode: NavigationHistoryMode,
  ): void {
    const url = this.toRouteUrl(target);
    const browser = browserWindow();
    if (url.origin !== browser.location.origin) {
      if (mode === "replace") {
        browser.location.replace(url.href);
      } else {
        browser.location.assign(url.href);
      }
      return;
    }

    const href = `${url.pathname}${url.search}${url.hash}`;
    this.navigationApi.navigate(href, { history: mode });
  }

  private toRouteUrl(target: string | URL | RouteLocation): URL {
    if (target instanceof URL) {
      return new URL(target.href);
    }

    if (typeof target === "string") {
      if (!target.trim()) {
        return new URL(this.current.url.href);
      }

      if (
        Boolean(target.trim()) &&
        !target.startsWith("/") &&
        !target.startsWith(".") &&
        !target.includes("/") &&
        !target.includes("?") &&
        !target.includes("#") &&
        this.namedRoutes.has(normalizeRouteName(target))
      ) {
        const branch = this.resolveNamedRouteBranch(normalizeRouteName(target));
        const localPathname = buildLocalPathname(branch);
        const pathname = this.withBasePath(localPathname);
        return new URL(pathname, browserWindow().location.origin);
      }
      if (
        target.startsWith("/") &&
        !target.startsWith("//") &&
        this.basePath !== ROOT_PATH &&
        !target.startsWith(this.basePath + "/") &&
        target !== this.basePath
      ) {
        const targetUrl = new URL(target, browserWindow().location.origin);
        const pathname = this.withBasePath(targetUrl.pathname);
        return new URL(
          `${pathname}${targetUrl.search}${targetUrl.hash}`,
          browserWindow().location.origin,
        );
      }
      return new URL(target, this.current.url.href);
    }

    let branch: NamedRouteBranch;
    if (target.id) {
      branch = this.resolveRouteIdBranch(target.id);
    } else if (target.name) {
      branch = this.resolveNamedRouteBranch(target.name);
    } else if (this.current.branch.length > 0) {
      branch = this.current.branch;
    } else {
      throw new Error(
        "RouteLocation requires a route name or id when there is no active route.",
      );
    }

    const mergedParams = {
      ...(!target.id && !target.name ? this.current.params : {}),
      ...(target.params ?? {}),
    };
    const localPathname = buildLocalPathname(branch, mergedParams);
    const pathname = this.withBasePath(localPathname);
    const search =
      target.query !== undefined
        ? createSearchString(target.query)
        : !target.id && !target.name
          ? this.current.url.search
          : "";
    const hash =
      target.hash !== undefined
        ? normalizeHash(target.hash)
        : !target.id && !target.name
          ? this.current.url.hash
          : "";
    const href = `${pathname}${search}${hash}`;

    return new URL(href, browserWindow().location.origin);
  }

  private resolveMatched(url: URL): RouterChangeDetail | null {
    const detail = this.resolveUrlDetail(url);
    return detail && detail.branch.length > 0 ? detail : null;
  }

  private resolveNamedRouteBranch(name: string): NamedRouteBranch {
    const normalizedName = normalizeRouteName(name);
    const branch = this.namedRoutes.get(normalizedName);
    if (!branch) {
      throw new Error(`Unknown route name "${normalizedName}".`);
    }

    return branch;
  }

  private resolveRouteIdBranch(id: string): NamedRouteBranch {
    const normalizedId = normalizeRouteId(id);
    const branch = this.routeIds.get(normalizedId);
    if (!branch) {
      throw new Error(`Unknown route id "${normalizedId}".`);
    }

    return branch;
  }

  private resolveRouteBranch(selector: RouteSelector): NamedRouteBranch {
    if (selector.id && selector.name) {
      throw new Error("Route selector must not include both id and name.");
    }

    if (selector.id) {
      return this.resolveRouteIdBranch(selector.id);
    }

    if (selector.name) {
      return this.resolveNamedRouteBranch(selector.name);
    }

    throw new Error(
      "Route selector must include either a route id or route name.",
    );
  }

  private withBasePath(localPathname: string): string {
    if (this.basePath === ROOT_PATH) {
      return localPathname;
    }

    return localPathname === ROOT_PATH
      ? this.basePath
      : `${this.basePath}${localPathname}`;
  }

  private resolveUrlDetail(url: URL): RouterChangeDetail | null {
    const pathname = normalizePathname(url.pathname);
    const localPathname = stripBasePath(pathname, this.basePath);

    if (localPathname === null) {
      return null;
    }

    const matchedSlots = matchSlotRoutes(
      this.compiledRoutes,
      splitSegments(localPathname),
    );
    const mainMatch = matchedSlots[DEFAULT_CHILD_SLOT];
    const branch = mainMatch ? branchRoutes(mainMatch) : [];
    const leaf = branch.at(-1);
    const params = mainMatch?.params ?? {};
    const slotBranches: Record<string, RouteDefinition[]> = {};
    const slotParams: Record<string, Record<string, string>> = {};
    const slots: Record<string, RouterSlotDetail> = {};

    if (mainMatch) {
      slots[DEFAULT_CHILD_SLOT] = {
        branch,
        leaf,
        params,
      };

      for (const [slotName, slotMatch] of Object.entries(matchedSlots)) {
        if (slotName === DEFAULT_CHILD_SLOT) {
          continue;
        }

        const slotBranch = branchRoutes(slotMatch);
        if (
          slotBranch.length < 2 ||
          branch.length === 0 ||
          slotBranch[0] !== branch[0]
        ) {
          continue;
        }

        slotBranches[slotName] = slotBranch;
        slotParams[slotName] = slotMatch.params;
        slots[slotName] = createSlotDetail(slotMatch);
      }
    }

    const meta: RouteMeta = Object.assign(
      {},
      ...branch.map((route) => route.meta).filter(Boolean),
    );

    return {
      pathname,
      localPathname,
      basePath: normalizeBasePath(this.basePath),
      search: url.search,
      query: new URLSearchParams(url.search),
      hash: url.hash,
      params,
      branch,
      leaf,
      slotBranches: Object.keys(slotBranches).length ? slotBranches : undefined,
      slotParams: Object.keys(slotParams).length ? slotParams : undefined,
      slots: Object.keys(slots).length ? slots : undefined,
      url,
      navigationKey: this.tryGetCurrentNavigationEntryKey() ?? "",
      direction: "none",
      meta: Object.keys(meta).length ? meta : undefined,
      toJSON: detailToJSON,
    };
  }

  private managesUrl(url: URL): boolean {
    return stripBasePath(url.pathname, this.basePath) !== null;
  }

  private rebuildRouteState(): void {
    this.compiledRoutes = buildCompiledRoutes(
      this.routeTree,
      this.routePatternCache,
    );
    this.routeIds = buildRouteIdIndex(this.routeTree);
    this.namedRoutes = buildNamedRouteIndex(this.routeTree);
    this.readonlyRoutes = freezeRouteDefinitions(this.routeTree);
    this.routeCount = countRouteDefinitions(this.routeTree);
  }

  private notifyRouteTreeChanged(
    reason: RouteTreeChangeDetail["reason"],
  ): void {
    if (!this.started) {
      return;
    }

    if (this.routeMutationDepth > 0) {
      this.pendingRouteTreeChange = true;
      return;
    }

    this.dispatchRouteTreeChange(reason);
  }

  private dispatchRouteTreeChange(
    reason: RouteTreeChangeDetail["reason"],
  ): void {
    const detail: RouteTreeChangeDetail = {
      reason,
      routeCount: this.routeCount,
      routes: this.readonlyRoutes,
    };

    this.dispatchEvent(
      new CustomEvent<RouteTreeChangeDetail>("route-tree-change", {
        detail,
      }),
    );
  }

  private requestRouteRefresh(skipIfSame: boolean): void {
    if (!this.started) {
      return;
    }

    if (this.routeMutationDepth > 0) {
      this.pendingRouteRefreshSkipIfSame =
        this.pendingRouteRefreshSkipIfSame === undefined
          ? skipIfSame
          : this.pendingRouteRefreshSkipIfSame && skipIfSame;
      return;
    }

    const activeNavigation = this.activeNavigation;
    if (activeNavigation && activeNavigation.id === this.navigationId) {
      const nextDetail = this.resolveUrlDetail(activeNavigation.url);

      if (skipIfSame) {
        if (
          activeNavigation.detail &&
          nextDetail &&
          isSameDetail(activeNavigation.detail, nextDetail)
        ) {
          return;
        }

        if (!activeNavigation.detail && !nextDetail) {
          return;
        }
      }

      void this.routeTo(new URL(activeNavigation.url.href), {
        history: activeNavigation.history,
        navigationKey: activeNavigation.navigationKey,
      });
      return;
    }

    const currentUrl = new URL(browserWindow().location.href);
    if (skipIfSame) {
      const nextDetail = this.resolveUrlDetail(currentUrl);
      if (
        nextDetail &&
        this.current.branch.length > 0 &&
        isSameDetail(this.current, nextDetail)
      ) {
        return;
      }

      if (
        !nextDetail &&
        this.lastRouteNotFoundDetail?.url.href === currentUrl.href
      ) {
        return;
      }
    }

    void this.routeTo(currentUrl, {
      history: "none",
      skipIfSame,
    });
  }

  private updateActiveNavigationDetail(
    navigationId: number,
    detail: RouterChangeDetail | null,
  ): void {
    if (this.activeNavigation?.id !== navigationId) {
      return;
    }

    this.activeNavigation.detail = detail;
  }

  private async routeTo(
    url: URL,
    options: RouteTransitionOptions & { navigationKey?: string },
  ): Promise<void> {
    if (options.history !== "none") {
      this.navigationApi.navigate(`${url.pathname}${url.search}${url.hash}`, {
        history: options.history,
      });
      return;
    }

    if (this.activeNavigation?.url.href !== url.href) {
      this.activeNavigation?.abortController.abort();
    }
    const currentNavigationId = ++this.navigationId;
    const abortController = new AbortController();
    const direction = this.resolveAttemptDirection(
      options.history,
      options.navigationKey,
    );
    this.activeNavigation = {
      id: currentNavigationId,
      url: new URL(url.href),
      history: options.history,
      navigationKey: options.navigationKey,
      detail: null,
      abortController,
    };
    const signal = abortController.signal;
    const redirectDepth = options.redirectDepth ?? 0;

    try {
      const detail = this.resolveUrlDetail(url);
      this.updateActiveNavigationDetail(currentNavigationId, detail);

      const decision = await this.evaluateGuards(
        url,
        detail,
        direction,
        signal,
      );
      if (!decision) {
        return;
      }

      if (signal.aborted || this.isNavigationStale(currentNavigationId)) {
        return;
      }

      if (this.followRedirect(url, decision, redirectDepth, direction)) {
        return;
      }

      if (!decision.allowed) {
        this.restoreCancelledNavigation(
          url,
          detail?.navigationKey || options.navigationKey,
          direction,
        );
        return;
      }

      if (!detail || detail.branch.length === 0) {
        this.dispatchRouteNotFound(url, direction);
        return;
      }

      if (this.shouldSkipNavigation(detail, options)) {
        return;
      }

      if (
        !(await this.loadBranchForNavigation(
          url,
          detail,
          currentNavigationId,
          direction,
          signal,
        ))
      ) {
        return;
      }

      this.commitNavigation(detail, options.history, options.navigationKey);
    } finally {
      if (this.activeNavigation?.id === currentNavigationId) {
        this.activeNavigation = undefined;
      }
    }
  }

  private async evaluateGuards(
    url: URL,
    detail: RouterChangeDetail | null,
    direction: NavigationDirection,
    signal: AbortSignal,
  ): Promise<Awaited<ReturnType<Router["runGuards"]>> | null> {
    try {
      const result = await this.runGuards(detail, signal);
      return signal.aborted ? null : result;
    } catch (error) {
      if (signal.aborted) {
        return null;
      }
      this.dispatchRouteError(url, error, "guard", direction);
      return null;
    }
  }

  private followRedirect(
    url: URL,
    decision: Awaited<ReturnType<Router["runGuards"]>>,
    redirectDepth: number,
    direction: NavigationDirection,
  ): boolean {
    if (!decision.redirect) {
      return false;
    }

    const nextRedirectDepth = redirectDepth + 1;
    if (nextRedirectDepth > this.maxRedirectDepth) {
      this.dispatchRouteError(
        url,
        new Error("Redirect loop detected"),
        "guard",
        direction,
      );
      return true;
    }

    this.redirectWithNavigationApi(decision.redirect, nextRedirectDepth);
    return true;
  }

  private toRedirectInstruction(
    result: Exclude<RouteGuardResult, boolean | void>,
    baseUrl: URL,
  ): RedirectInstruction {
    if (result instanceof URL) {
      return { to: result, replace: false };
    }

    if (typeof result === "string") {
      if (!result.trim()) {
        return { to: new URL(baseUrl.href), replace: false };
      }

      let targetUrl: URL;
      if (
        Boolean(result.trim()) &&
        !result.startsWith("/") &&
        !result.startsWith(".") &&
        !result.includes("/") &&
        !result.includes("?") &&
        !result.includes("#") &&
        this.namedRoutes.has(normalizeRouteName(result))
      ) {
        targetUrl = this.toRouteUrl(result);
      } else if (
        result.startsWith("/") &&
        !result.startsWith("//") &&
        this.basePath !== ROOT_PATH &&
        !result.startsWith(this.basePath + "/") &&
        result !== this.basePath
      ) {
        const u = new URL(result, browserWindow().location.origin);
        const pathname = this.withBasePath(u.pathname);
        targetUrl = new URL(
          `${pathname}${u.search}${u.hash}`,
          browserWindow().location.origin,
        );
      } else {
        targetUrl = new URL(result, baseUrl.href);
      }
      return { to: targetUrl, replace: false };
    }

    if (
      typeof result === "object" &&
      result !== null &&
      "to" in result &&
      result.to
    ) {
      const inner = this.toRedirectInstruction(
        result.to as Exclude<RouteGuardResult, boolean | void>,
        baseUrl,
      );
      return {
        to: inner.to,
        replace: Boolean(result.replace),
      };
    }

    return {
      to: this.toRouteUrl(result as RouteLocation),
      replace: false,
    };
  }

  private redirectWithNavigationApi(
    redirect: RedirectInstruction,
    redirectDepth: number,
  ): void {
    const browser = browserWindow();
    if (redirect.to.origin !== browser.location.origin) {
      if (redirect.replace) {
        browser.location.replace(redirect.to.href);
      } else {
        browser.location.assign(redirect.to.href);
      }
      return;
    }

    this.pendingRedirectDepths.set(redirect.to.href, redirectDepth);
    this.navigationApi.navigate(
      `${redirect.to.pathname}${redirect.to.search}${redirect.to.hash}`,
      {
        history: redirect.replace ? "replace" : "push",
      },
    );
  }

  private consumePendingRedirectDepth(url: URL): number {
    const redirectDepth = this.pendingRedirectDepths.get(url.href) ?? 0;
    this.pendingRedirectDepths.delete(url.href);
    return redirectDepth;
  }

  private shouldSkipNavigation(
    detail: RouterChangeDetail,
    options: RouteTransitionOptions,
  ): boolean {
    if (
      options.history === "none" &&
      this.current.navigationKey &&
      detail.navigationKey !== this.current.navigationKey
    ) {
      return false;
    }

    return options.skipIfSame !== false && isSameDetail(this.current, detail);
  }

  private async loadBranchForNavigation(
    url: URL,
    detail: RouterChangeDetail,
    navigationId: number,
    direction: NavigationDirection,
    signal: AbortSignal,
  ): Promise<boolean> {
    const loadingSlots = this.loadingSlotsForDetail(detail);
    const shouldDispatchLoading = loadingSlots.length > 0;
    if (shouldDispatchLoading) {
      this.dispatchRouteLoading(
        "route-loading-start",
        detail.url,
        detail.branch,
        loadingSlots,
        direction,
      );
    }

    try {
      for (const branch of detailBranches(detail)) {
        await this.loadBranch(branch, signal, detail);
      }

      const routeData = new Map<RouteDefinition, unknown>();
      const routesWithLoaders: RouteDefinition[] = [];
      const seenRoutes = new Set<RouteDefinition>();

      for (const branch of detailBranches(detail)) {
        for (const route of branch) {
          if (route.loader && !seenRoutes.has(route)) {
            seenRoutes.add(route);
            routesWithLoaders.push(route);
          }
        }
      }

      if (routesWithLoaders.length > 0) {
        const results = await Promise.all(
          routesWithLoaders.map((route) => {
            const slot = route.slot || DEFAULT_CHILD_SLOT;
            const params =
              slot !== DEFAULT_CHILD_SLOT && detail.slotParams?.[slot]
                ? detail.slotParams[slot]
                : detail.params;
            const loadContext: RouteLoadContext = {
              signal,
              router: this,
              pathname: detail.pathname,
              localPathname: detail.localPathname,
              params,
              query: detail.query,
              hash: detail.hash,
              url: detail.url,
            };
            return route.loader!(loadContext);
          }),
        );

        if (signal.aborted) {
          return false;
        }

        for (let i = 0; i < routesWithLoaders.length; i++) {
          routeData.set(routesWithLoaders[i]!, results[i]);
        }
      }

      detail.routeData = routeData;
      if (detail.leaf && routeData.has(detail.leaf)) {
        detail.data = routeData.get(detail.leaf);
      } else {
        for (let i = detail.branch.length - 1; i >= 0; i--) {
          const r = detail.branch[i];
          if (r && routeData.has(r)) {
            detail.data = routeData.get(r);
            break;
          }
        }
      }
    } catch (error) {
      if (signal.aborted) {
        return false;
      }
      this.dispatchRouteError(url, error, "load", direction);
      return false;
    } finally {
      if (shouldDispatchLoading) {
        this.dispatchRouteLoading(
          "route-loading-end",
          detail.url,
          detail.branch,
          loadingSlots,
          direction,
        );
      }
    }

    return !signal.aborted && !this.isNavigationStale(navigationId);
  }

  private commitNavigation(
    detail: RouterChangeDetail,
    history: NavigationHistoryMode | "none",
    navigationKey?: string,
  ): void {
    const nextNavigationKey = this.resolveCommittedNavigationKey(
      history,
      navigationKey,
    );
    const committedDetail: RouterChangeDetail = {
      ...detail,
      navigationKey: nextNavigationKey,
      direction: this.resolveNavigationDirection(history, nextNavigationKey),
    };
    this.current = committedDetail;
    this.lastRouteErrorDetail = undefined;
    this.lastRouteNotFoundDetail = undefined;
    this.dispatchEvent(
      new CustomEvent<RouterChangeDetail>("route-change", {
        detail: committedDetail,
      }),
    );
  }

  private resolveCommittedNavigationKey(
    history: NavigationHistoryMode | "none",
    navigationKey?: string,
  ): string {
    if (history !== "none") {
      throw new Error(
        "Router commits must be driven by the Navigation API navigate event.",
      );
    }

    const nextKey = navigationKey || this.getCurrentNavigationEntryKey();
    this.ensureNavigationEntryOrder(nextKey);
    return nextKey;
  }

  private async runGuards(
    detail: RouterChangeDetail | null,
    signal: AbortSignal,
  ): Promise<{
    allowed: boolean;
    redirect?: RedirectInstruction;
  }> {
    const from = this.current.branch.length ? this.current : null;

    if (from) {
      const leavingRoutes = collectLeavingRoutes(from, detail);

      if (leavingRoutes.length > 0) {
        for (const guard of this.dynamicLeaveGuards) {
          if (signal.aborted) {
            return { allowed: false };
          }

          const result = await guard({
            ...from,
            to: detail,
            router: this,
            signal,
          });
          if (signal.aborted) {
            return { allowed: false };
          }
          if (result === false) {
            return { allowed: false };
          }
          if (result && result !== true) {
            return {
              allowed: false,
              redirect: this.toRedirectInstruction(result, from.url),
            };
          }
        }

        for (const route of leavingRoutes) {
          if (signal.aborted) {
            return { allowed: false };
          }

          if (!route.beforeLeave) {
            continue;
          }

          const result = await route.beforeLeave({
            ...from,
            to: detail,
            router: this,
            signal,
          });
          if (signal.aborted) {
            return { allowed: false };
          }
          if (result === false) {
            return { allowed: false };
          }
          if (result && result !== true) {
            return {
              allowed: false,
              redirect: this.toRedirectInstruction(result, from.url),
            };
          }
        }
      }
    }

    if (!detail) {
      return { allowed: true };
    }

    if (this.beforeRoute) {
      if (signal.aborted) {
        return { allowed: false };
      }

      const result = await this.beforeRoute({
        ...detail,
        from,
        router: this,
        signal,
      });
      if (signal.aborted) {
        return { allowed: false };
      }
      if (result === false) {
        return { allowed: false };
      }
      if (result && result !== true) {
        return {
          allowed: false,
          redirect: this.toRedirectInstruction(result, detail.url),
        };
      }
    }

    for (const route of collectMatchedRoutes(detail)) {
      if (signal.aborted) {
        return { allowed: false };
      }

      if (!route.guard) {
        continue;
      }

      const result = await route.guard({
        ...detail,
        from,
        router: this,
        signal,
      });
      if (signal.aborted) {
        return { allowed: false };
      }
      if (result === false) {
        return { allowed: false };
      }
      if (result && result !== true) {
        return {
          allowed: false,
          redirect: this.toRedirectInstruction(result, detail.url),
        };
      }
    }

    return { allowed: true };
  }

  private branchNeedsLoading(branch: RouteDefinition[]): boolean {
    return branch.some((route) =>
      Boolean(
        route.loader ||
        (route.load &&
          (!this.loadedRoutes.has(route) || this.pendingRouteLoads.has(route))),
      ),
    );
  }

  private loadingSlotsForDetail(detail: RouterChangeDetail): string[] {
    const loadingSlots: string[] = [];
    if (this.branchNeedsLoading(detail.branch)) {
      loadingSlots.push(DEFAULT_CHILD_SLOT);
    }

    for (const [slotName, branch] of Object.entries(
      detail.slotBranches ?? {},
    ).sort(([left], [right]) => left.localeCompare(right))) {
      if (this.branchNeedsLoading(branch)) {
        loadingSlots.push(slotName);
      }
    }

    return loadingSlots;
  }

  private async loadBranch(
    branch: RouteDefinition[],
    signal: AbortSignal,
    detail?: RouterChangeDetail,
  ): Promise<void> {
    for (const route of branch) {
      if (signal.aborted) {
        return;
      }

      if (!route.load || this.loadedRoutes.has(route)) {
        continue;
      }

      const pendingLoad = this.pendingRouteLoads.get(route);
      if (pendingLoad && !pendingLoad.signal.aborted) {
        await pendingLoad.promise;
        continue;
      }

      const slot = route.slot || DEFAULT_CHILD_SLOT;
      const params =
        slot !== DEFAULT_CHILD_SLOT && detail?.slotParams?.[slot]
          ? detail.slotParams[slot]
          : (detail?.params ?? {});
      const loadContext: RouteLoadContext = {
        signal,
        router: this,
        pathname: detail?.pathname ?? "",
        localPathname: detail?.localPathname ?? "",
        params,
        query: detail?.query ?? new URLSearchParams(),
        hash: detail?.hash ?? "",
        url: detail?.url ?? new URL("about:blank"),
      };

      const loadPromise = Promise.resolve()
        .then(() => route.load?.(loadContext))
        .then(() => {
          this.loadedRoutes.add(route);
        })
        .finally(() => {
          if (this.pendingRouteLoads.get(route)?.promise === loadPromise) {
            this.pendingRouteLoads.delete(route);
          }
        });

      this.pendingRouteLoads.set(route, { promise: loadPromise, signal });
      await loadPromise;
    }
  }

  private isNavigationStale(navigationId: number): boolean {
    return navigationId !== this.navigationId;
  }

  private restoreCancelledNavigation(
    attemptedUrl: URL,
    attemptedNavigationKey: string | undefined,
    direction: NavigationDirection,
  ): void {
    if (
      direction === "none" ||
      !this.current.branch.length ||
      attemptedUrl.href !== new URL(browserWindow().location.href).href ||
      attemptedUrl.href === this.current.url.href
    ) {
      return;
    }

    const currentOrder = this.navigationEntryOrders.get(
      this.current.navigationKey,
    );
    const attemptedOrder = attemptedNavigationKey
      ? this.navigationEntryOrders.get(attemptedNavigationKey)
      : undefined;
    if (
      currentOrder !== undefined &&
      attemptedOrder !== undefined &&
      currentOrder !== attemptedOrder
    ) {
      if (this.restoreCancelledNavigationWithNavigationApi()) {
        return;
      }
      return;
    }

    if (this.restoreCancelledNavigationWithNavigationApi()) {
      return;
    }
  }

  private restoreCancelledNavigationWithNavigationApi(): boolean {
    const navigationApi = this.navigationApi as NavigationApi & {
      traverseTo?: (key: string) => NavigationResult;
      entries?: () => Array<{ key: string }>;
    };
    if (
      this.current.navigationKey &&
      typeof navigationApi.traverseTo === "function" &&
      typeof navigationApi.entries === "function"
    ) {
      const hasEntry = navigationApi
        .entries()
        .some((entry) => entry.key === this.current.navigationKey);
      if (hasEntry) {
        try {
          navigationApi.traverseTo(this.current.navigationKey);
          return true;
        } catch {
          // ignore and fall back to navigate replace
        }
      }
    }

    const href = `${this.current.url.pathname}${this.current.url.search}${this.current.url.hash}`;
    try {
      this.navigationApi.navigate(href, { history: "replace" });
      return true;
    } catch {
      return false;
    }
  }

  private dispatchRouteLoading(
    type: "route-loading-start" | "route-loading-end",
    url: URL,
    branch: RouteDefinition[],
    loadingSlots: string[],
    direction: NavigationDirection,
  ): void {
    this.activeRouteLoads =
      type === "route-loading-start"
        ? this.activeRouteLoads + 1
        : Math.max(0, this.activeRouteLoads - 1);
    this.dispatchEvent(
      new CustomEvent<RouteLoadingDetail>(type, {
        detail: {
          url,
          branch: [...branch],
          loadingSlots,
          pending: this.activeRouteLoads,
          direction,
        },
      }),
    );
  }

  private dispatchRouteNotFound(
    url: URL,
    direction: NavigationDirection,
  ): void {
    const detail: RouteNotFoundDetail = {
      url,
      basePath: normalizeBasePath(this.basePath),
      direction,
    };
    this.lastRouteErrorDetail = undefined;
    this.lastRouteNotFoundDetail = detail;
    this.dispatchEvent(
      new CustomEvent<RouteNotFoundDetail>("route-not-found", {
        detail,
      }),
    );
    console.warn(`[router] No route matched for ${url.pathname}`);
  }

  private dispatchRouteError(
    url: URL,
    error: unknown,
    phase: RouteErrorDetail["phase"],
    direction: NavigationDirection,
  ): void {
    const detail: RouteErrorDetail = {
      url,
      error,
      phase,
      direction,
    };
    this.lastRouteNotFoundDetail = undefined;
    this.lastRouteErrorDetail = detail;
    this.dispatchEvent(
      new CustomEvent<RouteErrorDetail>("route-error", {
        detail,
      }),
    );
    console.error("[router] Route transition failed", error);
  }
}
