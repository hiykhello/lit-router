# lit-router 中文指南

## 定位

`@elelcode/lit-router` 是一个面向现代浏览器和 Web Components / Lit 的
客户端路由。

它的设计目标不是“兼容所有旧环境”，而是优先利用现代原生能力：

- `URLPattern`
- `Navigation API`
- `View Transitions API`
- 命名 `slot`
- Custom Elements / Lit

如果你的应用就是现代浏览器单 SPA，这套模型会比传统框架式路由更直接。

路由模型以 Navigation API 为唯一入口：监听 `navigate` 事件，在 Navigation API
接受跳转后提交路由状态，并使用 `navigation.currentEntry.key` 做 entry 级别的方向
与滚动状态跟踪。它不维护并行的 `popstate`、`hashchange` 或直接
`history.pushState()` 路由路径。

当前功能层面也支持运行时按分支插入、删除、替换 `route tree`，适合权限路由、
特性开关、插件式页面装配这类场景。

相关文档：

- 英文指南：[guide.md](./guide.md)
- 英文 API 参考：[api.md](./api.md)
- 中文 API 参考：[api.zh-CN.md](./api.zh-CN.md)
- v2 迁移指南：[migration-v2.md](./migration-v2.md)
- Slot 多出口设计：[slot-outlets-design.md](./slot-outlets-design.md)
- 变更日志：[CHANGELOG.md](../CHANGELOG.md)
- 完整示例：[examples/minimal/main.ts](../examples/minimal/main.ts)

## 安装

```bash
npm install @elelcode/lit-router lit
```

使用：

```ts
import { Router } from "@elelcode/lit-router";
import "@elelcode/lit-router";
```

## 最小用法

```ts
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

## Playground 示例

如果你想一次看全当前特性，直接看仓库里的 `examples/minimal/`。

它不是单纯的 hello world，而是一个压缩过的真实 playground，覆盖了：

- 懒加载与 `route-loading-start` / `route-loading-end`
- `beforeLeave` 阻断离开
- 运行时 `insertRoutes()` / `removeRoute()`
- `guard` 重定向
- `route-error` / `route-not-found` fallback slot
- `RouteContext`
- `router-view[data-transition-direction]`

关键文件：

- [examples/minimal/main.ts](../examples/minimal/main.ts)
- [examples/minimal/example-pages.ts](../examples/minimal/example-pages.ts)
- [examples/minimal/lazy-drafts.ts](../examples/minimal/lazy-drafts.ts)

### `examples/demo/` — 交互式 Demo

一个带有导航栏、状态面板、守卫 Lab 路由和动态模块加载的完整交互式 Demo。
在项目根目录运行：

```bash
npm run dev
```

关键文件：

- [examples/demo/app-root.ts](../examples/demo/app-root.ts)
- [examples/demo/demo-pages.ts](../examples/demo/demo-pages.ts)
- [examples/demo/lazy-drafts-panel.ts](../examples/demo/lazy-drafts-panel.ts)

## 核心概念

### 1. 路由树在 TypeScript 中声明

路由定义不依赖 HTML 里的 `data-route` 标记，而是直接由 `routes` 驱动。

常用字段：

- `id`: 稳定树管理标识，用于运行时增删改路由树
- `name`: 稳定路由名，用于 `router.link()` 和命名导航
- `path`: 路径片段，`""` 表示 index，`"*"` 表示兜底
- `component`: 组件标签名，或组件工厂函数
- `children`: 子路由
- `title`: 文档标题模板，支持 `:param`
- `props`: 额外注入到组件实例的属性
- `guard`: 路由守卫
- `beforeLeave`: 离开当前分支前触发的守卫
- `load`: 首次进入时的异步加载器

路由编译阶段会按 specificity 排序，匹配优先级是： 静态片段 > 动态参数 >
兜底通配。也就是说，`/me` 不会再因为你把 `/:id` 写在前面而被错误拦截。

### 2. 嵌套路由靠命名 slot 渲染

如果父路由声明了 `children`，父组件必须提供：

```html
<slot name="route-child"></slot>
```

默认 slot 名就是 `route-child`。也可以通过 `<router-view child-slot="...">`
改掉。

### 3. 路由上下文使用显式协议

推荐的组件契约是：

```ts
import type { RouteContext } from "@elelcode/lit-router";

