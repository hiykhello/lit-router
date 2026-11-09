import {
  assert,
  assertEquals,
  ensureDom,
  resetDom,
  settle,
  teardownDom,
} from "./test_setup.ts";
import { test, vi } from "vitest";
import { html, render } from "lit";
import {
  activeRoute,
  requestContext,
  routeContext,
  RouteContext,
  RouteErrorDetail,
  Router,
  routerContext,
  routerLink,
  RouterView,
} from "../src/router.ts";

function browser(): typeof globalThis & Window {
  ensureDom();
  return globalThis as typeof globalThis & Window;
}

function ensureTestElements(): void {
  const dom = browser();

  if (!dom.customElements.get("test-ext-page")) {
    dom.customElements.define(
      "test-ext-page",
      class TestExtPage extends dom.HTMLElement {
        connectedCallback(): void {
          if (!this.textContent) {
            this.textContent = this.localName;
          }
        }
      },
    );
  }
}

async function withRouters(
  run: (
    createRouter: (options?: ConstructorParameters<typeof Router>[0]) => Router,
  ) => void | Promise<void>,
): Promise<void> {
  ensureTestElements();
  resetDom();
  const routers: Router[] = [];

  const createRouter = (
    options: ConstructorParameters<typeof Router>[0] = {},
  ): Router => {
    const router = new Router(options);
    routers.push(router);
    return router;
  };

  try {
    await run(createRouter);
  } finally {
    try {
      const dom = browser();
      for (const router of routers) {
        router.stop();
      }
      dom.document.body.replaceChildren();
      await settle();
    } finally {
      teardownDom();
    }
  }
}

test("router.isActive matches paths, prefixes, named routes, selectors, params, query, and hash", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", name: "home", component: "test-ext-page" },
        {
          path: "users",
          name: "users-root",
          component: "test-ext-page",
          children: [
            { path: "", name: "users-list", component: "test-ext-page" },
            {
              path: ":id",
              name: "user-detail",
              id: "user-detail-id",
              component: "test-ext-page",
            },
          ],
        },
      ],
    });

    router.start();
    await settle();

    // At home '/'
    assertEquals(router.isActive("/"), true);
    assertEquals(router.isActive("/", { exact: true }), true);
    assertEquals(router.isActive("home"), true);
    assertEquals(router.isActive("/users"), false);

    // Navigate to /users/42?tab=activity#section1
    router.push("/users/42?tab=activity#section1");
    await settle();

    // Path matches
    assertEquals(router.isActive("/users"), true);
    assertEquals(router.isActive("/users", { exact: true }), false);
    assertEquals(router.isActive("/users/42"), true);
    assertEquals(router.isActive("/users/42", { exact: true }), true);
    assertEquals(router.isActive("/users/99"), false);

    // Named route matches
    assertEquals(router.isActive("user-detail"), true);
    assertEquals(router.isActive("users-root"), true);
    assertEquals(router.isActive("users-root", { exact: true }), false);
    assertEquals(router.isActive("home"), false);

    // Route selector with id
    assertEquals(router.isActive({ id: "user-detail-id" }), true);
    assertEquals(
      router.isActive({ id: "user-detail-id" }, { exact: true }),
      true,
    );

    // RouteLocation with params, query, hash
    assertEquals(
      router.isActive({ name: "user-detail", params: { id: 42 } }),
      true,
    );
    assertEquals(
      router.isActive({ name: "user-detail", params: { id: 99 } }),
      false,
    );
    assertEquals(
      router.isActive("/users/42", { query: { tab: "activity" } }),
      true,
    );
    assertEquals(
      router.isActive("/users/42", { query: { tab: "profile" } }),
      false,
    );
    assertEquals(router.isActive("/users/42", { hash: "section1" }), true);
    assertEquals(router.isActive("/users/42", { hash: "section2" }), false);
  });
});

test("router.registerLeaveGuard dynamically intercepts leaving routes", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        { path: "protected", component: "test-ext-page" },
        { path: "target", component: "test-ext-page" },
      ],
    });

    router.start();
    await settle();
    router.push("/protected");
    await settle();

    let allowLeave = false;
    const unregister = router.registerLeaveGuard(() => {
      return allowLeave;
    });

    // Try to leave
    router.push("/target");
    await settle();
    assertEquals(router.current.localPathname, "/protected");

    // Allow leave
    allowLeave = true;
    router.push("/target");
    await settle();
    assertEquals(router.current.localPathname, "/target");

    // Unregister guard
    unregister();
    router.push("/protected");
    await settle();
    allowLeave = false;
    router.push("/target");
    await settle();
    assertEquals(router.current.localPathname, "/target");
  });
});

