# 闵行城运派单系统 Web Demo

本项目高保真复刻现有派单列表与工单详情页，并在不改变原有信息结构的前提下加入悬浮式 AI 推荐与自动派单动画，用于派单能力设计与演示。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:3000`。

## 页面

- `/`：待核验派单列表与约31秒自动派单演示
- `/orders/mh-006`：工单详情与 AI 推荐 Demo
- `/orders/auto-003?focus=address&source=auto-dispatch`：低地址置信度人工干预流程

## 数据

工单演示数据位于 `src/data/work-orders.json`，AI 推荐结果位于 `src/data/ai-recommendations.json`，自动派单时间线与六条动态工单位于 `src/data/auto-dispatch-scenario.json`，全部为虚构脱敏内容。Demo 不调用真实 AI 服务，修改 JSON 后即可调整到达时间、派单结论、置信度、候选地址和目标部门。

## 自动派单演示

在首页打开“自动派单”开关即可播放。工单约每5秒到达，支持暂停、恢复和重播；第三条工单因标准地址置信度不足而置顶等待人工确认，其余工单继续自动流转。

## 高德地图（可选）

复制 `.env.example` 为 `.env.local` 并填写 Web 端 Key 与安全密钥后，可在标准地址推荐中显示真实高德底图。未配置时，其他 AI 推荐和表单回填功能仍可正常演示。

## 检查

```bash
npm run lint
npm run build
```

视觉与交互验收记录见 `design-qa.md`。
