# API 参考

本文档描述 `@elelcode/lit-router` 当前公开导出的 API。v1 到 v2 的破坏性变更见
[v2 Migration Guide](./migration-v2.md)。

使用时通常要同时引入类 API 和自定义元素注册：

```ts
import { Router } from "@elelcode/lit-router";
import "@elelcode/lit-router";
```

## 导出项

```ts
import {
  activeRoute,
  type ActiveRouteDirectiveOptions,
  type Context,
  type ContextCallback,
  type ContextRequest,
  type ContextRequestEvent,
  contextRequestEventName,
  DEFAULT_CHILD_SLOT,
  type NavigationDirection,
  type ReadonlyRouteDefinition,
  requestContext,
  routeContext,
  type RouteComponentFactory,
  type RouteContext,
  type RouteContextReceiver,
  type RouteDefinition,
  type RouteErrorDetail,
  type RouteGuard,
  type RouteGuardRedirect,
  type RouteGuardResult,
  type RouteInsertOptions,
  type RouteIsActiveOptions,
  type RouteLeaveGuard,
  routerContext,
  routerLink,
  type RouterLinkDirectiveOptions,
  type RouteLoadContext,
  type RouteLoader,
  type RouteLoadingDetail,
  type RouteLocation,
  type RouteMeta,
  type RouteNotFoundDetail,
  type RouteParamsInput,
  type RouteParamValue,
  type RouteQueryInit,
  type RouteQueryValue,
  Router,
  type RouterChangeDetail,
  type RouterChangeDetailJson,
  type RouteResolveOptions,
  type RouterEvent,
  type RouterEventListener,
  type RouterEventMap,
  type RouterLinkAttributes,
  type RouterLinkOptions,
  type RouterOptions,
  type RouterSlotDetail,
  type RouterSlotDetailJson,
  RouterView,
  type RouteSelector,
  type RouteTarget,
  type RouteTreeChangeDetail,
  type UnknownContext,
} from "@elelcode/lit-router";
```

## Router

### `new Router(options?)`

创建路由实例。除非显式传入 `options.autoStart === false`，否则构造后会立即启动。

```ts
const router = new Router({
  basePath: "/app",
  routes: [
    { path: "", name: "home", component: "home-page" },
    { path: "settings", name: "settings", component: "settings-page" },
  ],
});
```

构造参数对象：

- `routes?: RouteDefinition[]`
- `basePath?: string`
- `beforeRoute?: RouteGuard`
- `autoStart?: boolean`

说明：

- `basePath` 默认是 `"/"`
- 路由要求浏览器提供 Navigation API
- 路由状态只从 Navigation API 的 `navigate` 事件提交；不会以 `popstate`、
  `hashchange` 或直接 History API mutation 作为 fallback 路由路径
- 同一个 document 内只允许同时启动一个 `Router`
- 运行时更新配置建议统一走 `configure()`

### 属性

#### `router.current: RouterChangeDetail`

最近一次已提交的路由状态。应把它当作只读状态使用。

#### `router.routes: readonly ReadonlyRouteDefinition[]`

获取当前冻结的只读路由树快照。

直接赋值 `router.routes = [...]` 会整体替换路由树，并触发一次重新匹配。

#### `router.cloneRoutes(): RouteDefinition[]`

返回当前路由树的可变克隆快照。

#### `router.basePath: string`

当前 `basePath`。如果要在运行时修改，建议使用
`configure({ basePath })`，这样会立即刷新当前 URL。

#### `router.beforeRoute?: RouteGuard`

当前全局进入守卫。运行时修改也建议使用 `configure({ beforeRoute })`。

#### `router.lastError?: RouteErrorDetail`

最近一次路由错误详情。

#### `router.lastNotFound?: RouteNotFoundDetail`

最近一次 404 详情。

### 方法

#### `router.start(): void`

开始接管浏览器导航，并解析当前 URL。

以下情况会抛错：

- 浏览器没有 `URLPattern`
- 当前 document 里已有其他已启动的 `Router`