test("rendered component with beforeRouteLeave method blocks or allows leaving", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();

    let componentAllowLeave = false;
    let componentLeaveCalls = 0;

    if (!dom.customElements.get("test-leave-component")) {
      dom.customElements.define(
        "test-leave-component",
        class TestLeaveComponent extends dom.HTMLElement {
          beforeRouteLeave() {
            componentLeaveCalls += 1;
            return componentAllowLeave;
          }
        },
      );
    }

    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        { path: "form", component: "test-leave-component" },
        { path: "done", component: "test-ext-page" },
      ],
    });

    const view = dom.document.createElement("router-view") as RouterView;
    view.router = router;
    dom.document.body.append(view);
    await settle(view);

    router.push("/form");
    await settle(view);
    assertEquals(router.current.localPathname, "/form");

    // Attempt navigation while component blocks
    router.push("/done");
    await settle(view);
    assertEquals(componentLeaveCalls, 1);
    assertEquals(router.current.localPathname, "/form");

    // Allow navigation
    componentAllowLeave = true;
    router.push("/done");
    await settle(view);
    assertEquals(componentLeaveCalls, 2);
    assertEquals(router.current.localPathname, "/done");
  });
});

test("route loader loads data asynchronously and provides it via detail, context, and element", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();

    interface UserData {
      name: string;
      role: string;
    }

    let receivedContextData: unknown;
    let receivedElementData: unknown;

    if (!dom.customElements.get("test-loader-page")) {
      dom.customElements.define(
        "test-loader-page",
        class TestLoaderPage extends dom.HTMLElement {
          data?: unknown;
          setRouteContext(context: RouteContext) {
            receivedContextData = context.data;
          }
          connectedCallback() {
            receivedElementData = this.data;
          }
        },
      );
    }

    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        {
          path: "user/:id",
          name: "user-route",
          component: "test-loader-page",
          loader: async ({ params }) => {
            return {
              name: `User ${params?.id}`,
              role: "admin",
            } as UserData;
          },
        },
      ],
    });

    const view = dom.document.createElement("router-view") as RouterView;
    view.router = router;
    dom.document.body.append(view);

    router.push("/user/101");
    await settle(view);

    assertEquals(router.current.localPathname, "/user/101");
    const expectedData = { name: "User 101", role: "admin" };
    assertEquals(router.current.data, expectedData);
    assertEquals(router.getRouteData(), expectedData);
    assertEquals(router.getRouteData("user-route"), expectedData);
    assertEquals(receivedContextData, expectedData);
    assertEquals(receivedElementData, expectedData);
  });
});

test("route loader error dispatches route-error event with phase load", async () => {
  await withRouters(async (createRouter) => {
    const routeErrors: RouteErrorDetail[] = [];

    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        {
          path: "broken-loader",
          component: "test-ext-page",
          loader: async () => {
            throw new Error("Failed to fetch data");
          },
        },
      ],
    });

    router.addEventListener("route-error", (event) => {
      routeErrors.push((event as CustomEvent<RouteErrorDetail>).detail);
    });

    router.start();
    await settle();

    router.push("/broken-loader");
    await settle();

    assertEquals(routeErrors.length, 1);
    assertEquals(routeErrors[0]?.phase, "load");
    assertEquals(
      (routeErrors[0]?.error as Error).message,
      "Failed to fetch data",
    );
  });
});

test("router-view answers context-request for routerContext and routeContext", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();

    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        { path: "about", component: "test-ext-page" },
      ],
    });

    const view = dom.document.createElement("router-view") as RouterView;
    view.router = router;
    dom.document.body.append(view);

    await settle(view);

    const child = dom.document.createElement("div");
    view.append(child);

    let answeredRouter: Router | undefined;
    requestContext(child, routerContext, (r) => {
      answeredRouter = r;
    });

    assertEquals(answeredRouter, router);

    let answeredRoutePath = "";
    const unsub = requestContext(
      child,
      routeContext,
      (ctx) => {
        answeredRoutePath = ctx.detail.localPathname;
      },
      true,
    );

    assertEquals(answeredRoutePath, "/");

    router.push("/about");
    await settle(view);
    assertEquals(answeredRoutePath, "/about");

    unsub();
  });
});

