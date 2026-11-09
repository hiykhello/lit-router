# Router Todo

## Done

- [x] 将路由定义从 HTML 属性迁移到 TypeScript 路由树
- [x] 用浏览器 `URLPattern` 替换手写路径匹配
- [x] 用原生 DOM API 控制路由子组件切换显示
- [x] 用父组件命名 `slot` 承载嵌套路由子页面
- [x] 接入 `Navigation API`、`View Transition API` 和 `replace()` 导航

## Functional Improvements

- [x] 增加 `base-path` 支持，方便在子路径和嵌套路由中复用
- [x] 增加 route guard 机制，支持阻止跳转和重定向
- [x] 增加懒加载 loader 机制，按路由首次进入时再加载模块
- [x] 完成嵌套路由示例，验证路由树 children 可以直接驱动父子页面嵌套

## Refactors Done

- [x] 拆分 `routeTo()` 的解析、守卫、重定向、加载和提交阶段
- [x] 统一 `route-not-found` 派发逻辑，避免重复分支各自维护
- [x] 收口 `router-view` 的 commit + `route-change` 派发流程
- [x] 拆分 `mountBranch()` 的复用、创建、挂载和收尾步骤
- [x] 抽出共享 `browser-env`，统一浏览器宿主访问
- [x] 将滚动恢复逻辑抽成独立的 `ScrollManager`
- [x] 将 `routeDetail` / `routeParams` 注入协议显式化为 `RouteContext`
- [x] 为 `router-view` 增加默认 404 / error 回退视图和 slot 覆盖
- [x] 为路由定义增加 `name`，并提供 `router.link()` 反向生成 URL
- [x] 删除旧的 `routeDetail` / `routeParams` 兼容注入
- [x] 迁移到当前 Lit 装饰器字段写法，移除 `experimentalDecorators`

## Slot Multi-Outlet (已落地核心)

- [x] `RouteDefinition.slot?: string` — 路由声明投影目标 slot，默认
      `"route-child"`
- [x] `matchSlotRoutes()` — 多 slot 贪心匹配，含 `matchCache` 去重
- [x] `RouterChangeDetail.slotBranches` / `slotParams` / `slots` — 侧 slot
      完整分支详情
- [x] `RouteContext.slot` / `RouteContext.branch` — 组件感知自身 slot 和分支
- [x] `normalizeRouteSlot()` + `RESERVED_ROUTE_SLOTS` — 禁止 `"404"` / `"error"`
      作为路由 slot 名
- [x] `collectLeavingRoutes()` — beforeLeave 收集侧 slot 离开路由，字典序排序
- [x] `collectMatchedRoutes()` — guard 遍历侧 slot 去重并集
- [x] `detailBranches()` — load 遍历所有分支
- [x] `loadBranchForNavigation` — 遍历所有 slot 分支的 lazy loading
- [x] `isSameDetail` — 比较 slot 分支引用一致性
- [x] `renderedBranches: Map<string, HTMLElement[]>` — 按 slot 分桶渲染
- [x] `mountRouteBranch()` — 统一主链/侧链挂载逻辑
- [x] `routeSlot()` — 解析路由定义的 slot 名
- [x] `applyRouteState` — 传入 slot/branch/params，填充正确 RouteContext
- [x] `validateChildOutlet` — per-slot 验证父组件子路由出口

## 2.1.0 工业级扩展 (已完成)

- [x] **`router.isActive()` 全面激活检测** — 支持全路径、前缀、具名路由、`id` 选择器、动态 params、query 与 hash。
- [x] **`RouteDefinition.loader` 路由数据预取** — 异步并发加载数据，消除请求瀑布流，数据自动注入 `RouteContext.data`、`element.data` 与 `router.getRouteData()`。
- [x] **动态离开守卫与组件级钩子** — 支持 `router.registerLeaveGuard()` 动态拦截及自定义元素组件级 `beforeRouteLeave()` 声明式拦截，阻止切页并自动恢复 URL。
- [x] **W3C Context Protocol 互通** — 零外部依赖导出 `routerContext`、`routeContext` 与 `requestContext`，100% 兼容 `@lit/context` 与原生 Web Components。
- [x] **声明式模板指令** — 导出 `${routerLink()}` 与 `${activeRoute()}`，自动处理 `href`、点击拦截、激活类名及 `aria-current="page"` 无障碍支持。
- [x] **全量单元测试与 E2E 验证** — 新增 [`tests/extensions_test.ts`](file:///home/yk/Code/lit-router/tests/extensions_test.ts)，全量 79 条单元测试与 4 条 Puppeteer E2E 测试全部通过。
- [x] **中英文文档与更新日志** — 全量同步更新 `README.md`、`docs/guide.md`、`docs/guide.zh-CN.md`、`docs/api.md`、`docs/api.zh-CN.md` 与 `CHANGELOG.md`。

## Next

- [x] E2E 测试已就绪 — 4 条 Puppeteer 测试覆盖 push/back/title/slot/404，通过
      `npm run test:e2e` 运行（需 Chromium）。CI workflow 已配置 e2e job。

## Polishing (低优先级完善)

- [x] **`mountBranch` 签名 `_previousDetail` 已移除** —
      参数已从签名和所有调用点删除。
- [x] **`dispatchRouteLoading` 中 `loadingSlots` 双重克隆已合并** — 移除内层
      `[...loadingSlots]`，调用方已提供新数组。
- [x] **`detailSlotBranches` 已内联** — 合并到 `detailBranches`，消除单次 spread
      临时对象。
- [x] **侧 slot 嵌套 children 专项测试已添加** — 通过
      `test-route-sidebar-layout` 验证 sidebar → sidebar-tools 递归投影链。
- [x] **API 文档已补充** — `docs/api.md` / `docs/api.zh-CN.md` 已包含
      `slot`、`slotBranches`、`slotParams`、`slots`、`RouteContext.slot/branch`、`RouterSlotDetail`、`RouterChangeDetailJson`、`loadingSlots`
      等全部新类型。