#### `router.stop(): void`

停止接管浏览器事件，并让当前未完成的导航失效。

#### `router.configure(options): void`

一次性更新一个或多个配置，并对当前 URL 只做一次刷新。

```ts
router.configure({
  basePath: "/workspace",
  beforeRoute: authGuard,
  routes,
});
```

支持字段：

- `routes`
- `basePath`
- `beforeRoute`

#### `router.setRoutes(routes): void`

整体替换整棵路由树。

如果只是按权限、插件、功能开关增删局部分支，优先使用 `insertRoutes()` /
`removeRoute()`。

#### `router.insertRoutes(routes, options?): void`

运行时插入一个或多个路由定义。

```ts
router.insertRoutes([
  { path: "reports", id: "reports-plugin", component: "reports-page" },
]);

router.insertRoutes(
  [{ path: "audit", id: "settings-audit", component: "audit-page" }],
  {
    parentId: "settings-shell",
    index: 1,
  },
);
```

`RouteInsertOptions`：

- `parentId?: string`
- `parentName?: string`
- `index?: number`

规则：

- `parentId` 和 `parentName` 只能二选一
- 重复的 `id` 或重复的 `name` 会直接报错
- 动态插入子路由时，父组件仍然必须暴露对应的命名 `slot`
- 插入完成后，路由器会立刻用当前 URL 重新匹配

#### `router.removeRoute(selector): boolean`

按 `name` 或按选择器对象删除一个运行时路由分支。

```ts
router.removeRoute("reports");
router.removeRoute({ id: "reports-plugin" });
```

`selector` 可取：

- `string`：按路由 `name`
- `RouteSelector`：`{ id?: string; name?: string }`

找到并删除时返回 `true`，否则返回 `false`。

#### `router.batchRouteUpdates(update): void`

把多次路由树修改合并成一次刷新。

```ts
router.batchRouteUpdates(() => {
  router.insertRoutes([
    {
      path: "alpha",
      name: "alpha",
      component: "alpha-page",
    },
  ]);
  router.insertRoutes([{ path: "beta", name: "beta", component: "beta-page" }]);
});
```

规则：

- 回调必须保持同步
- 回调抛错时，整批修改会回滚
- 成功提交时只会派发一次 `route-tree-change`，且 `reason` 为 `"batch"`

#### `router.push(url): void`

以 push 语义导航。

可接受参数：

- `string`
- `URL`
- `RouteLocation`

#### `router.replace(url): void`

以 replace 语义导航。

参数类型与 `push()` 相同。

#### `router.resolveUrl(url): RouterChangeDetail | null`

在不导航的情况下解析字符串或 `URL`。当 URL 不在 `basePath`
内，或没有命中任何路由分支时返回 `null`。

```ts
const match = router.resolveUrl("/settings/profile");
```

#### `router.resolveNamed(name, options?): RouterChangeDetail | null`

先生成命名路由 URL，再在不导航的情况下解析。

```ts
const match = router.resolveNamed("message", {
  params: { id: "42" },
  query: { tab: "activity" },
});
```

#### `router.link(location): string`

基于命名路由生成应用内 href。

```ts
const href = router.link({
  name: "message",
  params: { id: "42" },
  query: { tab: "activity" },
  hash: "summary",
});
```

说明：

- 依赖路由 `name`
- 支持字面量片段、`:param`、`:param(<pattern>)`、`*`，以及 `:lang?/docs`
  这类可选 `?` 片段
- 路径里如果出现 `+` 或 `*` 参数修饰符，反向生成时会直接抛错

#### `router.linkAttributes(location, options?): RouterLinkAttributes`

基于命名路由生成 `<a>` 属性。通过 JavaScript 创建需要 replace 语义的链接时使用。

```ts
const attrs = router.linkAttributes(
  { name: "message", params: { id: "42" } },
  { replace: true },
);
// { href: "/messages/42", "data-router-replace": "" }
```

`#section` 这类普通文档片段不会被路由接管。