@property({ attribute: false })
accessor routeContext: RouteContext | undefined;
```

其中：

- `routeContext.detail`: 完整的 `RouterChangeDetail`
- `routeContext.params`: 当前路径参数

如果你不想依赖属性更新，也可以实现：

```ts
setRouteContext(context: RouteContext): void
```

组件必须暴露 `routeContext` 或 `setRouteContext()` 之一。`router-view`
已经不再注入旧的 `routeDetail` / `routeParams` 字段。

## 守卫与重定向

守卫可以同步或异步返回：

- `true` / `undefined`: 放行
- `false`: 阻止导航
- `string` / `URL`: 重定向
- `{ to, replace }`: 带 replace 语义的重定向

示例：

```ts
{
  path: "lab",
  component: "lab-page",
  guard: () => {
    if (sessionStorage.getItem("lab-open") === "1") {
      return true;
    }
    return { to: "/", replace: true };
  },
}
```

`beforeLeave` 的返回语义与 `guard` 一致，但它只会作用在“即将被卸载的那段分支”
上。公共父级不会在兄弟子路由切换时重复触发。

### 组件级离开守卫 (`beforeRouteLeave`)

在 `<router-view>` 中挂载的页面或表单组件可以直接在其类上实现 `beforeRouteLeave` 方法，拦截用户意外切页造成的未保存内容丢失：

```ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("article-editor")
class ArticleEditor extends LitElement {
  hasUnsavedChanges = true;

  beforeRouteLeave(detail) {
    if (this.hasUnsavedChanges) {
      return confirm("当前有未保存的内容，确认离开吗？");
    }
    return true;
  }
}
```

切页离开时，`<router-view>` 会自动检查当前即将卸载的各级组件。返回 `false` 或 Promise 决议为 `false` 会阻止导航并自动回退浏览器地址栏。

### 动态离开守卫 (`router.registerLeaveGuard`)

在任意业务逻辑中动态注册离开守卫（例如全局上传任务中禁止切页）：

```ts
const unregister = router.registerLeaveGuard((detail) => {
  if (isUploading) {
    return false; // 拦截离开
  }
  return true;
});

// 上传完成后注销：
unregister();
```

## 懒加载与数据预取 (Loader)

### 代码分割 (`load`)

推荐把非首页路由统一写成：

```ts
{
  path: "settings",
  component: "settings-page",
  load: () => import("./pages/settings-page.ts"),
}
```

同一路由只会在首次进入时触发一次 `load()`。

### 并发数据预取 (`loader`)

在路由进入时并发拉取数据，消除前端请求瀑布流（Waterfalls）：

```ts
{
  path: "users/:id",
  name: "user-detail",
  component: "user-detail-page",
  loader: async ({ params, signal }) => {
    const res = await fetch(`/api/users/${params.id}`, { signal });
    return res.json();
  },
}
```

`loader` 函数接收 `{ router, params, query, hash, url, signal }`，与组件异步加载并发执行。获取到的数据会自动传递至：

- `router.current.data`
- `router.getRouteData()`
- `routeContext.data`
- `element.data = context.data`（若组件类声明了 `data` 属性）

如果你需要给全局进度条或壳层 loading 做联动，可以监听：

- `route-loading-start`
- `route-loading-end`

它们的 `event.detail.pending` 表示当前还有多少个路由加载过程（包含组件加载与数据 loader）在进行中。

## 导航方式

### 编程式导航

```ts
router.push("/settings/profile");
router.replace("/settings");
router.push({ name: "settings-profile" });
const href = router.link({
  name: "user-detail",
  params: { id: "123" },
  query: { tab: "activity" },
});
```

当前反向路由支持：

- 字面量路径片段
- `:param`
- `:param(<pattern>)`
- `*`
- `?` 可选参数片段，例如 `:lang?/docs`

如果路径里使用了 `+`、`*` 这类参数修饰符，`router.link()` 会直接抛错，而不是
静默生成错误 URL。

### 链接导航

路由会自动拦截：

- 同源
- 位于当前 `basePath` 内
- 没有 `target="_blank"` / `download`
- 没有被业务代码 `preventDefault()`
- HTML 和 SVG 中的 `<a>`

如果链接不属于当前 `basePath`，会自动回退到浏览器原生跳转。

如果要走 replace 语义：

```html
<a href="/settings" data-router-replace>Back To Settings</a>
```

### 激活态感知 (`router.isActive`)

检测某个路径、前缀或具名路由当前是否激活：

```ts
// 路径前缀匹配
router.isActive("/users"); // 当位于 /users 或 /users/42 时返回 true

// 精确全路径匹配
router.isActive("/users", { exact: true });

// 具名路由匹配
router.isActive("user-detail");

// 携带参数与查询参数匹配
router.isActive({
  name: "user-detail",
  params: { id: "42" },
  query: { tab: "activity" },
});
```

### 声明式模板指令 (`routerLink` 与 `activeRoute`)

在 Lit 模板中直接声明式书写导航链接与激活状态指示：

```ts
import { html, LitElement } from "lit";
import { activeRoute, routerLink } from "@elelcode/lit-router";

