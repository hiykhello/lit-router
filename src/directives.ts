import { noChange } from "lit";
import { AsyncDirective } from "lit/async-directive.js";
import {
  directive,
  type DirectiveResult,
  type ElementPart,
  type PartInfo,
  PartType,
} from "lit/directive.js";
import { requestContext, routerContext } from "./context.ts";
import {
  Router,
  type RouteIsActiveOptions,
  type RouteSelector,
  type RouteTarget,
} from "./router-core.ts";

export interface RouterLinkDirectiveOptions extends RouteIsActiveOptions {
  replace?: boolean;
  activeClass?: string;
  ariaCurrent?:
    boolean | "page" | "step" | "location" | "date" | "time" | "true";
  assignHref?: boolean | "auto";
}

export interface ActiveRouteDirectiveOptions extends RouteIsActiveOptions {
  activeClass?: string;
  ariaCurrent?:
    boolean | "page" | "step" | "location" | "date" | "time" | "true";
}

function isAnchor(element: Element): boolean {
  return element.tagName.toLowerCase() === "a";
}

function toggleClasses(
  element: Element,
  classes: string | undefined,
  force: boolean,
): void {
  if (!classes) {
    return;
  }
  const tokens = classes.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (force) {
      element.classList.add(token);
    } else {
      element.classList.remove(token);
    }
  }
}

function shouldHandleClick(event: MouseEvent, element: Element): boolean {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const target = element.getAttribute("target");
  if (target && target !== "_self") {
    return false;
  }
  const rel = element.getAttribute("rel");
  if (rel && rel.split(/\s+/).includes("external")) {
    return false;
  }

  const path =
    typeof event.composedPath === "function" ? event.composedPath() : [];
  if (path.length > 0) {
    for (const item of path) {
      if (item instanceof Element) {
        if (
          item.hasAttribute("data-router-ignore") ||
          item.hasAttribute("download") ||
          item.hasAttribute("disabled") ||
          item.getAttribute("aria-disabled") === "true"
        ) {
          return false;
        }
      }
      if (item === element) {
        break;
      }
    }
  } else {
    let current: Element | null = event.target as Element | null;
    while (current && current !== element.parentElement) {
      if (
        current.hasAttribute?.("data-router-ignore") ||
        current.hasAttribute?.("download") ||
        current.hasAttribute?.("disabled") ||
        current.getAttribute?.("aria-disabled") === "true"
      ) {
        return false;
      }
      current = current.parentElement;
    }
  }
  return true;
}

function mergeTargetOptions(
  target: RouteTarget,
  options: RouterLinkDirectiveOptions,
): RouteTarget {
  if (
    typeof target === "object" &&
    target !== null &&
    !(target instanceof URL)
  ) {
    return {
      ...target,
      params: target.params ?? options.params,
      query: target.query ?? options.query,
      hash: target.hash ?? options.hash,
    };
  }
  return target;
}

// ==========================================
// 1. routerLink Directive
// ==========================================