#### `router.isActive(target, options?): boolean`

检测目标路由是否处于激活状态。支持路径前缀匹配、精确全路径匹配、具名路由名称、RouteSelector（按 `id` 查找）、动态参数（params）、查询参数（query）及哈希片段（hash）。

```ts
// 路径前缀匹配：/users、/users/42 等均返回 true
router.isActive("/users");

// 精确全路径匹配：仅 /users 时返回 true
router.isActive("/users", { exact: true });

// 具名路由匹配
router.isActive("user-detail");

// 按路由配置的 id 匹配
router.isActive({ id: "user-profile-id" });

// 包含参数、查询参数与哈希的完整匹配
router.isActive({
  name: "user-detail",
  params: { id: "42" },
  query: { tab: "activity" },
  hash: "timeline",
});

// 或者将 query/hash 传给 options
router.isActive("/users/42", {
  query: { tab: "activity" },
  hash: "timeline",
});
```

`options` 选项说明：

- `exact?: boolean`：是否要求精确匹配而非前缀匹配。
- `params?: Record<string, RouteParamValue>`：要求当前路由参数匹配。
- `query?: RouteQueryInit`：要求当前 URL 查询参数匹配。
- `hash?: string`：要求当前 URL 哈希片段匹配。

#### `router.registerLeaveGuard(guard): () => void`

动态注册一个全局或临时离开守卫。当用户尝试离开当前路由分支时触发。若守卫返回 `false` 或 Promise 决议为 `false`，导航将被拦截，浏览器地址栏与历史记录将自动回退。

调用返回值函数即可注销该守卫。

```ts
const unregister = router.registerLeaveGuard((detail) => {
  if (hasUnsavedChanges) {
    return confirm("页面有未保存的内容，确认离开吗？");
  }
  return true;
});

// 完成后注销：
unregister();
```

#### `router.getRouteData<T>(selector?): T | undefined`

获取由路由 `loader` 预取加载的数据。若省略 `selector`，默认返回当前激活的叶子路由预取数据。若提供 `selector`（路由名称或 `RouteSelector`），则返回对应具体路由分支的数据。

```ts
// 获取当前叶子路由预取数据
const userData = router.getRouteData<UserData>();

// 获取指定父级布局路由预取数据
const shellData = router.getRouteData<ShellData>("settings-shell");
```

### 事件

监听对象是 `Router` 实例本身：

```ts
router.addEventListener("route-change", (event) => {
  console.log(event.detail.localPathname);
});
```

`Router.addEventListener()`
对内置路由事件名提供类型重载，已知事件可以直接获得对应的 `CustomEvent.detail`
类型，不需要在本地手动断言。

导出的辅助类型包括：

```ts
interface RouterEventMap {
  "route-change": RouterChangeDetail;
  "route-error": RouteErrorDetail;
  "route-loading-start": RouteLoadingDetail;
  "route-loading-end": RouteLoadingDetail;
  "route-not-found": RouteNotFoundDetail;
  "route-tree-change": RouteTreeChangeDetail;
}

type RouterEvent<K extends keyof RouterEventMap> = CustomEvent<
  RouterEventMap[K]
>;
type RouterEventListener<K extends keyof RouterEventMap> = (
  this: Router,
  event: RouterEvent<K>,
) => void;
```

#### `route-change`

详情类型：`RouterChangeDetail`

在路由器完成 URL / current 状态提交后触发。

#### `route-tree-change`

详情类型：`RouteTreeChangeDetail`

运行时路由树发生变化后触发。

`reason` 取值：

- `"replace"`
- `"insert"`
- `"remove"`
- `"batch"`

`routeCount` 表示路由定义总数。`routes` 与 `router.routes`
暴露的是同一个冻结只读快照。

#### `route-loading-start`

详情类型：`RouteLoadingDetail`

分支进入懒加载前触发。

#### `route-loading-end`

详情类型：`RouteLoadingDetail`

分支结束懒加载后触发，即使这次加载最终失败也会触发。