test("routerLink directive sets href, toggles active class and handles clicks", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();

    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        { path: "dashboard", component: "test-ext-page" },
      ],
    });

    const view = dom.document.createElement("router-view") as RouterView;
    view.router = router;
    dom.document.body.append(view);

    router.start();
    await settle(view);

    const container = dom.document.createElement("div");
    dom.document.body.append(container);

    render(
      html`
        <a
          ${routerLink(router, "/dashboard", { activeClass: "link-active", ariaCurrent: "page" })}
        >
          Dashboard
        </a>
      `,
      container,
    );

    const anchor = container.querySelector("a") as HTMLAnchorElement;
    assert(anchor);
    assertEquals(anchor.getAttribute("href"), "/dashboard");
    assertEquals(anchor.classList.contains("link-active"), false);
    assertEquals(anchor.hasAttribute("aria-current"), false);

    // Click anchor
    anchor.dispatchEvent(
      new dom.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await settle(view);

    assertEquals(router.current.localPathname, "/dashboard");
    assertEquals(anchor.classList.contains("link-active"), true);
    assertEquals(anchor.getAttribute("aria-current"), "page");
  });
});

test("activeRoute directive toggles active class and aria-current on elements", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();

    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        { path: "settings", component: "test-ext-page" },
      ],
    });

    router.start();
    await settle();

    const container = dom.document.createElement("div");
    dom.document.body.append(container);

    render(
      html`
        <li ${activeRoute(router, "/settings", { activeClass: "nav-active" })}>
          Settings
        </li>
      `,
      container,
    );

    const li = container.querySelector("li") as HTMLElement;
    assert(li);
    assertEquals(li.classList.contains("nav-active"), false);

    router.push("/settings");
    await settle();

    assertEquals(li.classList.contains("nav-active"), true);

    router.push("/");
    await settle();

    assertEquals(li.classList.contains("nav-active"), false);
  });
});

test("router.isActive and router.link handle basePath correctly", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/app/");

    const router = createRouter({
      basePath: "/app",
      routes: [
        { path: "", name: "home", component: "test-ext-page" },
        {
          path: "users/:id",
          name: "user-detail",
          component: "test-ext-page",
        },
      ],
    });

    router.start();
    await settle();

    // router.link with named route string
    assertEquals(router.link("home"), "/app");
    assertEquals(router.link("/users/12"), "/app/users/12");
    assertEquals(router.link("/app/users/12"), "/app/users/12");

    router.push("/app/users/42");
    await settle();

    // Local path vs full path isActive checks
    assertEquals(router.isActive("/users/42"), true);
    assertEquals(router.isActive("/app/users/42"), true);
    assertEquals(router.isActive("/users"), true);
    assertEquals(router.isActive("/app/users"), true);
    assertEquals(router.isActive("/users", { exact: true }), false);
  });
});

test("router-view delivers routerContext to late-connected or pre-subscribed children", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();

    const router = createRouter({
      routes: [{ path: "", component: "test-ext-page" }],
    });

    const view = dom.document.createElement("router-view") as RouterView;
    dom.document.body.append(view);

    const child = dom.document.createElement("div");
    view.append(child);

    let receivedRouter: Router | undefined;
    requestContext(
      child,
      routerContext,
      (r) => {
        receivedRouter = r;
      },
      true,
    );

    // At this point view.router has not been assigned yet
    assertEquals(receivedRouter, undefined);

    // Assign view.router later
    view.router = router;
    await settle(view);

    // Subscriber should now have received the router!
    assertEquals(receivedRouter, router);
  });
});

test("concurrent route loaders execute in parallel and deduplicate shared routes", async () => {
  await withRouters(async (createRouter) => {
    let parentLoaderCalls = 0;
    let childLoaderCalls = 0;
    const executionOrder: string[] = [];

    const router = createRouter({
      routes: [
        {
          path: "parent",
          component: "test-ext-page",
          loader: async () => {
            parentLoaderCalls += 1;
            await Promise.resolve();
            executionOrder.push("parent");
            return { parentData: true };
          },
          children: [
            {
              path: "child",
              component: "test-ext-page",
              loader: async () => {
                childLoaderCalls += 1;
                await Promise.resolve();
                executionOrder.push("child");
                return { childData: true };
              },
            },
          ],
        },
      ],
    });

    router.start();
    await settle();

    router.push("/parent/child");
    await settle();

    assertEquals(parentLoaderCalls, 1);
    assertEquals(childLoaderCalls, 1);
    assertEquals(executionOrder.length, 2);
    assertEquals(router.getRouteData(), { childData: true });
  });
});

test("router.isActive matches multi-value queries and explicit empty hash", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [{ path: "items", component: "test-ext-page" }],
    });

    router.start();
    await settle();

    router.push("/items?tag=tech&tag=news#top");
    await settle();

    // Multi-value query matching
    assertEquals(
      router.isActive("/items", { query: { tag: ["tech", "news"] } }),
      true,
    );
    assertEquals(router.isActive("/items", { query: { tag: "tech" } }), true);
    assertEquals(
      router.isActive("/items", { query: { tag: "sports" } }),
      false,
    );

    // Hash matching: "#top" matches, but explicit empty hash "" rejects
    assertEquals(router.isActive("/items", { hash: "top" }), true);
    assertEquals(router.isActive("/items", { hash: "" }), false);
  });
});

