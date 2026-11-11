# 登录与插件兼容性

本轮接入上游 `host.webSignIn`、`host.openURL`、`host.waitForRedirect` 协议，并对官方目录全部 62 项执行匿名、只读的独立运行检查。实现证据来自仓库中的 Source 协议、安装后的真实插件代码及确定性回归；尚未使用真实用户账号登录或在电视上完成账号验证。

## 登录流程

1. 应用调用 `POST /api/login/{instance}`，获得一次性会话 ID。Go 将宿主回调绑定到这个已安装实例；同一插件 ID 的不同仓库或不同服务实例不共享回调和存储。
2. 插件可沿用扫码提示，或请求临时网页。`GET /api/login` 只返回状态、提示、网页种类、网页请求 ID 与地址，不返回 Cookie。
3. Android 通过 `openLogin(id, requestId)` 打开未导出的 `BrowserLoginActivity`。网页不加载主应用的 JavaScript 桥。原生侧凭 Go 进程的 bearer 凭证读取 `/api/login/native`，获取当前请求的 `cookiesOf`、`until` 和可选 User-Agent。
4. `host.webSignIn` 的 URL 和 Cookie 目标沿用上游 HTTPS / 网络权限检查；原生页禁止文件、内容、intent、任意明文网页与应用的 loopback API。Cookie 目标必须为安全域名。全部 until Cookie 有非空值后，原生侧直接向 Go 提交；Go 再检查会话、网页请求 ID、大小和所需 Cookie，交给对应插件，由插件存入自己的隔离数据目录。
5. OAuth 来源沿用固定回调端口与路径、state / PKCE 参数。Go 仅监听 `127.0.0.1`，原生页仅放行当前会话登记的精确明文回调；取消或超时关闭监听器。服务特有的 state / PKCE 校验由原插件负责。
6. 取消请求携带会话 ID，旧取消或旧网页结果不能影响新登录。会话有效期最多 5 分钟；等待登录期间禁止激活该来源更新。完成后关闭临时窗口、重新读取账号。网络读取失败保留提示并可重试；返回原生窗口后主动恢复状态查询。

Android 6 的 CookieManager 为进程共享对象，不能把另一个 WebView 当作独立 Cookie 容器。本应用串行处理临时登录，在入口和退出时清理远端 Cookie、网页存储、缓存和表单，并恢复主应用自己的 loopback HttpOnly 会话 Cookie；不复用前一个音乐源的网页身份。允许临时 SSO 页面使用第三方 Cookie，凭据仍仅按插件请求的地址提取。异常进程退出可能跳过退出清理，下次登录入口仍会先清理。插件自身已确认的账号凭据由 Go 独立保存，不会因临时网页清理而删除。

平台依据：[CookieManager](https://developer.android.com/reference/android/webkit/CookieManager)、[WebView 原生桥边界](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges)。浏览器预览不模拟跨站 Cookie 读取；对应入口明确提示在电视应用中完成。手机扫描来源自身提供的二维码与手机 OAuth 回调是不同协议，当前没有引入 LAN 监听或公共 OAuth 中转。

## 插件逐项验证

原始结果在 [report.json](../core/internal/compatibility/report.json)，随应用打包，按仓库和实际安装 revision 记录。当前结果为：

| 检查 | 结果 | 证据限制 |
| --- | --- | --- |
| 目录条目 | 62 | 来自官方页面实际安装链接 |
| 安装和编译检查 | 56 | 使用与应用相同的安装器和禁用外部进程的运行时 |
| 安装检查未完成 | 6 | 下载阶段 HTTP 403，不能据此判定插件不兼容 |
| 非空歌曲搜索 | 31 | 匿名搜索“周杰伦”，依赖当时网络与服务响应 |
| 返回 HTTP 音频地址 | 7 | 仅解析，未下载完整歌曲、未实际播放 |
| 真实账号登录 / 收藏写入 / Android 播放 | 待验证 | 本轮未操作真实用户账号 |

每项还记录可导出功能、外部程序声明、可识别的网页 Cookie / OAuth / 扫码宿主调用，以及 account、home、playlists、lyrics、comments 的只读检查。无数据、需要账号、需要配置、接口失败、未提供能力和未测试分别记录；没有调用点赞、发布评论、歌单编辑或 played。

这些是具体网络、时间和版本下的抽样结果。未返回音频地址不等于永远不能播放，返回地址也不证明音频格式、账号权限或 Android 播放成功。声明外部程序不代表全部功能都不可用；本地歌词和桌面扩展保留在完整目录中，不因此增加本地曲库功能。市场详情展示记录对应版本；已安装版本不同会明确标识“此记录对应其他版本”，没有记录的版本不显示验证通过。

目前下载受限的仓库：`GYRYEZ/mygo-music-roamdial`、`MaYunFei/mygo-music-feiniu`、`Maker-World/mygo-music-migu`、`TengYangTuoHai/mygo-music-navidrome`、`e5u/mygo-taskbar-lyrics`、`sounfury/mygo-music-spotify-soloist`。本轮保留实际 HTTP 403 结果，没有借用开发者 GitHub 私有凭证绕过限制。

## 重跑检查

```sh
go run -mod=vendor ./core/cmd/plugin-audit \
  -data-dir build/plugin-compat-audit \
  -output core/internal/compatibility/report.json
# 保留成功结果，仅重试安装未完成的条目
go run -mod=vendor ./core/cmd/plugin-audit -retry-blocked
```

命令只使用自己创建并标记的匿名审计目录，拒绝未标记的已有实例目录，不能指向用户账号数据目录。默认最多 3 个并发检查；报告只保存结果代码和数量，不保存账号、Cookie、媒体 URL 或原始响应。使用的是私有目录中的临时安装，不修改用户正在使用的预览或已安装音乐源。

## 回归证据

Go race 覆盖 Cookie 原生权限边界、缺失 Cookie、旧结果/旧取消拒绝、两个实例同时登录、凭据隔离、超时、回调端口释放和登录期间更新保护。Playwright 覆盖网页入口、预览限制、显式 OAuth 打开、查询重试、迟到启动清理、原生返回恢复查询和版本不一致的兼容性展示。Android 纯 Java 策略测试覆盖 HTTPS、精确回调、危险导航和 Cookie 完整性；Android 编译、lint 与单元测试由 CI 执行。上述结果不能代替真实服务授权和 Android 6 设备验证。