#### `route-error`

详情类型：`RouteErrorDetail`

导航在以下阶段失败时触发：

- 守卫
- 懒加载
- 视图 commit
- 其他内部错误，记为 `"unknown"`

#### `route-not-found`

详情类型：`RouteNotFoundDetail`

当前 URL 位于 `basePath` 内，但没有任何路由命中时触发。

## `<router-view>`

`<router-view>` 是 `Router` 的渲染出口。

```html
<router-view></router-view>
```

### 注册

通过副作用导入注册元素：

```ts
import "@elelcode/lit-router";
```

### 属性与 attribute

#### `.router: Router | undefined`

把路由实例挂到当前 outlet 上。

```ts
const outlet = document.querySelector("router-view")!;
outlet.router = router;
```

如果传入的路由尚未启动，outlet 会自动调用 `start()`。

#### `child-slot="route-child"`

配置嵌套路由的子出口 slot 名。

默认值是 `DEFAULT_CHILD_SLOT`，即 `"route-child"`。

如果某个路由声明了 `children`，父组件必须提供匹配的 slot：

```html
<slot name="route-child"></slot>
```

#### `no-view-transition`

关闭当前 outlet 的 View Transitions。

#### `routerView.current: RouterChangeDetail`

当前 outlet 最近一次已完成 commit 的路由详情。

### 方法

#### `routerView.push(url): void`

对 `router.push(url)` 的透传。

#### `routerView.replace(url): void`

对 `router.replace(url)` 的透传。

### 事件

如果你关心的是 DOM 真正挂载完成后的时机，而不是路由器状态提交本身，就监听
`<router-view>`：

```ts
outlet.addEventListener("route-change", (event) => {
  console.log("DOM committed", event.detail.pathname);
});
```

#### `route-change`

详情类型：`RouterChangeDetail`

该事件会在以下流程全部完成后触发：

- 页面分支挂载
- 滚动恢复
- 焦点移动

它晚于 `Router` 实例上的 `route-change`。

#### `route-error`

详情类型：`RouteErrorDetail`

当前 outlet 自身 commit 失败，或它所挂载的 `Router` 进入错误状态时触发。

#### `route-not-found`

详情类型：`RouteNotFoundDetail`

当前 outlet 所挂载的 `Router` 进入 404 状态时触发。

### fallback slot

你可以用 light DOM slot 覆盖内建兜底视图：

```html
<router-view>
  <not-found-page slot="404"></not-found-page>
  <route-error-page slot="error"></route-error-page>
</router-view>
```

可用 slot：

- `slot="404"`
- `slot="error"`

### Host data attribute

outlet host 会反映导航方向：

- `data-transition-direction="forward"`
- `data-transition-direction="backward"`
- `data-transition-direction="none"`

可直接拿来写方向感知的 View Transition CSS。

### 焦点与滚动行为

成功 commit 后：

- 优先聚焦 `[data-route-focus]`
- 找不到时回退到聚焦 viewport 自身
- 滚动恢复绑定在 Navigation API entry 上，而不是单纯的 URL
- hash 锚点只通过 `document.getElementById()` 查找

如果锚点在组件的 shadow tree 里，请把同样的 `id` 暴露到 host 上，保持 O(1)
查找。

## RouteDefinition

```ts
interface RouteDefinition {
  id?: string;
  name?: string;
  path: string;
  slot?: string;
  title?: string;
  viewTransitionName?: string;
  component?: string | RouteComponentFactory;
  children?: RouteDefinition[];
  guard?: RouteGuard;
  beforeLeave?: RouteLeaveGuard;
  load?: (context?: RouteLoadContext) => Promise<unknown>;
  meta?: RouteMeta;
  props?: Record<string, unknown>;
}
```

字段说明：

- `id`：运行时树管理标识，用于插入、删除、替换分支
- `name`：路由名，供 `push({ name })`、`replace({ name })`、`link()` 使用
- `path`：路径片段。`""` 表示 index，`"*"` 表示兜底
- `slot`：当前路由投影到父组件内的 slot 名，默认是 `"route-child"`。 `"404"` 和
  `"error"` 是 `<router-view>` fallback 保留名