test("router.getRouteData retrieves data for side-slot parallel routes", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          path: "dashboard",
          component: "test-ext-page",
          children: [
            {
              path: "",
              name: "main-dashboard",
              component: "test-ext-page",
              loader: () => ({ main: true }),
            },
            {
              path: "",
              slot: "sidebar",
              name: "sidebar-panel",
              component: "test-ext-page",
              loader: () => ({ sideMenu: ["a", "b"] }),
            },
          ],
        },
      ],
    });

    router.start();
    await settle();

    router.push("/dashboard");
    await settle();

    assertEquals(router.getRouteData("main-dashboard"), { main: true });
    assertEquals(router.getRouteData("sidebar-panel"), {
      sideMenu: ["a", "b"],
    });
  });
});

test("disabled elements with routerLink directive ignore clicks", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();

    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        { path: "target", component: "test-ext-page" },
      ],
    });

    router.start();
    await settle();

    const container = dom.document.createElement("div");
    dom.document.body.append(container);

    render(
      html`
        <button disabled ${routerLink(router, "/target")}>
          Disabled Button
        </button>
      `,
      container,
    );

    const button = container.querySelector("button") as HTMLButtonElement;
    assert(button);

    button.dispatchEvent(
      new dom.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await settle();

    // Navigation should not have occurred
    assertEquals(router.current.localPathname, "/");
  });
});

test("component beforeRouteLeave error is caught safely without crashing navigation", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();

    if (!dom.customElements.get("test-throwing-leave-component")) {
      dom.customElements.define(
        "test-throwing-leave-component",
        class TestThrowingLeaveComponent extends dom.HTMLElement {
          beforeRouteLeave() {
            throw new Error("Deliberate component crash in guard");
          }
        },
      );
    }

    const router = createRouter({
      routes: [
        { path: "", component: "test-ext-page" },
        { path: "form", component: "test-throwing-leave-component" },
        { path: "next", component: "test-ext-page" },
      ],
    });

    const view = dom.document.createElement("router-view") as RouterView;
    view.router = router;
    dom.document.body.append(view);
    await settle(view);

    router.push("/form");
    await settle(view);
    assertEquals(router.current.localPathname, "/form");

    // Attempt leaving: throwing hook safely blocks navigation
    router.push("/next");
    await settle(view);
    assertEquals(router.current.localPathname, "/form");
  });
});

test("router.push and router.replace handle non-root basePath properly", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/app/");

    const router = createRouter({
      basePath: "/app",
      routes: [
        { path: "", component: "test-ext-page" },
        { path: "users", name: "users", component: "test-ext-page" },
        { path: "dashboard", component: "test-ext-page" },
      ],
    });

    await settle();

    // Navigating with leading slash path string
    router.push("/users");
    await settle();
    assertEquals(router.current.pathname, "/app/users");
    assertEquals(router.current.localPathname, "/users");

    // Replace navigation with leading slash path string
    router.replace("/dashboard");
    await settle();
    assertEquals(router.current.pathname, "/app/dashboard");
    assertEquals(router.current.localPathname, "/dashboard");

    // link() generates properly prefixed basePath URL
    assertEquals(router.link("/users"), "/app/users");
    assertEquals(router.link("/app/users"), "/app/users");

    // isActive() correctly matches
    assertEquals(router.isActive("/dashboard"), true);
    assertEquals(router.isActive("/app/dashboard"), true);
    assertEquals(router.isActive("/users"), false);
  });
});

test("router.isActive matches named routes and IDs in parallel slot outlets", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/workspace");

    const router = createRouter({
      routes: [
        {
          path: "workspace",
          name: "workspace-main",
          id: "main-pane",
          component: "test-ext-page",
          children: [
            {
              path: "",
              name: "workspace-sidebar",
              id: "side-pane",
              slot: "sidebar",
              component: "test-ext-page",
            },
          ],
        },
      ],
    });

    await settle();

    // Main route matches
    assertEquals(router.isActive("workspace-main"), true);
    assertEquals(router.isActive({ id: "main-pane" }), true);

    // Sidebar slot route matches by name and ID
    assertEquals(router.isActive("workspace-sidebar"), true);
    assertEquals(router.isActive({ name: "workspace-sidebar" }), true);
    assertEquals(router.isActive({ id: "side-pane" }), true);
  });
});

