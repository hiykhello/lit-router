import {
  css,
  type CSSResultGroup,
  html,
  LitElement,
  type TemplateResult,
} from "lit";
import { browserDocument, browserWindow } from "./browser-env.ts";
import { ScrollManager } from "./scroll-manager.ts";
import {
  collectLeavingRoutes,
  type NavigationDirection,
  type RouteContext,
  type RouteContextReceiver,
  type RouteDefinition,
  type RouteErrorDetail,
  type RouteGuardResult,
  type RouteLeaveGuard,
  type RouteLocation,
  type RouteNotFoundDetail,
  type Router,
  type RouterChangeDetail,
} from "./router-core.ts";
import {
  type ContextCallback,
  type ContextRequest,
  routerContext,
  routeContext,
  type UnknownContext,
} from "./context.ts";

export const DEFAULT_CHILD_SLOT = "route-child";
type ViewMode = "route" | "not-found" | "error";

export class RouterView extends LitElement {
  static override properties = {
    router: { attribute: false },
    childSlot: { attribute: "child-slot" },
    noViewTransition: { attribute: "no-view-transition", type: Boolean },
  };

  declare router: Router | undefined;
  declare childSlot: string;
  declare noViewTransition: boolean;

  constructor() {
    super();
    this.router = undefined;
    this.childSlot = DEFAULT_CHILD_SLOT;
    this.noViewTransition = false;
  }

  private viewMode: ViewMode = "route";

  private routeErrorDetail?: RouteErrorDetail;

  private routeNotFoundDetail?: RouteNotFoundDetail;

  private activeDetail: RouterChangeDetail = {
    pathname: "/",
    localPathname: "/",
    basePath: "/",
    search: "",
    query: new URLSearchParams(),
    hash: "",
    params: {},
    branch: [],
    url: new URL(browserWindow().location.href),
    navigationKey: "",
    direction: "none",
  };