- `title`：文档标题模板，commit 时会展开 `:param`
- `viewTransitionName`：当前路由作为叶子路由时，`<router-view>` 使用的
  `view-transition-name`
- `component`：自定义元素标签名，或返回 `HTMLElement` 的工厂函数
- `children`：嵌套路由树，通过命名 slot 渲染
- `guard`：进入守卫
- `beforeLeave`：离开当前分支该段路由时触发的守卫
- `load`：首次进入时的异步加载器。Promise
  返回值会被忽略，只用于代码分割或副作用；会收到 `{ signal }` 以便取消
- `meta`：供守卫、事件和路由上下文读取的路由元数据。输入时会浅克隆，只读快照中会浅冻结，不会赋值到渲染出的
  DOM 元素上
- `props`：通过浅层 `Object.assign` 额外赋值到组件实例上的属性

匹配语义：

- 路由会在编译阶段做 specificity 排序
- 静态片段优先于参数片段
- 参数片段优先于兜底通配
- 不再依赖声明顺序规避拦截错误

## 导航与守卫类型

### `RouteLocation`

```ts
interface RouteLocation {
  name: string;
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}
```

### `RouteResolveOptions`

```ts
interface RouteResolveOptions {
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}
```

### `RouterLinkOptions` / `RouterLinkAttributes`

```ts
interface RouterLinkOptions {
  replace?: boolean;
}

interface RouterLinkAttributes {
  href: string;
  "data-router-replace"?: "";
}
```

### `RouteGuardRedirect` / `RouteGuardResult`

进入守卫和离开守卫都可以返回：

- `true`
- `undefined`
- `false`
- `string`
- `URL`
- `{ to: string | URL; replace?: boolean }`

语义：

- `true` 或 `undefined`：放行
- `false`：阻止导航
- 重定向值：立即重定向

```ts
type RouteGuardRedirect =
  string | URL | { to: string | URL; replace?: boolean };

type RouteGuardResult = boolean | void | RouteGuardRedirect;
```

### `RouteGuard`

```ts
type RouteGuard = (
  detail: RouterChangeDetail & {
    from: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  },
) =>
  | boolean
  | void
  | string
  | URL
  | { to: string | URL; replace?: boolean }
  | Promise<
      boolean | void | string | URL | { to: string | URL; replace?: boolean }
    >;
```

执行顺序：

- 全局 `beforeRoute`
- 命中分支上的 `guard`，从父到子
- 每个 guard 都会收到导航 `signal`，当更新的导航取代它时会被 abort

### `RouteLeaveGuard`

```ts
type RouteLeaveGuard = (
  detail: RouterChangeDetail & {
    to: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  },
) =>
  | boolean
  | void
  | string
  | URL
  | { to: string | URL; replace?: boolean }
  | Promise<
      boolean | void | string | URL | { to: string | URL; replace?: boolean }
    >;
```

执行顺序：

- 只作用于即将被卸载的那段后缀分支
- 从叶子往回执行，直到共享父级边界

### `RouteLoadContext`

```ts
interface RouteLoadContext {
  signal: AbortSignal;
  router: Router;
  pathname: string;
  localPathname: string;
  params: Record<string, string>;
  query: URLSearchParams;
  hash: string;
  url: URL;
}
```

`load()` 与 `loader` 可以使用 `signal` 在更新的导航取代当前导航时取消自己的异步工作。

### `RouteLoader<TData>`

```ts
type RouteLoader<TData = unknown> = (
  context: RouteLoadContext,
) => Promise<TData> | TData;
```

配置于 `RouteDefinition.loader`。在导航进入时与组件异步加载并发执行。预取的数据可直接通过 `router.current.data`、`router.getRouteData()`、`routeContext.data` 及 `element.data` 消费。

## RouteContext 协议