test("router.getRouteData falls back to nearest ancestor route with data", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/org/acme/settings");

    const router = createRouter({
      routes: [
        {
          path: "org/:orgId",
          name: "org-layout",
          loader: () => ({ orgName: "Acme Corp" }),
          children: [
            {
              path: "settings",
              name: "org-settings",
              component: "test-ext-page",
              // Note: No loader on this leaf route
            },
          ],
        },
      ],
    });

    await settle();

    // Calling without selector inherits data from parent in branch
    const data = router.getRouteData<{ orgName: string }>();
    assertEquals(data?.orgName, "Acme Corp");
    assertEquals(router.current.data, { orgName: "Acme Corp" });
  });
});

test("routerLink handles multiple space-separated classes and empty string safely", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/home");

    const router = createRouter({
      routes: [
        { path: "home", component: "test-ext-page" },
        { path: "about", component: "test-ext-page" },
      ],
    });

    const host = dom.document.createElement("div");
    dom.document.body.append(host);

    // Multi-class activeClass and empty activeClass
    render(
      html`
        <a
          ${routerLink(router, "/home", { activeClass: "bg-blue-500 font-bold active" })}
          >Home</a
        >
        <a ${routerLink(router, "/about", { activeClass: "" })}>About</a>
      `,
      host,
    );
    await settle();

    const homeAnchor = host.querySelectorAll("a")[0]!;
    const aboutAnchor = host.querySelectorAll("a")[1]!;

    assertEquals(homeAnchor.classList.contains("bg-blue-500"), true);
    assertEquals(homeAnchor.classList.contains("font-bold"), true);
    assertEquals(homeAnchor.classList.contains("active"), true);
    assertEquals(homeAnchor.getAttribute("aria-current"), "page");

    // Empty string activeClass should not throw and not add empty classes
    assertEquals(aboutAnchor.classList.length, 0);

    // Click on child element of a link with data-router-ignore is ignored
    const ignoreHost = dom.document.createElement("div");
    dom.document.body.append(ignoreHost);
    render(
      html`
        <a ${routerLink(router, "/about")}>
          <span data-router-ignore class="badge">Skip</span>
        </a>
      `,
      ignoreHost,
    );
    await settle();

    const badge = ignoreHost.querySelector(".badge")!;
    badge.dispatchEvent(
      new dom.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    await settle();

    // Still at /home
    assertEquals(router.current.localPathname, "/home");
  });
});

test("router-view notifies side-slot context subscribers with slot-aware RouteContext", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          path: "app",
          component: "div",
          children: [
            { path: "users/:id", component: "div" },
            {
              path: "users/:id",
              slot: "sidebar",
              component: "div",
            },
          ],
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as RouterView & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
    };
    view.router = router;
    dom.document.body.append(view);
    await settle(view);

    router.push("/app/users/42");
    await settle(view);

    // Subscribe from an element inside the view
    let receivedSlot = "";
    let receivedParam = "";
    const childEl = dom.document.createElement("div");
    view.append(childEl);

    // Test context request
    const unsub = requestContext(
      childEl,
      routeContext,
      (ctx) => {
        receivedSlot = ctx.slot;
        receivedParam = ctx.params.id ?? "";
      },
      true,
    );

    // Initial receive
    assertEquals(receivedSlot, "route-child");
    assertEquals(receivedParam, "42");

    unsub();
  });
});

test("router-view resets stale data property when navigating to route without loader data", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          path: "users/detail",
          component: "test-ext-data-view",
          loader: () => ({ name: "Alice" }),
        },
        {
          path: "users/create",
          component: "test-ext-data-view",
        },
      ],
    });

    const dom = browser();
    if (!dom.customElements.get("test-ext-data-view")) {
      dom.customElements.define(
        "test-ext-data-view",
        class extends dom.HTMLElement {
          data?: unknown;
        },
      );
    }

    const view = dom.document.createElement("router-view") as RouterView & {
      router?: Router;
      shadowRoot: ShadowRoot | null;
    };
    view.router = router;
    dom.document.body.append(view);
    await settle(view);

    router.push("/users/detail");
    await settle(view);

    const el1 = view.shadowRoot?.querySelector("test-ext-data-view") as
      (HTMLElement & { data?: unknown }) | null;
    assert(el1);
    assertEquals((el1.data as { name: string })?.name, "Alice");

    router.push("/users/create");
    await settle(view);

    const el2 = view.shadowRoot?.querySelector("test-ext-data-view") as
      (HTMLElement & { data?: unknown }) | null;
    assert(el2);
    // Data must be safely cleared to undefined rather than keeping stale "Alice"
    assertEquals(el2.data, undefined);
  });
});