class RouterLinkDirective extends AsyncDirective {
  private element?: Element;
  private router?: Router;
  private target?: RouteTarget;
  private options: RouterLinkDirectiveOptions = {};
  private unsubscribeContext?: () => void;
  private listeningRouter?: Router;
  private lastActiveClass?: string;
  private isExplicitRouter = false;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error("The `routerLink` directive must be used on an element.");
    }
  }

  render(
    _routerOrTarget: Router | RouteTarget,
    _targetOrOptions?: RouteTarget | RouterLinkDirectiveOptions,
    _options?: RouterLinkDirectiveOptions,
  ): typeof noChange {
    return noChange;
  }

  override update(
    part: ElementPart,
    args: [
      Router | RouteTarget,
      (RouteTarget | RouterLinkDirectiveOptions)?,
      RouterLinkDirectiveOptions?,
    ],
  ): typeof noChange {
    this.element = part.element;

    let routerArg: Router | undefined;
    let targetArg: RouteTarget;
    let optionsArg: RouterLinkDirectiveOptions | undefined;

    if (args[0] instanceof Router) {
      routerArg = args[0];
      targetArg = args[1] as RouteTarget;
      optionsArg = args[2];
    } else {
      routerArg = undefined;
      targetArg = args[0] as RouteTarget;
      optionsArg = args[1] as RouterLinkDirectiveOptions | undefined;
    }

    this.target = targetArg;
    this.options = optionsArg ?? {};

    if (routerArg) {
      this.isExplicitRouter = true;
      this.unsubscribeContext?.();
      this.unsubscribeContext = undefined;
      this.setRouter(routerArg);
    } else {
      this.isExplicitRouter = false;
      if (!this.router) {
        this.seekRouter();
        if (!this.element.isConnected) {
          queueMicrotask(() => {
            if (!this.router && this.element?.isConnected) {
              this.seekRouter();
            }
          });
        }
      } else {
        this.applyState();
      }
    }

    return noChange;
  }

  private seekRouter(): void {
    if (!this.element) {
      return;
    }
    this.unsubscribeContext?.();
    this.unsubscribeContext = requestContext(
      this.element,
      routerContext,
      (router) => {
        this.setRouter(router);
      },
      true,
    );
  }

  private setRouter(router: Router): void {
    if (this.router === router) {
      this.attachRouterListener();
      this.applyState();
      return;
    }

    this.detachRouterListener();
    this.router = router;
    this.attachRouterListener();
    this.applyState();
  }

  private attachRouterListener(): void {
    if (!this.router || this.listeningRouter === this.router) {
      return;
    }
    this.router.addEventListener("route-change", this.onRouteChange);
    this.listeningRouter = this.router;
  }

  private detachRouterListener(): void {
    if (this.listeningRouter) {
      this.listeningRouter.removeEventListener(
        "route-change",
        this.onRouteChange,
      );
      this.listeningRouter = undefined;
    }
  }

  private readonly onRouteChange = (): void => {
    this.updateActiveStatus();
  };

  private readonly onClick = (event: Event): void => {
    if (!this.element || !this.router || !this.target) {
      return;
    }
    const mouseEvent = event as MouseEvent;
    if (!shouldHandleClick(mouseEvent, this.element)) {
      return;
    }

    event.preventDefault();
    const effectiveTarget = mergeTargetOptions(this.target, this.options);
    if (this.options.replace) {
      this.router.replace(effectiveTarget);
    } else {
      this.router.push(effectiveTarget);
    }
  };

  private applyState(): void {
    const element = this.element;
    if (!element || !this.target) {
      return;
    }

    // Attach click handler once
    element.removeEventListener("click", this.onClick);
    element.addEventListener("click", this.onClick);

    // Compute and assign href
    const shouldAssign =
      this.options.assignHref === true ||
      (this.options.assignHref !== false && isAnchor(element));

    if (shouldAssign) {
      const effectiveTarget = mergeTargetOptions(this.target, this.options);
      const href = this.router
        ? this.router.link(effectiveTarget)
        : typeof effectiveTarget === "string"
          ? effectiveTarget
          : effectiveTarget instanceof URL
            ? effectiveTarget.href
            : "";
      if (href) {
        element.setAttribute("href", href);
      }
    }

    if (this.options.replace) {
      element.setAttribute("data-router-replace", "");
    } else {
      element.removeAttribute("data-router-replace");
    }

    this.updateActiveStatus();
  }

  private updateActiveStatus(): void {
    const element = this.element;
    if (!element || !this.router || !this.target) {
      return;
    }

    const { activeClass, exact, ariaCurrent, params, query, hash } =
      this.options;
    const isAnchorEl = isAnchor(element);
    const shouldManageAria = ariaCurrent !== undefined || isAnchorEl;

    if (!activeClass && !shouldManageAria && !this.lastActiveClass) {
      return;
    }

    const effectiveTarget = mergeTargetOptions(this.target, this.options);
    const isActive = this.router.isActive(effectiveTarget, {
      exact,
      params,
      query,
      hash,
    });

    if (this.lastActiveClass && this.lastActiveClass !== activeClass) {
      toggleClasses(element, this.lastActiveClass, false);
    }
    this.lastActiveClass = activeClass;

    if (activeClass) {
      toggleClasses(element, activeClass, isActive);
    }

    if (ariaCurrent === false) {
      element.removeAttribute("aria-current");
    } else if (shouldManageAria) {
      const token = typeof ariaCurrent === "string" ? ariaCurrent : "page";
      if (isActive) {
        element.setAttribute("aria-current", token);
      } else {
        element.removeAttribute("aria-current");
      }
    }
  }

  override disconnected(): void {
    if (this.element) {
      if (this.lastActiveClass) {
        toggleClasses(this.element, this.lastActiveClass, false);
        this.lastActiveClass = undefined;
      }
      this.element.removeAttribute("aria-current");
    }
    this.element?.removeEventListener("click", this.onClick);
    this.detachRouterListener();
    this.unsubscribeContext?.();
    this.unsubscribeContext = undefined;
  }

  override reconnected(): void {
    if (this.element && (!this.isExplicitRouter || !this.router)) {
      this.seekRouter();
    } else if (this.router) {
      this.attachRouterListener();
      this.applyState();
    }
  }
}

export const routerLink = directive(RouterLinkDirective) as {
  (
    target: RouteTarget,
    options?: RouterLinkDirectiveOptions,
  ): DirectiveResult<typeof RouterLinkDirective>;
  (
    router: Router,
    target: RouteTarget,
    options?: RouterLinkDirectiveOptions,
  ): DirectiveResult<typeof RouterLinkDirective>;
};

// ==========================================
// 2. activeRoute Directive
// ==========================================