路由组件应该暴露以下契约之一：

```ts
@property({ attribute: false })
accessor routeContext: RouteContext | undefined;
```

或者：

```ts
setRouteContext(context: RouteContext): void
```

`RouteContext`：

```ts
interface RouteContext {
  detail: RouterChangeDetail;
  params: Record<string, string>;
  slot: string;
  branch: RouteDefinition[];
  data?: unknown;
}
```

其中 `detail.query` 是 `URLSearchParams`。`slot` 表示当前组件被投影到的
slot，`branch` 表示该 slot 对应的匹配分支。`data` 包含当前路由 `loader` 预取的数据。

若所渲染的组件类声明了 `data` 属性，`<router-view>` 也会自动将其同步为 `element.data = context.data`。

### 组件级离开守卫契约 (`beforeRouteLeave`)

挂载在 `<router-view>` 中的任意自定义元素均可实现 `beforeRouteLeave` 方法：

```ts
class EditForm extends LitElement {
  hasUnsavedChanges = true;

  beforeRouteLeave(detail: {
    to: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  }): boolean | Promise<boolean> {
    if (this.hasUnsavedChanges) {
      return confirm("表单有未保存的更改，确认放弃并离开吗？");
    }
    return true;
  }
}
```

当发生切页离开时，`<router-view>` 自动探测即将卸载的分支上的组件是否有 `beforeRouteLeave` 钩子。返回 `false` 即可中断导航并恢复地址栏。

## 声明式模板指令

`@elelcode/lit-router` 为 Lit 模板提供了现代、轻量、高可用的声明式指令：

### `routerLink(targetOrRouter, targetOrOptions?, options?)`

直接作用于 `<a>` 标签。自动管理 `href`、链接点击拦截（兼容 Ctrl/Cmd 新标签页、外部链接及下载链接）、激活样式类切换与 `aria-current="page"`。

```ts
import { html, LitElement } from "lit";
import { routerLink } from "@elelcode/lit-router";

// 在 <router-view> 树内部使用时，通过上下文协议自动解析 router 实例：
html`
  <a ${routerLink("/users")}>用户列表</a>
  <a ${routerLink("/users/42", { activeClass: "active", exact: true })}
    >用户 42</a
  >
  <a ${routerLink({ name: "settings", query: { tab: "profile" } })}>设置</a>
`;

// 显式传入 router 实例：
html`
  <a ${routerLink(router, "/dashboard", { activeClass: "nav-active" })}>
    控制台
  </a>
`;
```

`RouterLinkDirectiveOptions` 选项：

- `activeClass?: string`：目标路由激活时添加的 CSS 类名（默认 `"active"`）。
- `exact?: boolean`：是否要求精确匹配。
- `replace?: boolean`：使用替换模式（replaceState）导航。
- `ariaCurrent?: string`：激活时设置的 `aria-current` 属性值（默认 `"page"`）。
- `params?: Record<string, RouteParamValue>`：具名路由的路径参数。
- `query?: RouteQueryInit`：查询参数。
- `hash?: string`：哈希片段。

### `activeRoute(targetOrRouter, targetOrOptions?, options?)`

直接作用于任意 HTML 元素（如 `<li>`、`<button>` 或 `<div>`）以感知路由激活状态，并自动同步 `activeClass` 与 `aria-current`。

```ts
import { activeRoute } from "@elelcode/lit-router";

html`
  <li ${activeRoute("/dashboard", { activeClass: "tab-active" })}>
    <a href="/dashboard">控制台</a>
  </li>
`;
```

## W3C Context 协议支持

`@elelcode/lit-router` 原生遵循 [W3C Community Group Context Protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md)，**零运行时外部依赖**，与 `@lit/context` 及原生 Web Components 生态 100% 协议互通。

### 导出标识符

- `routerContext`：当前全局 `Router` 实例上下文。
- `routeContext`：当前激活分支的 `RouteContext` 上下文。

### 配合 `@lit/context` 使用

