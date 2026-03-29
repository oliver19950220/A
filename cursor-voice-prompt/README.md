# Cursor 语音 Prompt 输入小工具

依据仓库根目录 `PRD.md`（v0.2）实现的 **Windows 桌面端 MVP**：**Web Speech API（zh-CN）** + **剪贴板写入** + **模拟 Ctrl+V** 注入当前前台焦点（请将焦点放在 Cursor 聊天/Composer 输入框）。

## 环境要求

- Windows 10/11（x64）
- [Node.js](https://nodejs.org/) 18+（当前 LTS 即可）
- 麦克风可用；识别依赖 Chromium 内置链路，需能访问相应网络服务（与 Chrome 网页语音识别一致）
- 已安装 **Microsoft Edge WebView2 运行时**（通常系统已带；Electron 会自带 Chromium，一般可直接运行）

## 安装与运行

```powershell
Set-Location "e:\Users\A\GitHub-A-clean\cursor-voice-prompt"
npm install
npm start
```

## 使用说明

1. 打开 **Cursor**，点击 **AI 聊天或 Composer 输入框**，光标放在要插入的位置（建议行末）。
2. 在本工具窗口点击 **「开始聆听」**，说话；每句 **定稿（final）** 后会自动 **粘贴到当前焦点**。
3. **「清空缓冲」**：清空本工具内只读预览，并重置「首句是否加换行」状态。
4. **关闭窗口**不会退出程序：应用最小化到 **系统托盘**，托盘菜单可 **显示主窗口** 或 **退出**。

### 全局快捷键

| 快捷键 | 作用 |
|--------|------|
| `Ctrl+Shift+Y` | 显示/隐藏主窗口 |
| `Ctrl+Shift+U` | 切换开始/停止聆听 |

## 隐私说明

语音识别由 **Chromium / Web Speech** 相关能力处理，数据流与隐私条款以浏览器厂商说明为准；本仓库应用**不向自研服务器上传**语音。

## 打包（可选）

```powershell
npm run dist
```

产物在 `release/` 目录（便携版 exe，具体文件名见 `package.json` 中 `artifactName`）。

## 故障排除

### `Electron failed to install correctly` 或 `npm ERR! EBUSY`

多为 **Electron 二进制未下完** 或 **`node_modules\electron` 被占用**（杀毒、未结束的 `npm install`、资源管理器预览等）。

1. 关闭所有可能占用该目录的程序与终端任务。  
2. 删除 `cursor-voice-prompt\node_modules` 整个文件夹。  
3. 重新执行 `npm install`。

若仍失败，可设置国内镜像后再装（示例，按你环境选用）：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

### 开始聆听后终端出现 `chunked_data_pipe_upload_data_stream` / `OnSizeReceived failed … Error: -2`

这与 **Web Speech API 向云端上传音频流** 有关，常见于 **VPN、系统代理、防火墙或运营商路径** 导致上传中断；不一定是你业务代码写错。

建议：

1. **暂时关闭 VPN** 或改为 **分流**（让 Electron/本机直连可走通识别服务的线路），再试「开始聆听」。  
2. 在 **可正常打开 Google 相关服务** 的网络环境下试（与 Chrome 网页语音输入所需网络类似）。  
3. 若界面状态栏出现 **「网络异常」** 等提示，说明 `recognition` 已回报 `network` / `aborted` 等，与上述终端日志往往同源。  
4. 纯离线或无法访问识别服务时，可改用系统 **Win + H** 听写（见 PRD 3.1）。

## 技术栈

- Electron 33 + 预加载脚本（`contextIsolation`）
- 主进程：`clipboard.writeText` + PowerShell `SendKeys` 发送 `^v`