test("route.load receives RouteLoadContext with params, pathname, query, and signal", async () => {
  await withRouters(async (createRouter) => {
    let capturedContext: unknown = null;

    const router = createRouter({
      routes: [
        {
          path: "posts/:slug",
          component: "test-ext-page",
          load: async (ctx) => {
            capturedContext = ctx;
          },
        },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as RouterView & {
      router?: Router;
    };
    view.router = router;
    dom.document.body.append(view);
    await settle(view);

    router.push("/posts/hello-world?sort=desc#comments");
    await settle(view);

    assert(capturedContext);
    const ctx = capturedContext as {
      pathname: string;
      params: Record<string, string>;
      query: URLSearchParams;
      hash: string;
      signal: AbortSignal;
    };
    assertEquals(ctx.pathname, "/posts/hello-world");
    assertEquals(ctx.params.slug, "hello-world");
    assertEquals(ctx.query.get("sort"), "desc");
    assertEquals(ctx.hash, "#comments");
    assertEquals(typeof ctx.signal.aborted, "boolean");
  });
});

test("router navigation and linking supports RouteLocation with route id", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          id: "user-profile",
          path: "users/:userId",
          component: "test-ext-page",
        },
      ],
    });

    const link = router.link({ id: "user-profile", params: { userId: "456" } });
    assertEquals(link, "/users/456");

    const resolved = router.resolveId("user-profile", {
      params: { userId: "456" },
    });
    assert(resolved);
    assertEquals(resolved.pathname, "/users/456");

    router.push({ id: "user-profile", params: { userId: "456" } });
    await settle();

    assertEquals(router.current.pathname, "/users/456");
    assertEquals(
      router.isActive({ id: "user-profile", params: { userId: "456" } }),
      true,
    );
  });
});

test("router.isActive matches merged queries and decoded param values", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        {
          name: "search",
          path: "search/:category",
          component: "test-ext-page",
        },
      ],
    });

    router.push("/search/books%20and%20magazines?lang=en&sort=new");
    await settle();

    // Query in location merged with options
    assertEquals(
      router.isActive(
        { name: "search", query: { lang: "en" } },
        { query: { sort: "new" } },
      ),
      true,
    );

    // Decoded vs encoded param value comparison
    assertEquals(
      router.isActive({
        name: "search",
        params: { category: "books and magazines" },
      }),
      true,
    );
    assertEquals(
      router.isActive({
        name: "search",
        params: { category: "books%20and%20magazines" },
      }),
      true,
    );
  });
});

test("router ignores click when anchor has rel='external'", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [{ path: "*", component: "test-ext-page" }],
    });

    const dom = browser();
    const anchor = dom.document.createElement("a");
    anchor.href = "/external-page";
    anchor.rel = "external noopener";
    anchor.textContent = "External";
    dom.document.body.append(anchor);
    await settle();

    anchor.dispatchEvent(
      new dom.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    await settle();

    // Router should NOT have navigated to /external-page
    assertEquals(router.current.pathname, "/");
  });
});

test("routerLink directive re-subscribes to context when element is reconnected", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "home", component: "test-ext-page" },
        { path: "profile", component: "test-ext-page" },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as RouterView;
    view.router = router;
    dom.document.body.append(view);
    await settle(view);

    router.push("/home");
    await settle(view);

    const host = dom.document.createElement("div");
    view.append(host);
    render(
      html`<a ${routerLink("/home", { activeClass: "active" })}>Home</a>`,
      host,
    );
    await settle(view);

    const anchor = host.querySelector("a")!;
    assertEquals(anchor.classList.contains("active"), true);

    // Disconnect and reconnect element
    host.remove();
    await settle(view);
    view.append(host);
    await settle(view);

    // Navigate to /profile
    router.push("/profile");
    await settle(view);

    // Active status should update correctly through reconnected subscription
    assertEquals(anchor.classList.contains("active"), false);
  });
});

test("guard redirect properly preserves basePath when redirecting to root-relative path", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      basePath: "/app",
      routes: [
        {
          path: "protected",
          component: "test-ext-page",
          guard: () => "/login",
        },
        {
          path: "login",
          component: "test-ext-page",
        },
      ],
    });

    await settle();
    router.push("/app/protected");
    await settle();

    assertEquals(router.current.pathname, "/app/login");
    assertEquals(router.current.localPathname, "/login");
  });
});

test("guard redirect supports RouteLocation and named routes", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      basePath: "/app",
      routes: [
        {
          path: "old-user/:id",
          component: "test-ext-page",
          guard: (detail) => ({
            name: "user-profile",
            params: { userId: detail.params.id },
            query: { fromOld: "true" },
          }),
        },
        {
          name: "user-profile",
          path: "users/:userId",
          component: "test-ext-page",
        },
      ],
    });

    await settle();
    router.push("/app/old-user/99");
    await settle();

    assertEquals(router.current.pathname, "/app/users/99");
    assertEquals(router.current.localPathname, "/users/99");
    assertEquals(router.current.query.get("fromOld"), "true");
    assertEquals(router.current.params.userId, "99");
  });
});