```ts
import { LitElement, html } from "lit";
import { consume } from "@lit/context";
import {
  routerContext,
  routeContext,
  type Router,
  type RouteContext,
} from "@elelcode/lit-router";

class MyDeepChildComponent extends LitElement {
  @consume({ context: routerContext, subscribe: true })
  router?: Router;

  @consume({ context: routeContext, subscribe: true })
  route?: RouteContext;

  render() {
    return html`
      <p>当前路径: ${this.route?.detail.localPathname}</p>
      <button @click=${() => this.router?.push("/")}>回到首页</button>
    `;
  }
}
```

### 脱离 `@lit/context` 使用 (`requestContext`)

```ts
import { requestContext, routerContext } from "@elelcode/lit-router";

// 在 <router-view> 树下的任意 DOM 元素中：
const unsubscribe = requestContext(
  element,
  routerContext,
  (router) => {
    console.log("获取到 Router 实例:", router);
  },
  true /* 响应后续变化订阅 */,
);
```

## 事件详情类型

### `RouterChangeDetail`

```ts
interface RouterChangeDetail {
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
  slots?: Record<
    string,
    {
      branch: RouteDefinition[];
      leaf?: RouteDefinition;
      params: Record<string, string>;
    }
  >;
  url: URL;
  navigationKey: string;
  direction: "forward" | "backward" | "none";
  data?: unknown;
  routeData?: Map<RouteDefinition, unknown>;
  toJSON?: () => RouterChangeDetailJson;
}
```

字段补充：

- `pathname`：浏览器完整 pathname
- `localPathname`：相对 `basePath` 的本地 pathname
- `branch`：从根到叶的命中分支
- `leaf`：命中的叶子路由
- `data`：叶子路由 `loader` 预取加载的数据（若有）
- `routeData`：匹配分支中所有路由预取数据的映射表
- `slotBranches`：非主 slot 的命中分支，按 slot 名索引
- `slotParams`：每条非主 slot 分支对应的 params
- `slots`：包含主 `"route-child"` slot 在内的 slot 详情索引
- `toJSON`：把 `query` 序列化成 plain object、把 `url` 序列化成字符串，供
  `JSON.stringify(detail)` 使用
- `navigationKey`：Navigation API entry 级别的方向与滚动跟踪键
- `direction`：当前导航方向

### `RouterSlotDetail`

```ts
interface RouterSlotDetail {
  branch: RouteDefinition[];
  leaf?: RouteDefinition;
  params: Record<string, string>;
}
```

### `RouteLoadingDetail`

```ts
interface RouteLoadingDetail {
  url: URL;
  branch: RouteDefinition[];
  loadingSlots?: string[];
  pending: number;
  direction: NavigationDirection;
}
```

`pending` 表示当前路由器里仍在进行中的懒加载数量。`loadingSlots`
表示本次导航中需要加载的 slot 名。

### `RouteErrorDetail`

```ts
interface RouteErrorDetail {
  url: URL;
  error: unknown;
  phase: "guard" | "load" | "commit" | "unknown";
  direction: NavigationDirection;
}
```

### `RouteNotFoundDetail`

```ts
interface RouteNotFoundDetail {
  url: URL;
  basePath: string;
  direction: NavigationDirection;
}
```

### `RouteTreeChangeDetail`

```ts
interface RouteTreeChangeDetail {
  reason: "replace" | "insert" | "remove" | "batch";
  routeCount: number;
  routes: readonly ReadonlyRouteDefinition[];
}
```

## 边界与约束

- 仅面向现代浏览器，依赖原生 `URLPattern`
- 设计目标是单 document SPA，不覆盖 SSR
- Navigation API 是唯一路由传输层；History API 和 hash 路由 fallback
  明确不在核心范围内
- 同源链接拦截只发生在配置的 `basePath` 内
- 异步懒加载与导航 commit 都做了竞态保护
- Navigation entry 方向缓存是有界的，不会无限增长
- 同一路由在 `load()` 未完成期间会复用同一个 pending Promise