  private renderedBranches = new Map<string, HTMLElement[]>();
  private readonly scrollManager = new ScrollManager({ maxPositions: 50 });
  private readonly validatedChildOutlets = new WeakMap<
    HTMLElement,
    Set<string>
  >();
  private pendingChildOutletChecks = new Map<
    HTMLElement,
    Map<string, RouteDefinition>
  >();
  private subscribedRouter?: Router;
  private commitId = 0;
  private pendingCommitDetail?: RouterChangeDetail;
  private unregisterLeaveGuard?: () => void;
  private readonly routerSubscribers = new Set<ContextCallback<Router>>();
  private readonly routeSubscribers = new Set<ContextCallback<RouteContext>>();

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(
      "context-request",
      this.onContextRequest as EventListener,
    );
    this.scrollManager.acquireBrowserScrollRestoration();
    this.setTransitionDirection(this.activeDetail.direction);
    this.setViewTransitionName(this.activeDetail.leaf?.viewTransitionName);
    this.connectRouter();
  }

  disconnectedCallback(): void {
    this.removeEventListener(
      "context-request",
      this.onContextRequest as EventListener,
    );
    this.invalidatePendingCommits({ clearRenderedElements: true });
    this.disconnectRouter();
    this.scrollManager.releaseBrowserScrollRestoration();
    this.routerSubscribers.clear();
    this.routeSubscribers.clear();
    super.disconnectedCallback();
  }

  protected firstUpdated(): void {
    this.syncFromRouter(false);
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("router")) {
      const previousRouter = changed.get("router") as Router | undefined;
      this.invalidatePendingCommits();
      this.disconnectRouter();
      if (previousRouter && previousRouter !== this.router) {
        previousRouter.stop();
      }
      this.connectRouter();
      this.syncFromRouter(false);
    }

    if (changed.has("childSlot") && this.activeDetail.branch.length > 0) {
      this.renderedBranches.clear();
      this.mountBranch({
        ...this.activeDetail,
        branch: [],
      });
    }
  }

  protected shouldUpdate(): boolean {
    return true;
  }

  get current(): RouterChangeDetail {
    return this.activeDetail;
  }

  private get viewport(): HTMLDivElement | null {
    return this.renderRoot.querySelector<HTMLDivElement>(".viewport");
  }

  private getRenderRootActiveElement(): Element | null {
    return "activeElement" in this.renderRoot
      ? (this.renderRoot.activeElement as Element | null)
      : null;
  }

  push(url: string | URL | RouteLocation): void {
    this.router?.push(url);
  }

  replace(url: string | URL | RouteLocation): void {
    this.router?.replace(url);
  }

  private connectRouter(): void {
    if (!this.router || this.subscribedRouter === this.router) {
      return;
    }

    this.router.start();
    this.unregisterLeaveGuard = this.router.registerLeaveGuard(
      this.checkComponentLeaveGuards,
    );
    this.router.addEventListener(
      "route-change",
      this.onRouteChange as EventListener,
    );
    this.router.addEventListener(
      "route-error",
      this.onRouteError as EventListener,
    );
    this.router.addEventListener(
      "route-not-found",
      this.onRouteNotFound as EventListener,
    );
    this.subscribedRouter = this.router;
    this.notifyRouterSubscribers();
  }

  private disconnectRouter(): void {
    this.unregisterLeaveGuard?.();
    this.unregisterLeaveGuard = undefined;
    if (!this.subscribedRouter) {
      return;
    }

    this.subscribedRouter.removeEventListener(
      "route-change",
      this.onRouteChange as EventListener,
    );
    this.subscribedRouter.removeEventListener(
      "route-error",
      this.onRouteError as EventListener,
    );
    this.subscribedRouter.removeEventListener(
      "route-not-found",
      this.onRouteNotFound as EventListener,
    );
    this.subscribedRouter = undefined;
  }

  private readonly checkComponentLeaveGuards: RouteLeaveGuard = async (
    detail,
  ) => {
    const from = detail;
    const to = detail.to;
    const elementByRoute = this.collectRenderedElementByRoute();
    const leavingRoutes = collectLeavingRoutes(from, to);

    for (const route of leavingRoutes) {
      if (detail.signal.aborted) {
        return false;
      }
      const element = elementByRoute.get(route);
      if (!element) {
        continue;
      }

      const leaveAware = element as HTMLElement & {
        beforeRouteLeave?: (
          detail: Parameters<RouteLeaveGuard>[0],
        ) => RouteGuardResult | Promise<RouteGuardResult>;
      };

      if (typeof leaveAware.beforeRouteLeave === "function") {
        try {
          const result = await leaveAware.beforeRouteLeave(detail);
          if (result === false || (result && result !== true)) {
            return result;
          }
        } catch (error) {
          console.error(
            "[router-view] Component beforeRouteLeave threw an error",
            error,
          );
          return false;
        }
      }
    }

    return true;
  };

  private getEffectiveDetail(): RouterChangeDetail {
    if (this.pendingCommitDetail) {
      return this.pendingCommitDetail;
    }
    if (this.activeDetail.branch.length > 0) {
      return this.activeDetail;
    }
    if (this.router && this.router.current.branch.length > 0) {
      return this.router.current;
    }
    return this.activeDetail;
  }

  private readonly onContextRequest = (event: Event): void => {
    const request = event as unknown as ContextRequest<UnknownContext>;
    const isRouterCtx =
      request.context === routerContext ||
      (typeof request.context === "object" &&
        request.context !== null &&
        "name" in request.context &&
        (request.context as { name?: unknown }).name === routerContext.name) ||
      (request.context as unknown) === routerContext.name;

    if (isRouterCtx) {
      event.stopPropagation();
      const unsubscribe = () => {
        this.routerSubscribers.delete(
          request.callback as ContextCallback<Router>,
        );
      };
      if (request.subscribe) {
        this.routerSubscribers.add(request.callback as ContextCallback<Router>);
      }
      if (this.router) {
        request.callback(this.router, unsubscribe);
      }
      return;
    }

    const isRouteCtx =
      request.context === routeContext ||
      (typeof request.context === "object" &&
        request.context !== null &&
        "name" in request.context &&
        (request.context as { name?: unknown }).name === routeContext.name) ||
      (request.context as unknown) === routeContext.name;

    if (isRouteCtx) {
      event.stopPropagation();
      const detail = this.getEffectiveDetail();
      let slotName = DEFAULT_CHILD_SLOT;
      const path = event.composedPath ? event.composedPath() : [];
      const target = (path[0] ?? event.target) as Node | undefined;
      if (target) {
        for (const [slot, elements] of this.renderedBranches) {
          if (elements.some((el) => el === target || el.contains(target))) {
            slotName = slot;
            break;
          }
        }
      }

      const slotBranch =
        slotName === DEFAULT_CHILD_SLOT
          ? detail.branch
          : (detail.slotBranches?.[slotName] ?? detail.branch);
      const slotParams =
        slotName === DEFAULT_CHILD_SLOT
          ? detail.params
          : (detail.slotParams?.[slotName] ?? detail.params);
      const slotLeaf = slotBranch[slotBranch.length - 1];
      const slotData =
        (slotLeaf && detail.routeData?.get(slotLeaf)) ?? detail.data;

      const currentRouteCtx: RouteContext = {
        detail,
        params: slotParams,
        slot: slotName,
        branch: slotBranch,
        data: slotData,
      };

      const unsubscribe = () => {
        this.routeSubscribers.delete(
          request.callback as ContextCallback<RouteContext>,
        );
      };
      if (request.subscribe) {
        this.routeSubscribers.add(
          request.callback as ContextCallback<RouteContext>,
        );
      }
      request.callback(currentRouteCtx, unsubscribe);
      return;
    }
  };

  private notifyRouterSubscribers(): void {
    if (!this.router) {
      return;
    }
    for (const callback of this.routerSubscribers) {
      const unsubscribe = () => {
        this.routerSubscribers.delete(callback);
      };
      callback(this.router, unsubscribe);
    }
  }

  private notifyRouteSubscribers(): void {
    const currentRouteCtx: RouteContext = {
      detail: this.activeDetail,
      params: this.activeDetail.params,
      slot: DEFAULT_CHILD_SLOT,
      branch: this.activeDetail.branch,
      data: this.activeDetail.data,
    };
    for (const callback of this.routeSubscribers) {
      const unsubscribe = () => {
        this.routeSubscribers.delete(callback);
      };
      callback(currentRouteCtx, unsubscribe);
    }
  }

  private syncFromRouter(allowTransition: boolean): void {
    if (!this.router) {
      return;
    }

    if (this.router.lastError) {
      this.showRouteError(this.router.lastError);
      return;
    }

    if (this.router.lastNotFound) {
      this.showRouteNotFound(this.router.lastNotFound);
      return;
    }

    if (this.router.current.branch.length === 0) {
      return;
    }

    this.commitAndEmit(this.router.current, {
      skipTransition: !allowTransition,
    });
  }

  private readonly onRouteChange = (event: CustomEvent<RouterChangeDetail>) => {
    this.commitAndEmit(event.detail, {
      captureCurrentScroll: true,
    });
  };

  private readonly onRouteError = (event: CustomEvent<RouteErrorDetail>) => {
    this.showRouteError(event.detail);
    this.dispatchEvent(
      new CustomEvent<RouteErrorDetail>("route-error", {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly onRouteNotFound = (
    event: CustomEvent<RouteNotFoundDetail>,
  ) => {
    this.showRouteNotFound(event.detail);
    this.dispatchEvent(
      new CustomEvent<RouteNotFoundDetail>("route-not-found", {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private dispatchCommitError(
    detail: RouterChangeDetail,
    error: unknown,
  ): void {
    this.showRouteError({
      url: detail.url,
      error,
      phase: "commit",
      direction: detail.direction,
    });
    this.dispatchEvent(
      new CustomEvent<RouteErrorDetail>("route-error", {
        detail: {
          url: detail.url,
          error,
          phase: "commit",
          direction: detail.direction,
        },
        bubbles: true,
        composed: true,
      }),
    );
    console.error("[router-view] Route commit failed", error);
  }

  private invalidatePendingCommits(
    options: { clearRenderedElements?: boolean } = {},
  ): void {
    this.commitId += 1;
    this.pendingChildOutletChecks.clear();

    if (options.clearRenderedElements) {
      this.renderedBranches.clear();
    }
  }

  private commitAndEmit(
    detail: RouterChangeDetail,
    options: {
      captureCurrentScroll?: boolean;
      skipTransition?: boolean;
    } = {},
  ): void {
    if (options.captureCurrentScroll) {
      this.captureScrollPosition(this.activeDetail);
    }

    void this.commit(detail, {
      skipTransition: options.skipTransition,
    })
      .then((committed) => {
        if (!committed) {
          return;
        }

        this.dispatchRouteChange(detail);
      })
      .catch((error) => {
        this.dispatchCommitError(detail, error);
      });
  }

  private dispatchRouteChange(detail: RouterChangeDetail): void {
    this.notifyRouteSubscribers();
    this.dispatchEvent(
      new CustomEvent<RouterChangeDetail>("route-change", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private showRouteStage(): void {
    this.viewMode = "route";
    this.routeErrorDetail = undefined;
    this.routeNotFoundDetail = undefined;
    this.requestUpdate();
  }

  private showRouteNotFound(detail: RouteNotFoundDetail): void {
    this.setTransitionDirection(detail.direction);
    this.setViewTransitionName();
    this.viewMode = "not-found";
    this.routeNotFoundDetail = detail;
    this.routeErrorDetail = undefined;
    this.requestUpdate();
    this.focusFallbackAfterRender("404");
  }

  private showRouteError(detail: RouteErrorDetail): void {
    this.setTransitionDirection(detail.direction);
    this.setViewTransitionName();
    this.viewMode = "error";
    this.routeErrorDetail = detail;
    this.routeNotFoundDetail = undefined;
    this.requestUpdate();
    this.focusFallbackAfterRender("error");
  }

  private focusFallbackAfterRender(kind: "404" | "error"): void {
    void this.updateComplete.then(() => {
      if (
        (kind === "404" && this.viewMode !== "not-found") ||
        (kind === "error" && this.viewMode !== "error")
      ) {
        return;
      }

      this.moveFocusIntoFallback(kind);
    });
  }

  private async commit(
    detail: RouterChangeDetail,
    options: { skipTransition?: boolean } = {},
  ): Promise<boolean> {
    const title = detail.leaf?.title;
    const previousDetail = this.activeDetail;
    const currentCommitId = ++this.commitId;
    this.pendingCommitDetail = detail;
    this.setTransitionDirection(detail.direction);
    this.setViewTransitionName(detail.leaf?.viewTransitionName);

    try {
      const applyRoute = async (): Promise<boolean> => {
        if (this.isCommitStale(currentCommitId)) {
          return false;
        }

        await this.updateComplete;
        if (this.isCommitStale(currentCommitId)) {
          return false;
        }

        const previousRenderedBranches = new Map(this.renderedBranches);
        const previousFocusedElement =
          this.getRenderRootActiveElement() ?? browserDocument().activeElement;
        const renderedElements = this.mountBranch(detail);
        await this.waitForRouteElements(renderedElements);
        await this.validatePendingChildOutlets();
        if (this.isCommitStale(currentCommitId)) {
          return false;
        }

        this.activeDetail = detail;
        this.showRouteStage();
        this.restoreScrollPosition(detail);
        this.moveFocusIntoRoute(
          detail,
          previousDetail,
          previousRenderedBranches,
          previousFocusedElement,
        );
        return true;
      };

      let committed = false;
      if (options.skipTransition || this.noViewTransition) {
        committed = await applyRoute();
      } else {
        await this.runViewTransition(async () => {
          committed = await applyRoute();
        });
      }

      if (!committed || this.isCommitStale(currentCommitId)) {
        return false;
      }

      if (title) {
        browserDocument().title = this.fillTitle(title, detail.params);
      }

      return true;
    } finally {
      if (this.pendingCommitDetail === detail) {
        this.pendingCommitDetail = undefined;
      }
    }
  }

  private isCommitStale(commitId: number): boolean {
    return commitId !== this.commitId;
  }

  private setTransitionDirection(direction: NavigationDirection): void {
    this.dataset.transitionDirection = direction;
  }

  private setViewTransitionName(name?: string): void {
    const normalized = name?.trim();
    if (normalized && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(normalized)) {
      this.style.setProperty("--router-view-transition-name", normalized);
      this.dataset.viewTransitionName = normalized;
      return;
    }

    this.style.removeProperty("--router-view-transition-name");
    delete this.dataset.viewTransitionName;
  }

  private mountBranch(detail: RouterChangeDetail): HTMLElement[] {
    const viewport = this.viewport;
    if (!viewport) {
      return [];
    }

    if (detail.branch.length === 0) {
      viewport.replaceChildren();
      viewport.dataset.path = detail.pathname;
      this.renderedBranches.clear();
      return [];
    }

    const oldElements = this.collectRenderedElements();
    const oldElementByRoute = this.collectRenderedElementByRoute();
    const nextElementByRoute = new Map<RouteDefinition, HTMLElement>();
    const nextBranches = new Map<string, HTMLElement[]>();
    const mountedElements = new Set<HTMLElement>();
    const mountedList: HTMLElement[] = [];

    this.mountRouteBranch({
      slotName: DEFAULT_CHILD_SLOT,
      branch: detail.branch,
      detail,
      oldElementByRoute,
      nextElementByRoute,
      nextBranches,
      mountedElements,
      mountedList,
    });

    const root = nextBranches.get(DEFAULT_CHILD_SLOT)?.[0];
    if (root && viewport.firstElementChild !== root) {
      viewport.replaceChildren(root);
    }

    for (const [slotName, branch] of Object.entries(
      detail.slotBranches ?? {},
    ).sort(([left], [right]) => left.localeCompare(right))) {
      this.mountRouteBranch({
        slotName,
        branch,
        detail,
        oldElementByRoute,
        nextElementByRoute,
        nextBranches,
        mountedElements,
        mountedList,
      });
    }

    for (const element of oldElements.reverse()) {
      if (!mountedElements.has(element)) {
        element.remove();
      }
    }

    viewport.dataset.path = detail.pathname;
    this.renderedBranches = nextBranches;
    return mountedList;
  }

  private mountRouteBranch(options: {
    slotName: string;
    branch: RouteDefinition[];
    detail: RouterChangeDetail;
    oldElementByRoute: Map<RouteDefinition, HTMLElement>;
    nextElementByRoute: Map<RouteDefinition, HTMLElement>;
    nextBranches: Map<string, HTMLElement[]>;
    mountedElements: Set<HTMLElement>;
    mountedList: HTMLElement[];
  }): void {
    const elements: HTMLElement[] = [];
    const branchParams =
      options.slotName === DEFAULT_CHILD_SLOT
        ? options.detail.params
        : (options.detail.slotParams?.[options.slotName] ??
          options.detail.slots?.[options.slotName]?.params ??
          options.detail.params);

    for (let index = 0; index < options.branch.length; index += 1) {
      const route = options.branch[index];
      let element =
        options.nextElementByRoute.get(route) ??
        options.oldElementByRoute.get(route);
      const created = !element;
      const routeSlot =
        index === 0 ? DEFAULT_CHILD_SLOT : this.routeSlot(route);

      if (!element) {
        element = this.createRouteElement(
          route,
          options.detail,
          index,
          routeSlot,
          options.branch,
          branchParams,
        );
      } else if (!options.nextElementByRoute.has(route)) {
        this.applyRouteState(
          element,
          route,
          options.detail,
          routeSlot,
          options.branch,
          branchParams,
        );
      }

      element.setAttribute("data-route-depth", String(index));
      options.nextElementByRoute.set(route, element);
      options.mountedElements.add(element);
      if (!options.mountedList.includes(element)) {
        options.mountedList.push(element);
      }
      elements.push(element);

      if (index === 0) {
        continue;
      }

      const parent = elements[index - 1];
      if (element.slot !== routeSlot) {
        element.slot = routeSlot;
      }

      if (created || element.parentElement !== parent) {
        parent.append(element);
      }
      this.scheduleChildOutletValidation(
        parent,
        options.branch[index - 1],
        routeSlot,
      );
    }

    options.nextBranches.set(options.slotName, elements);
  }

  private routeSlot(route: RouteDefinition): string {
    return route.slot?.trim() || this.childSlot;
  }

  private collectRenderedElements(): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    for (const branch of this.renderedBranches.values()) {
      for (const element of branch) {
        if (seen.has(element)) {
          continue;
        }

        seen.add(element);
        elements.push(element);
      }
    }
    return elements;
  }

  private collectRenderedElementByRoute(): Map<RouteDefinition, HTMLElement> {
    const map = new Map<RouteDefinition, HTMLElement>();
    for (const [slotName, branch] of this.renderedBranches) {
      const routes =
        slotName === DEFAULT_CHILD_SLOT
          ? this.activeDetail.branch
          : (this.activeDetail.slotBranches?.[slotName] ?? []);
      for (let index = 0; index < routes.length; index += 1) {
        const element = branch[index];
        if (element && !map.has(routes[index])) {
          map.set(routes[index], element);
        }
      }
    }
    return map;
  }

  private createRouteElement(
    route: RouteDefinition,
    detail: RouterChangeDetail,
    depth: number,
    slot: string,
    branch: RouteDefinition[],
    params: Record<string, string>,
  ): HTMLElement {
    let element: HTMLElement;

    if (typeof route.component === "function") {
      element = route.component(detail);
    } else if (typeof route.component === "string") {
      element = browserDocument().createElement(route.component);
    } else {
      element = browserDocument().createElement("section");
    }

    this.applyRouteState(element, route, detail, slot, branch, params);
    element.setAttribute("data-route-depth", String(depth));
    return element;
  }

  private applyRouteState(
    element: HTMLElement,
    route: RouteDefinition,
    detail: RouterChangeDetail,
    slot: string,
    branch: RouteDefinition[],
    params: Record<string, string>,
  ): void {
    const routeData =
      detail.routeData?.get(route) ??
      (route === branch[branch.length - 1] ? detail.data : undefined);
    const routeContext: RouteContext = {
      detail,
      params,
      slot,
      branch,
      data: routeData,
    };
    const assignProps = () => {
      Object.assign(element, route.props ?? {});
      this.applyRouteContext(element, routeContext);
    };

    const customElementsRegistry = browserWindow().customElements;
    if (
      element.localName.includes("-") &&
      !customElementsRegistry.get(element.localName)
    ) {
      void customElementsRegistry
        .whenDefined(element.localName)
        .then(assignProps);
      return;
    }

    assignProps();
  }

  private applyRouteContext(element: HTMLElement, context: RouteContext): void {
    const receiver = element as HTMLElement & RouteContextReceiver;

    if (context.data !== undefined && "data" in element) {
      receiver.data = context.data;
    }

    if (typeof receiver.setRouteContext === "function") {
      receiver.setRouteContext(context);
      return;
    }

    if ("routeContext" in receiver) {
      receiver.routeContext = context;
      return;
    }
  }

  private async waitForRouteElements(elements: HTMLElement[]): Promise<void> {
    await Promise.all(
      elements.map(async (element) => {
        const candidate = element as HTMLElement & {
          updateComplete?: Promise<unknown>;
        };
        await candidate.updateComplete;
      }),
    );
  }

  private scheduleChildOutletValidation(
    element: HTMLElement,
    route: RouteDefinition,
    slotName: string,
  ): void {
    if (this.validatedChildOutlets.get(element)?.has(slotName)) {
      return;
    }

    let slots = this.pendingChildOutletChecks.get(element);
    if (!slots) {
      slots = new Map();
      this.pendingChildOutletChecks.set(element, slots);
    }
    slots.set(slotName, route);
  }

  private async validatePendingChildOutlets(): Promise<void> {
    const pendingChecks = this.pendingChildOutletChecks;
    this.pendingChildOutletChecks = new Map();

    for (const [element, slots] of pendingChecks) {
      for (const [slotName, route] of slots) {
        await this.validateChildOutlet(element, route, slotName);
      }
    }
  }

  private async validateChildOutlet(
    element: HTMLElement,
    route: RouteDefinition,
    slotName: string,
  ): Promise<void> {
    if (this.validatedChildOutlets.get(element)?.has(slotName)) {
      return;
    }

    const customElementsRegistry = browserWindow().customElements;
    if (
      element.localName.includes("-") &&
      !customElementsRegistry.get(element.localName)
    ) {
      await customElementsRegistry.whenDefined(element.localName);
    }

    if (!element.isConnected) {
      return;
    }

    let validatedSlots = this.validatedChildOutlets.get(element);
    if (!validatedSlots) {
      validatedSlots = new Set();
      this.validatedChildOutlets.set(element, validatedSlots);
    }
    validatedSlots.add(slotName);

    if (!element.shadowRoot) {
      return;
    }

    const outlet = Array.from(
      element.shadowRoot.querySelectorAll<HTMLSlotElement>("slot"),
    ).find((slot) => slot.name === slotName);
    if (outlet) {
      return;
    }

    const routeLabel = route.name
      ? `route "${route.name}"`
      : `path "${route.path || "/"}"`;
    console.warn(
      `[router-view] Parent component <${element.localName}> for ${routeLabel} is missing <slot name="${slotName}">, so nested routes cannot render into its shadow root.`,
    );
  }

  private async runViewTransition(update: () => Promise<void>): Promise<void> {
    const transitionDocument = browserDocument() as Document & {
      startViewTransition?: (callback: () => Promise<void> | void) => {
        finished: Promise<void>;
        updateCallbackDone?: Promise<void>;
      };
    };

    if (!transitionDocument.startViewTransition) {
      await update();
      return;
    }

    const transition = transitionDocument.startViewTransition(() => update());
    try {
      await (transition.updateCallbackDone ?? transition.finished);
    } finally {
      await transition.finished.catch(() => undefined);
    }
  }

  private captureScrollPosition(detail: RouterChangeDetail): void {
    this.scrollManager.capture(detail.navigationKey, detail.url);
  }

  private restoreScrollPosition(detail: RouterChangeDetail): void {
    this.scrollManager.restore(detail.navigationKey, detail.url);
  }

  private moveFocusIntoRoute(
    detail: RouterChangeDetail,
    previousDetail: RouterChangeDetail,
    previousRenderedBranches: Map<string, HTMLElement[]>,
    previousFocusedElement: Element | null,
  ): void {
    const changedSlots = this.changedSideSlots(previousDetail, detail);
    if (
      this.sameBranch(previousDetail.branch, detail.branch) &&
      changedSlots.length > 0
    ) {
      if (
        previousFocusedElement &&
        this.focusWasInBranches(
          previousFocusedElement,
          previousRenderedBranches,
          changedSlots,
        )
      ) {
        const sideFocusTarget = this.findBranchFocusTarget(changedSlots);
        sideFocusTarget?.focus();
      }
      return;
    }

    const focusTarget =
      this.viewport?.querySelector<HTMLElement>("[data-route-focus]");
    if (focusTarget) {
      focusTarget.focus();
      return;
    }

    this.tabIndex = -1;
    this.focus();
  }

  private changedSideSlots(
    previousDetail: RouterChangeDetail,
    detail: RouterChangeDetail,
  ): string[] {
    const previousSlots = previousDetail.slotBranches ?? {};
    const nextSlots = detail.slotBranches ?? {};
    const slotNames = new Set([
      ...Object.keys(previousSlots),
      ...Object.keys(nextSlots),
    ]);

    return [...slotNames]
      .filter(
        (slotName) =>
          !this.sameBranch(
            previousSlots[slotName] ?? [],
            nextSlots[slotName] ?? [],
          ),
      )
      .sort();
  }

  private sameBranch(
    previousBranch: RouteDefinition[],
    nextBranch: RouteDefinition[],
  ): boolean {
    return (
      previousBranch.length === nextBranch.length &&
      previousBranch.every((route, index) => route === nextBranch[index])
    );
  }

  private focusWasInBranches(
    focusedElement: Element,
    branches: Map<string, HTMLElement[]>,
    slotNames: string[],
  ): boolean {
    for (const slotName of slotNames) {
      for (const element of branches.get(slotName) ?? []) {
        if (element === focusedElement || element.contains(focusedElement)) {
          return true;
        }
      }
    }
    return false;
  }

  private findBranchFocusTarget(slotNames: string[]): HTMLElement | null {
    for (const slotName of slotNames) {
      for (const element of this.renderedBranches.get(slotName) ?? []) {
        if (element.hasAttribute("data-route-focus")) {
          return element;
        }

        const target = element.querySelector<HTMLElement>("[data-route-focus]");
        if (target) {
          return target;
        }
      }
    }
    return null;
  }

  private moveFocusIntoFallback(kind: "404" | "error"): void {
    const assignedFocusTarget = this.findAssignedFallbackFocusTarget(kind);
    if (assignedFocusTarget) {
      assignedFocusTarget.focus();
      return;
    }

    const fallback = this.renderRoot.querySelector<HTMLElement>(
      `.fallback[data-fallback="${kind}"]`,
    );
    const focusTarget =
      fallback?.querySelector<HTMLElement>("[data-route-focus]");
    if (focusTarget) {
      focusTarget.focus();
      return;
    }

    if (fallback) {
      fallback.tabIndex = -1;
      fallback.focus();
    }
  }

  private findAssignedFallbackFocusTarget(
    kind: "404" | "error",
  ): HTMLElement | null {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>(
      `slot[name="${kind}"]`,
    );
    if (!slot) {
      return null;
    }

    for (const element of slot.assignedElements({ flatten: true })) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      if (element.hasAttribute("data-route-focus")) {
        return element;
      }

      const descendant =
        element.querySelector<HTMLElement>("[data-route-focus]");
      if (descendant) {
        return descendant;
      }
    }

    return null;
  }

  private describeRouteError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    return "Unknown route error";
  }

  private fillTitle(template: string, params: Record<string, string>): string {
    return template.replace(/:([A-Za-z0-9_-]+)/g, (_, key: string) => {
      return params[key] ?? `:${key}`;
    });
  }

  render(): TemplateResult {
    const notFoundPath = this.routeNotFoundDetail?.url.pathname ?? "";
    const errorPhase = this.routeErrorDetail?.phase ?? "unknown";
    const errorMessage = this.describeRouteError(this.routeErrorDetail?.error);

    return html`
      <div class="viewport" ?hidden="${this.viewMode !== "route"}"></div>
      <section
        class="fallback"
        data-fallback="404"
        ?hidden="${this.viewMode !== "not-found"}"
      >
        <slot name="404">
          <article class="fallback-card">
            <p class="fallback-eyebrow">Route Not Found</p>
            <h1 data-route-focus tabindex="-1">404</h1>
            <p>No route matched <code>${notFoundPath}</code>.</p>
          </article>
        </slot>
      </section>
      <section
        class="fallback"
        data-fallback="error"
        ?hidden="${this.viewMode !== "error"}"
      >
        <slot name="error">
          <article class="fallback-card">
            <p class="fallback-eyebrow">Route Error</p>
            <h1 data-route-focus tabindex="-1">Navigation Failed</h1>
            <p>
              The route transition failed during <code>${errorPhase}</code>.
            </p>
            <pre class="fallback-error">${errorMessage}</pre>
          </article>
        </slot>
      </section>
    `;
  }

  static styles: CSSResultGroup = css`
    :host {
      display: block;
      min-height: 100%;
      contain: content;
    }

    .viewport {
      min-height: 100%;
      view-transition-name: var(--router-view-transition-name, route-stage);
      outline: none;
    }

    .fallback[hidden],
    .viewport[hidden] {
      display: none;
    }

    .fallback {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 2rem 1rem;
      outline: none;
    }

    .fallback-card {
      width: min(32rem, 100%);
      padding: 1.5rem;
      border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
      border-radius: 1rem;
      background: color-mix(in srgb, canvas 92%, currentColor 8%);
      box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.08);
    }

    .fallback-eyebrow {
      margin: 0 0 0.5rem;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.72;
    }

    .fallback-card h1 {
      margin: 0 0 0.75rem;
      font-size: clamp(2rem, 6vw, 3rem);
      line-height: 1;
      outline: none;
    }

    .fallback-card p {
      margin: 0;
      line-height: 1.55;
    }

    .fallback-error {
      margin: 1rem 0 0;
      padding: 0.75rem;
      border-radius: 0.75rem;
      overflow: auto;
      font: inherit;
      background: color-mix(in srgb, canvas 86%, currentColor 14%);
    }
  `;
}

if (
  typeof customElements !== "undefined" &&
  !customElements.get("router-view")
) {
  customElements.define("router-view", RouterView);
}
