<p align="center">
  <img src="icon.svg" width="96" height="96" alt="通知提示音图标">
</p>

<h1 align="center">通知提示音 · Notification Chime</h1>

<p align="center">
  为 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 提供「任务完成 / 人工审批」提示音的应用内插件。
</p>

<p align="center">
  <a href="README.en.md">English</a> · 简体中文
</p>

---

## 为什么需要它

DeepSeek Harness 的任务可能运行较久。切到其他窗口后，你很难及时知道：

- 回复已经结束；
- 或者 Agent 停下来等待你批准一次工具调用。

**通知提示音**在应用内播放短促、可区分的提示音，并提供一个可以随时试听的设置项。

## 特性

| 能力 | 说明 |
| --- | --- |
| 任务完成提示 | 普通 Session 的 `turn/end` 为 `completed`、`error` 或 `max-tokens` 时播放完成音 |
| 审批提示 | 出现 `approval` 或 `plan-review` 待处理交互时播放审批音 |
| 应用内播放 | 声音由 Harness 页面（Electron 渲染进程）播放，系统音量合成器显示为 DeepSeek Harness，而不是 `powershell.exe` |
| 不打扰的过滤 | 子智能体完成、用户主动中止（`aborted` / `interrupted` / `forked`）不播放 |
| 自动合并 | 600ms 内多个完成、900ms 内多个审批只响一次 |
| 可视化验证 | 设置 → 通用 → 通知提示音：试听按钮、音频状态、上次触发时间 |
| 零网络、零外部资源 | 提示音由 Web Audio 合成，不下载、不上传、不写音频文件 |

## 环境要求

- DeepSeek Harness Desktop 或支持 Client 插件的 Web GUI。
- 在 Harness `0.2.1-rc.2` 上开发和验证。
- 无需安装任何运行时依赖。

## 安装

本仓库本身就是一个 DSH bundle 包。

1. 克隆仓库：

   ```bash
   git clone https://github.com/<your-name>/notification-chime.git
   ```

2. 在 DSH 中安装本地 bundle：
   - 打开**插件管理**，选择从本地目录安装 bundle，指向仓库目录；或
   - 让 Agent 使用 `plugin_manager` 的 `install_bundle`，`target` 填仓库绝对路径。

3. 安装完成后无需重启。如果页面暂时没有出现设置项，刷新一次页面。

> 当前包名 `@local/notification-chime` 中的 `@local` 仅用于本地链接安装，不是可发布到 npm 的 scope。发布前请按[发布](#发布到-github-与-npm)一节修改。

## 使用

打开 **设置 → 通用 → 通知提示音**：

- 点击 **试听** 播放一次完成音。首次点击也会解锁浏览器的音频上下文。
- 状态行会显示音频是否就绪，以及最近一次真实触发（任务完成或人工审批）的时间。
- 之后任务结束或需要审批时会自动播放，无需保持设置页打开。

### 触发规则

| 事件 | 是否提示 |
| --- | --- |
| 普通 Session 正常完成 | ✅ 完成音 |
| 普通 Session 报错 / 达到 token 上限 | ✅ 完成音 |
| `approval` / `plan-review` 待处理 | ✅ 审批音 |
| 子智能体完成 | ❌ |
| 用户主动中止、被中断、fork | ❌ |
| 已存在的审批仍未处理 | ❌ 不重复播放 |

## 工作原理

插件只有一个 Client 半部（Host 半边是空的 bundle 行），核心流程：

1. 订阅页面里的 `uiSession.sessionStatus`（每个 Session 的 `running`、`pendingInteraction`、`completionUnread`）与 `sessions.list`（用于识别子智能体）。
2. 对比前后两份快照：`running: true → false` 或 `completionUnread` 出现视为完成；审批类 `pendingInteraction` 首次出现视为需要人工审批。
3. 用 Web Audio 合成提示音；页面首次交互时解锁音频上下文。
4. 把最近一次触发和音频状态同步到「设置 → 通用」的提示音行。

更完整的设计说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 声音设计

| 场景 | 音符 | 听感 |
| --- | --- | --- |
| 任务完成 | C5 → E5 → B5（带一点 C6 泛音） | 柔和、上行的“完成”感 |
| 需要审批 | C6 → G5 → C6 | 更短、更高的三连音，明显区别于完成音 |

所有音符都是正弦/三角波加淡入淡出包络，不依赖音频文件。

## 排障

**设置里能看到「通知提示音」，但试听没有声音**

- 看系统音量合成器：现在应该出现 **DeepSeek Harness**（如果 GUI 在浏览器中打开，则是浏览器），播放时能看到电平。
- 如果合成器有电平但听不到：检查系统默认输出设备与音量；远程桌面场景下检查「远程音频 → 在此计算机上播放」。
- 点击一次「试听」可解锁 Chromium 的音频上下文；之后自动提示音才会稳定发声。

**设置里找不到「通知提示音」**

- 确认 bundle 已启用（插件管理 → 已安装）。
- 刷新页面，或在设置 → 通用中搜索「提示音」。
- 查看 Harness 日志中是否有 Client 插件加载失败。

**任务结束但没有响**

- 确认该 turn 不是被主动中止（`aborted`）。
- 子智能体结束不会响。
- 打开设置行，看“上次触发”是否更新；若更新了但仍无声，按上面的音频输出步骤排查。

## 开发与测试

仓库没有运行时依赖，测试使用 Node 内置 test runner。

```bash
npm run check   # 两个入口文件的语法检查
npm test        # manifest、Host 半部、Client 检测逻辑
```

测试覆盖：

- bundle 清单、patch、locale、图标、Client 模块 id 的一致性；
- Host 半部保持惰性；
- 完成 / 审批 / 子智能体 / 重复审批的检测与音符数量。

CI 配置在 [.github/workflows/ci.yml](.github/workflows/ci.yml)，在 Node 20 与 22 上运行。

代码风格：2 空格缩进、UTF-8、无分号偏好沿用现有文件；新增行为请同时补测试。

## 发布到 GitHub 与 npm

### GitHub

```bash
git init
git add .
git commit -m "feat: initial notification-chime plugin"
git branch -M main
git remote add origin https://github.com/<your-name>/notification-chime.git
git push -u origin main
```

建议仓库名：`notification-chime` 或 `dsh-notification-chime`。

### npm

`@local/notification-chime` 不是可发布的 npm 包名。发布前：

1. 把 `package.json` 的 `name` 改成你拥有的 scope，例如 `@your-scope/dsh-notification-chime`；
2. 同步修改 `cordis.patch.yml` 里的 `name`；
3. 同步修改 `client.js` 顶部的模块 `id`（必须与包名完全一致）；
4. 移除 `"private": true`；
5. 更新 `test/manifest.test.mjs` 中固定的行 id（如果改了行 id）；
6. 执行 `npm publish --access public`。

## 兼容性与限制

- 插件依赖 Harness Client 内部的 `uiSession` / `sessions` 服务与 `settings.general.item` 槽位。这些接口尚未承诺跨大版本稳定；升级 Harness 后如失效，优先检查这三个契约。
- 提示音跟随系统默认输出设备；远程桌面/虚拟音频设备是否可听取决于客户端音频设置。
- 不修改 Host 进程，不启动子进程，不访问网络。

## 许可证

[MIT](LICENSE)