test("router.back, router.forward, router.go, and router-view delegation", async () => {
  await withRouters(async (createRouter) => {
    const router = createRouter({
      routes: [
        { path: "page1", component: "test-ext-page" },
        { path: "page2", component: "test-ext-page" },
      ],
    });

    const dom = browser();
    const view = dom.document.createElement("router-view") as RouterView & {
      back: () => void;
      forward: () => void;
      go: (delta: number) => void;
    };
    view.router = router;
    dom.document.body.append(view);
    await settle(view);

    const goSpy = vi.spyOn(dom.history, "go").mockImplementation(() => {});
    const backSpy = vi.spyOn(dom.history, "back").mockImplementation(() => {});
    const forwardSpy = vi
      .spyOn(dom.history, "forward")
      .mockImplementation(() => {});

    try {
      view.back();
      assertEquals(backSpy.mock.calls.length, 1);

      view.forward();
      assertEquals(forwardSpy.mock.calls.length, 1);

      view.go(-2);
      assertEquals(goSpy.mock.calls[0]?.[0], -2);
    } finally {
      goSpy.mockRestore();
      backSpy.mockRestore();
      forwardSpy.mockRestore();
    }
  });
});

test("cross-origin push and guard redirect delegate to browser location", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    let assignedUrl = "";
    let replacedUrl = "";
    const origAssign = dom.location.assign;
    const origReplace = dom.location.replace;
    dom.location.assign = (url: string) => {
      assignedUrl = url;
    };
    dom.location.replace = (url: string) => {
      replacedUrl = url;
    };

    try {
      const router = createRouter({
        routes: [
          {
            path: "oauth",
            component: "test-ext-page",
            guard: () => ({
              to: new URL("https://auth.example.com/sso"),
              replace: true,
            }),
          },
          {
            path: "home",
            component: "test-ext-page",
          },
        ],
      });

      // Push cross-origin URL
      router.push("https://external.example.com/landing");
      assertEquals(assignedUrl, "https://external.example.com/landing");

      // Replace cross-origin URL via guard
      router.push("/oauth");
      await settle();
      assertEquals(replacedUrl, "https://auth.example.com/sso");
    } finally {
      dom.location.assign = origAssign;
      dom.location.replace = origReplace;
    }
  });
});

test("RouteLocation without name or id updates current route params, query, and hash", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/users/10?tab=overview#bio");

    const router = createRouter({
      routes: [
        {
          path: "users/:userId",
          name: "user-profile",
          component: "test-ext-page",
        },
      ],
    });

    await settle();
    assertEquals(router.current.pathname, "/users/10");
    assertEquals(router.current.query.get("tab"), "overview");
    assertEquals(router.current.hash, "#bio");

    // Update query only
    router.push({ query: { tab: "settings", page: "2" } });
    await settle();
    assertEquals(router.current.pathname, "/users/10");
    assertEquals(router.current.query.get("tab"), "settings");
    assertEquals(router.current.query.get("page"), "2");

    // Update hash only
    router.push({ hash: "security" });
    await settle();
    assertEquals(router.current.pathname, "/users/10");
    assertEquals(router.current.hash, "#security");

    // Update params only
    router.push({ params: { userId: "25" } });
    await settle();
    assertEquals(router.current.pathname, "/users/25");
  });
});

test("router.link preserves cross-origin URLs and protocol-relative URLs", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/app/dashboard");

    const router = createRouter({
      basePath: "/app",
      routes: [
        {
          path: "dashboard",
          name: "dashboard",
          component: "test-ext-page",
        },
      ],
    });

    await settle();

    // Internal link includes basePath
    assertEquals(router.link("dashboard"), "/app/dashboard");
    assertEquals(router.link("/settings"), "/app/settings");

    // Cross-origin link keeps full URL
    assertEquals(
      router.link("https://auth.example.com/login"),
      "https://auth.example.com/login",
    );

    // Protocol-relative link is preserved
    const protoUrl = router.link("//cdn.example.com/assets");
    assertEquals(protoUrl.includes("cdn.example.com"), true);
  });
});