class ActiveRouteDirective extends AsyncDirective {
  private element?: Element;
  private router?: Router;
  private target?: RouteTarget | RouteSelector;
  private options: ActiveRouteDirectiveOptions = {};
  private unsubscribeContext?: () => void;
  private listeningRouter?: Router;
  private lastActiveClass?: string;
  private isExplicitRouter = false;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        "The `activeRoute` directive must be used on an element.",
      );
    }
  }

  render(
    _routerOrTarget: Router | RouteTarget | RouteSelector,
    _targetOrOptions?:
      RouteTarget | RouteSelector | ActiveRouteDirectiveOptions,
    _options?: ActiveRouteDirectiveOptions,
  ): typeof noChange {
    return noChange;
  }

  override update(
    part: ElementPart,
    args: [
      Router | RouteTarget | RouteSelector,
      (RouteTarget | RouteSelector | ActiveRouteDirectiveOptions)?,
      ActiveRouteDirectiveOptions?,
    ],
  ): typeof noChange {
    this.element = part.element;

    let routerArg: Router | undefined;
    let targetArg: RouteTarget | RouteSelector;
    let optionsArg: ActiveRouteDirectiveOptions | undefined;

    if (args[0] instanceof Router) {
      routerArg = args[0];
      targetArg = args[1] as RouteTarget | RouteSelector;
      optionsArg = args[2];
    } else {
      routerArg = undefined;
      targetArg = args[0] as RouteTarget | RouteSelector;
      optionsArg = args[1] as ActiveRouteDirectiveOptions | undefined;
    }

    this.target = targetArg;
    this.options = optionsArg ?? {};

    if (routerArg) {
      this.isExplicitRouter = true;
      this.unsubscribeContext?.();
      this.unsubscribeContext = undefined;
      this.setRouter(routerArg);
    } else {
      this.isExplicitRouter = false;
      if (!this.router) {
        this.seekRouter();
        if (!this.element.isConnected) {
          queueMicrotask(() => {
            if (!this.router && this.element?.isConnected) {
              this.seekRouter();
            }
          });
        }
      } else {
        this.updateActiveStatus();
      }
    }

    return noChange;
  }

  private seekRouter(): void {
    if (!this.element) {
      return;
    }
    this.unsubscribeContext?.();
    this.unsubscribeContext = requestContext(
      this.element,
      routerContext,
      (router) => {
        this.setRouter(router);
      },
      true,
    );
  }

  private setRouter(router: Router): void {
    if (this.router === router) {
      this.attachRouterListener();
      this.updateActiveStatus();
      return;
    }

    this.detachRouterListener();
    this.router = router;
    this.attachRouterListener();
    this.updateActiveStatus();
  }

  private attachRouterListener(): void {
    if (!this.router || this.listeningRouter === this.router) {
      return;
    }
    this.router.addEventListener("route-change", this.onRouteChange);
    this.listeningRouter = this.router;
  }

  private detachRouterListener(): void {
    if (this.listeningRouter) {
      this.listeningRouter.removeEventListener(
        "route-change",
        this.onRouteChange,
      );
      this.listeningRouter = undefined;
    }
  }

  private readonly onRouteChange = (): void => {
    this.updateActiveStatus();
  };

  private updateActiveStatus(): void {
    const element = this.element;
    if (!element || !this.router || !this.target) {
      return;
    }

    const {
      activeClass = "active",
      exact,
      ariaCurrent,
      params,
      query,
      hash,
    } = this.options;
    const effectiveTarget =
      typeof this.target === "string"
        ? this.target
        : mergeTargetOptions(this.target as RouteTarget, this.options);
    const isActive = this.router.isActive(effectiveTarget, {
      exact,
      params,
      query,
      hash,
    });

    if (this.lastActiveClass && this.lastActiveClass !== activeClass) {
      toggleClasses(element, this.lastActiveClass, false);
    }
    this.lastActiveClass = activeClass;

    if (activeClass) {
      toggleClasses(element, activeClass, isActive);
    }

    if (ariaCurrent === false) {
      element.removeAttribute("aria-current");
    } else if (ariaCurrent !== undefined || isAnchor(element)) {
      const token = typeof ariaCurrent === "string" ? ariaCurrent : "page";
      if (isActive) {
        element.setAttribute("aria-current", token);
      } else {
        element.removeAttribute("aria-current");
      }
    }
  }

  override disconnected(): void {
    if (this.element) {
      if (this.lastActiveClass) {
        toggleClasses(this.element, this.lastActiveClass, false);
        this.lastActiveClass = undefined;
      }
      this.element.removeAttribute("aria-current");
    }
    this.detachRouterListener();
    this.unsubscribeContext?.();
    this.unsubscribeContext = undefined;
  }

  override reconnected(): void {
    if (this.element && (!this.isExplicitRouter || !this.router)) {
      this.seekRouter();
    } else if (this.router) {
      this.attachRouterListener();
      this.updateActiveStatus();
    }
  }
}

export const activeRoute = directive(ActiveRouteDirective) as {
  (
    target: RouteTarget | RouteSelector,
    options?: ActiveRouteDirectiveOptions,
  ): DirectiveResult<typeof ActiveRouteDirective>;
  (
    router: Router,
    target: RouteTarget | RouteSelector,
    options?: ActiveRouteDirectiveOptions,
  ): DirectiveResult<typeof ActiveRouteDirective>;
};