html`
  <!-- 在 <router-view> 树内自动从 DOM 上下文解析 router 实例 -->
  <a ${routerLink("/dashboard", { activeClass: "nav-active", exact: true })}>
    控制台
  </a>

  <!-- 具名路由并传递参数 -->
  <a ${routerLink({ name: "user-detail", params: { id: "42" } })}> 用户详情 </a>

  <!-- 为列表项或任意元素附加激活状态 -->
  <li ${activeRoute("/dashboard", { activeClass: "active-tab" })}>
    <a href="/dashboard">控制台</a>
  </li>
`;
```

`routerLink` 自动负责：

- 生成正确的 `href` 地址（包含 `basePath`）
- 拦截同源点击（自动放行新标签页修饰键、`target="_blank"`、`download` 及 `data-router-ignore`）
- 目标命中时自动添加指定 `activeClass`
- 自动设置 `aria-current="page"`，保障 Web 可访问性（a11y）

## 动态更新 Route Tree

如果应用启动后需要按登录态、权限、租户能力或插件模块动态更新路由树，通常更
常见的是按分支插入或删除：

```ts
router.insertRoutes([
  { path: "admin", name: "admin", component: "admin-page" },
]);

router.insertRoutes(
  [
    {
      id: "settings-security-plugin",
      path: "security",
      component: "settings-security-page",
    },
  ],
  {
    parentId: "settings-shell",
  },
);

router.removeRoute({ id: "settings-security-plugin" });
```

这里 `name` 继续用于导航和反向路由，`id` 用于运行时树管理。父路由如果没有对外
导航名，也可以只提供 `id`。如果父路由要承载新的子页面，组件模板仍然要提供对
应的命名 `slot`。

如果你要一次装入多个插件分支，建议合并成一次更新：

```ts
router.batchRouteUpdates(() => {
  router.insertRoutes([
    { path: "alpha", name: "alpha", component: "alpha-page" },
  ]);
  router.insertRoutes([{ path: "beta", name: "beta", component: "beta-page" }]);
});
```

如果批次回调中途抛错，路由器会回滚这次批次，而不是留下半应用状态。

这个批次回调必须保持同步。如果你有异步加载步骤，先完成异步，再进入
`batchRouteUpdates()`。

插入或删除后，路由器会立即用当前 URL 重新匹配：

- 如果还能命中，就重新 commit 当前页面分支
- 如果当前 URL 不再存在，就派发 `route-not-found`
- 命名路由索引也会一并更新

如果你的场景确实是一次整体切换，也可以直接替换整棵树：

```ts
router.setRoutes([
  { path: "", component: "home-page" },
  { path: "workspace", component: "workspace-page" },
  { path: "admin", component: "admin-page" },
]);
```

如果你想一次同时改 `routes`、`basePath`、`beforeRoute`，继续使用：

```ts
router.configure({ routes, basePath, beforeRoute });
```

## RouterView 说明

`<router-view>` 负责把路由树真正挂到 DOM 上。

支持的主要入口：

- `.router = router`
- `child-slot="..."`
- `no-view-transition`

如果没有命中路由或导航报错，`<router-view>` 不会再留空，而是默认渲染：

- 404 fallback
- error fallback

如果你想覆盖默认视图，可以直接在 light DOM 里提供 slot：

```html
<router-view>
  <not-found-page slot="404"></not-found-page>
  <route-error-page slot="error"></route-error-page>
</router-view>
```

路由切换后，它会：

1. 更新页面分支
2. 恢复滚动位置
3. 处理焦点移动
4. 派发 `route-change`

这里的 `router-view` `route-change` 表示“视图已经 commit 完成”，不等同于
`Router` 实例上的同名事件。

额外行为：

- 滚动恢复绑定的是 Navigation API entry，不只是 URL
- hash 锚点只走 `document.getElementById()`
- 如果锚点在组件 shadow tree 内部，请把对应 `id` 暴露到 host 上，这样查找仍然是
  O(1)
- `<router-view>` host 会带上
  `data-transition-direction="forward|backward|none"` ，方便你直接写基于方向的
  View Transitions CSS

推荐在页面主标题或主容器上标注：

```html
<h1 data-route-focus tabindex="-1">Profile</h1>
```

## W3C Context 协议支持

`<router-view>` 原生充当符合 W3C Context 协议的 Context Provider。它会自动响应以下上下文请求：

- `routerContext`：当前激活的 `Router` 实例。
- `routeContext`：当前激活的 `RouteContext`（包含路径参数、匹配分支以及预取数据）。

### 配合 `@lit/context` 使用

```ts
import { LitElement, html } from "lit";
import { consume } from "@lit/context";
import {
  type RouteContext,
  type Router,
  routeContext,
  routerContext,
} from "@elelcode/lit-router";

class BreadcrumbBar extends LitElement {
  @consume({ context: routeContext, subscribe: true })
  route?: RouteContext;

