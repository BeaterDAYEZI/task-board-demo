# 部门工作任务看板

部门内部（8–10 人）使用的工作任务管理与进度看板系统（演示版开发中）。

- 成员在线更新任务内容、任务来源、执行人、负责人、起止时间，并按周填报任务进度
- 自动汇总任务总览看板，供领导查看进度，点击可关联到任务详情
- 进度历史自动留存形成趋势；逾期任务自动标红提醒

## 文档

- [项目方案（v0.4 讨论稿）](docs/项目方案.md)
- [版本记录](CHANGELOG.md)

## 目录结构

- `docs/` 方案文档
- `frontend/` 演示版前端工程（Vue 3 + Vite + Element Plus + ECharts）
- `.github/workflows/` GitHub Pages 自动部署配置

## 运行演示版（本地）

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 即可。

> 注：`frontend/.npmrc` 已配置国内镜像源，并覆盖了本机失效的本地代理（`proxy=null`）；
> 若你本机的代理软件恢复使用，可按需调整或删除这两行配置。

演示版说明：

- 登录页点选身份进入（12 人：8 名成员 + 主任 / 副主任 / 领导 + 1 名管理员）
- 任务数据已导入《部门重点工作任务清单》（68 项任务，含逐周进展记录）
- 管理员可在「设置 → 数据管理」中上传 Excel 在线导入 / 更新任务
- 支持按截止时间 / 优先级 / 最近更新排序，重点任务（★）一键置顶；手机浏览器可直接使用
- 数据保存在浏览器本地（localStorage），可在「设置 → 数据管理」重置
- 领导账号登录后默认进入「总览看板」；周一打开时会弹出模拟的 09:00 提醒
- 演示版单个附件限 1MB（正式版存储到服务器，无此限制）

> 数据说明：公开仓库内置**脱敏演示数据**（虚构人员与任务，供演示 / 展示）；本地使用真实数据时，在 `frontend/.env.local` 中设置 `VITE_SEED=real`（`.env.local` 与 `*.real.json` 均不会被提交 / 发布）。

## 演示站点（GitHub Pages 自动部署）

- 站点地址：https://beaterdayezi.github.io/task-board-demo/
- 部署方式：推送到 `main` 分支后由 GitHub Actions 自动构建部署（工作流见 `.github/workflows/deploy.yml`）
- 首次部署前需在仓库 Settings → Pages → Source 选择 **GitHub Actions**（本仓库已配置）

## 项目状态

- [x] 需求讨论与确认（任务来源、优先级、权限、提醒规则）
- [x] 方案文档（v0.5）
- [x] 演示版开发（任务 / 周进度 / 看板 / 报表 / Excel 导入导出 / 移动端适配）
- [x] 导入部门任务清单（68 项任务、逐周进展）
- [x] 数据源拆分：真实数据本地使用 / 脱敏数据用于公开演示
- [x] GitHub Pages 演示部署（脱敏演示版）：https://beaterdayezi.github.io/task-board-demo/
- [ ] 正式版（后端 + 数据库 + 云服务器部署）
- [ ] 公司统一账号 SSO 集成

## 技术栈

前端：Vue 3 + Vite + Element Plus + ECharts + Pinia + Vue Router。
演示版为纯前端（数据存浏览器本地）；正式版计划追加 FastAPI/Node 后端 + SQLite/MySQL，部署阿里云/腾讯云，提醒与 SSO 对接待 IT 部门确认。