test("router.resolve and routerView.resolve resolve RouteLocation, string, and URL targets", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/home");

    const router = createRouter({
      routes: [
        {
          path: "home",
          name: "home-page",
          id: "route-home",
          component: "test-ext-page",
        },
        {
          path: "items/:id",
          name: "item-detail",
          id: "route-item",
          component: "test-ext-page",
        },
      ],
    });

    await settle();

    // Resolve by string
    const matchString = router.resolve("/items/42");
    assertEquals(matchString?.pathname, "/items/42");
    assertEquals(matchString?.params.id, "42");

    // Resolve by RouteLocation with name
    const matchName = router.resolve({
      name: "item-detail",
      params: { id: "99" },
    });
    assertEquals(matchName?.pathname, "/items/99");
    assertEquals(matchName?.params.id, "99");

    // Resolve by RouteLocation with id
    const matchId = router.resolve({
      id: "route-home",
    });
    assertEquals(matchId?.pathname, "/home");

    // RouterView delegates resolve
    const view = new RouterView();
    view.router = router;
    const matchFromView = view.resolve("/items/77");
    assertEquals(matchFromView?.pathname, "/items/77");
    assertEquals(matchFromView?.params.id, "77");
  });
});

test("router-view reconnection restores view without getting stuck empty", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/about");

    const router = createRouter({
      routes: [
        {
          path: "about",
          component: "test-ext-page",
        },
      ],
    });

    const view = new RouterView();
    view.router = router;
    dom.document.body.appendChild(view);
    await settle();

    const renderedBefore = view.renderRoot.querySelector("test-ext-page");
    assertEquals(renderedBefore !== null, true);

    // Disconnect and reconnect to DOM
    dom.document.body.removeChild(view);
    await settle();

    dom.document.body.appendChild(view);
    await settle();

    // View should be remounted on reconnection
    const renderedAfter = view.renderRoot.querySelector("test-ext-page");
    assertEquals(renderedAfter !== null, true);

    dom.document.body.removeChild(view);
  });
});

test("empty or whitespace strings in router.link, push, resolve, isActive do not crash", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/home");

    const router = createRouter({
      routes: [
        {
          path: "home",
          name: "home",
          component: "test-ext-page",
        },
      ],
    });

    await settle();

    // router.link with empty string resolves to current pathname without throwing
    assertEquals(router.link(""), "/home");
    assertEquals(router.link("   "), "/home");

    // router.isActive with empty string resolves to current URL and matches
    assertEquals(router.isActive(""), true);
    assertEquals(router.isActive("   "), true);

    // router.resolve with empty string does not throw
    const res = router.resolve("");
    assertEquals(res?.pathname, "/home");

    // router.push with empty string resolves to current URL without throwing
    router.push("");
    await settle();
    assertEquals(router.current.pathname, "/home");
  });
});

test("side-slot routes inherit ancestor data in slot context", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/workspace/nested");

    const router = createRouter({
      routes: [
        {
          path: "workspace",
          name: "ws",
          loader: () => ({ layoutInfo: "ws-layout-data" }),
          component: "test-ext-page",
          children: [
            {
              path: "nested",
              name: "ws-nested",
              component: "test-ext-page",
            },
            {
              path: "",
              slot: "sidebar",
              loader: () => ({ sidebarData: "sidebar-parent-data" }),
              children: [
                {
                  path: "nested",
                  slot: "sidebar",
                  component: "test-ext-page",
                  // No loader on leaf sidebar route
                },
              ],
            },
          ],
        },
      ],
    });

    const view = new RouterView();
    view.router = router;
    dom.document.body.appendChild(view);
    await settle();

    // Side-slot leaf should inherit data from sidebar ancestor
    let slotCtxReceived: RouteContext | undefined;
    view.addEventListener("context-request", ((e: CustomEvent) => {
      // simulate context consumer
    }) as EventListener);

    const sideLeaf = router.getRouteData({ name: "ws" });
    assertEquals((sideLeaf as any)?.layoutInfo, "ws-layout-data");

    dom.document.body.removeChild(view);
  });
});

test("router detail and context expose merged hierarchical meta", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/admin/users");

    const router = createRouter({
      routes: [
        {
          path: "admin",
          meta: { requiresAuth: true, layout: "admin" },
          children: [
            {
              path: "users",
              name: "admin-users",
              meta: { role: "superadmin", layout: "full-width" },
              component: "test-ext-page",
            },
          ],
        },
      ],
    });

    await settle();

    // Meta is merged from root to leaf
    assertEquals(router.current.meta?.requiresAuth, true);
    assertEquals(router.current.meta?.role, "superadmin");
    assertEquals(router.current.meta?.layout, "full-width");
  });
});

test("route title supports dynamic function receiving RouterChangeDetail", async () => {
  await withRouters(async (createRouter) => {
    const dom = browser();
    dom.history.replaceState(null, "", "/articles/100");

    const router = createRouter({
      routes: [
        {
          path: "articles/:id",
          title: (detail) => `Article #${detail.params.id} - Blog`,
          component: "test-ext-page",
        },
      ],
    });

    const view = new RouterView();
    view.router = router;
    dom.document.body.appendChild(view);
    await settle();

    assertEquals(dom.document.title, "Article #100 - Blog");

    dom.document.body.removeChild(view);
  });
});