  render() {
    return html`
      <ul>
        ${this.route?.branch.map(
          (step) => html`<li>${step.name ?? step.path}</li>`,
        )}
      </ul>
    `;
  }
}
```

## 与 `lit-ui-router` 深度对比

| 维度             | `lit-ui-router`                                              | `@elelcode/lit-router` (本项目)                            |
| :--------------- | :----------------------------------------------------------- | :--------------------------------------------------------- |
| **底层核心依赖** | 强依赖 `@uirouter/core` 重型状态机（AngularJS 时代历史包袱） | **Navigation API 原生首选** + 浏览器原生标准               |
| **视图组织**     | 自定义 `<ui-view>` 组件树                                    | **原生 Web Components `<slot>`** 并行多插槽                |
| **过渡动画**     | 模拟过渡类                                                   | **原生 `View Transitions API`** 支持方向感知               |
| **模板指令**     | `uiSref`                                                     | **`routerLink` 与 `activeRoute`**，自动管理 `aria-current` |
| **数据加载**     | 状态机 `resolve`                                             | **并发 `loader`**，支持 AbortSignal 取消与消除瀑布流       |
| **离开守卫**     | `uiCanExit`                                                  | **组件 `beforeRouteLeave`** + `registerLeaveGuard`         |
| **上下文协议**   | 需适配 `@lit/context`                                        | **标准 W3C Context Protocol**，零外部依赖互通              |
| **包体积**       | **> 300KB**（Gzip 约 90KB+）                                 | **~60KB**（**Gzip 约 15KB**，体积减少约 6 倍）             |

## 事件

建议在应用壳层统一监听：

- `route-change`
- `route-tree-change`
- `route-error`
- `route-loading-start`
- `route-loading-end`
- `route-not-found`

完整事件字段定义请直接看 [docs/api.zh-CN.md](./api.zh-CN.md)。

示例：

```ts
router.addEventListener("route-error", (event) => {
  console.error(event.detail.phase, event.detail.error);
});
```

### 建议的生产处理

- `Router` 实例上的 `route-change` 更早触发，表示 URL / current 状态已提交；
  `event.detail.direction` 会告诉你这次是前进、后退还是无方向提交
- `route-tree-change`: 路由树在运行时发生了增删改，适合驱动菜单、权限壳层、
  插件注册信息同步
- `router-view` 上的 `route-change` 更晚触发，表示对应 outlet 的 DOM 已挂载完成
- `route-loading-start/end`: 适合挂全局进度条或壳层 loading
- `route-error`: 渲染“加载失败 / 无权限 / 重试”兜底 UI
- `route-not-found`: 渲染 404 页面

## 生产约束

这套路由当前明确面向以下场景：

- 现代浏览器
- 单文档单 SPA
- 原生 `URLPattern` 可用
- Navigation API entry 方向缓存是有界的，不会在超长会话里无限增长
- 不做 SSR

额外注意：

- 同一个 document 里只支持一个已启动的 `Router`
- 路由要求浏览器提供 `Navigation API`，没有 History API 或 hash 路由 fallback
- `router-view` 内部有滚动缓存，但已经做了有界限制，不会无限增长
- 发布至 npm 为标准 ESM 模块并自带 TypeScript 类型声明文件 (.d.ts)

## 开发建议

### 推荐

- 非首页路由默认使用 `load`
- 新组件默认使用 `routeContext`
- 父路由组件显式提供 `slot`
- 根壳层统一处理 `route-error` / `route-not-found`
- Lit 依赖保持在当前包使用的 3.x range

### 不推荐

- 假设 `router-view` 会自动写入任何未声明的路由字段
- 在同一 document 中并行启动多个 `Router`
- 让同一个页面既混用当前 SPA 路由，又混大量同源非 SPA 页面而不做边界划分

## 能力边界

这套路由当前明确面向：

- 现代浏览器
- 单 document SPA
- 原生 `URLPattern` 可用
- 纯 Web Components / Lit 渲染
- Deno-first / JSR-first 的发布模型

额外注意：

- 同一个 document 内只支持一个已启动的 `Router`
- 路由要求浏览器提供 `Navigation API`，没有 History API 或 hash 路由 fallback
- Navigation API entry 方向缓存和 `router-view` 滚动缓存都是有界的
- `load()` 的 Promise 返回值不会注入组件上下文，它只承担代码分割或副作用职责
- 这套核心不覆盖 SSR，也不内建激活链接之类的壳层能力

## 进一步阅读

- [英文指南](./guide.md) — English user guide
- [英文 API 参考](./api.md) — 完整类型签名与方法文档
- [中文 API 参考](./api.zh-CN.md) — Chinese API reference
- [Slot 多出口设计](./slot-outlets-design.md) — 并行命名 outlet 架构设计
- [变更日志](../CHANGELOG.md) — 版本历史
