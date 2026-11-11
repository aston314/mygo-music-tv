# MyGo Music TV

Android TV 在线音乐应用：Java 壳、Go 插件核心、固定 **1280×720** 的 WebView 界面。基于 MyGo Music v0.1.22 的音乐源协议与 moejs 运行时，不包含本地曲库。

## 运行预览

```sh
go run -mod=vendor ./core/cmd/music-tv -mode real
# 使用终端输出的临时 URL 打开界面；端口与会话凭证每次启动生成
```

`-mode fixture` 使用随应用附带的确定性插件与音频；`empty`、`error`、`loading` 用于测试失败/空数据/慢加载。预览与 APK 使用同一套 Go HTTP 接口。数据默认保存在 `.data/`，可用 `-data-dir` 指定独立目录。

## 已实现

- 从 `https://music.egoist.dev/zh/plugins` 的安装链接发现完整插件目录，30 分钟缓存、手动刷新、刷新失败保留可用缓存。
- GitHub release/通用包/源码包解析，下载、压缩包校验、编译后安装、安装任务进度、重试、更新和卸载。
- 按仓库隔离插件实例、设置与登录数据；同 ID 不同作者的插件可以并存。卸载保留账号数据。
- 上游 JS/TS 插件运行时、网络权限、crypto、storage、settings、capability 与 Source JSON 协议。
- 音乐源切换、首页/自定义目录、多类型搜索与分页、歌单/专辑/歌手/播客、二维码登录；远端设备选择与 remote 播放/暂停/恢复/进度控制。
- 播放页左侧集中展示封面、歌曲信息和播放控制，右侧完整展示歌词；纯歌词全屏采用独立控制布局，进入/退出使用不同 SVG 图标。保留插件提供的真实逐字时间戳，普通 LRC 按行同步，纯文本歌词可用方向键滚动。加载失败提供重试。
- 歌曲喜欢/取消喜欢、加入或新建来源歌单、专辑和歌单收藏、歌手关注、播客订阅。按插件能力展示操作，写入失败保留先前状态。
- 评论逐条聚焦，上下移动、展开全文、点赞和发表评论；接近列表底部时按需加载下一页，失败保留原内容并可重试，支持嵌套输入面板返回。评论与收藏写入对应音乐源账号或插件存储，实际权限由音乐源决定。
- 顺序播放、列表循环、单曲循环、随机播放，播放模式持久化；随机模式使用实际播放历史返回上一首。“下一首播放”、追加、跳转、移除和确认清空队列均可操作，重复歌曲按独立队列条目标识。
- 右上角常驻当前音乐源的账号名；切换来源、登录和退出后更新，查询失败保留已知账号并提供重试/重新登录。
- 底部展示歌曲、歌手与专辑，歌手/专辑可进入详情；多歌手可选择，歌手详情有歌曲和专辑切换标签，专辑继续进入歌曲列表，返回保留焦点且不会重启播放。专辑列表展示 Source 协议返回的全部条目，不额外推测来源未提供的分页接口。
- 浏览页面底部可直接喜欢/取消喜欢歌曲，实心爱心表示已喜欢，和播放页/菜单同步；歌词页只保留大封面下方的收藏入口。歌手与专辑通过焦点高亮表示可操作，不使用文字下划线；详情名称只在页头显示一次。进度条以圆点标识当前位置，遥控器焦点显示在圆点上。
- 设置支持深色 / 淡色主题、简体 / 繁体中文，立即切换并持久保存；语言资源按 JS 文件独立维护，详见 [主题与语言](docs/localization.md)。
- 播放按钮、导航、歌词及启动图标采用内置 SVG / Android Vector；大屏字号、长标题截断、独立滚动区和输入弹层保持操作按钮可见。
- 固定画布等比缩放，遥控器/键盘/鼠标共用焦点，弹窗焦点恢复与确认退出，侧边栏显示偏好由 Go 持久化。
- 列表弹窗默认聚焦第一项，音乐源选择默认聚焦并滚动到当前来源，空列表和确认弹窗默认聚焦返回/取消；侧栏底部下移进入封面，歌曲行左移返回侧栏，区块间往返恢复原位置。浏览页播放栏左右键切换控件，歌词页左侧控制区支持上下切换与右侧歌词区往返，进度调整通过确认键打开，全屏歌词位于控制区最后一个 SVG 图标。扫码登录的二维码和提示居中，长提示可通过遥控器滚动，取消按钮保持可见。
- Go 管理音频租约、Range 代理和跨主机重定向请求头隔离；页面不会拿到上游音频 URL/凭证。
- Android 前台服务管理 Go 子进程和 Media3 音频播放、系统媒体会话、音频焦点、后台播放。动态端口、显式 readiness、父进程检查、退出/任务移除清理，无开机自启。

## 平台边界

目录完整展示，**收录、安装、登录、实机播放是不同验证阶段**，安装成功不代表所有插件功能可用。当前不会启动插件携带的桌面程序：依赖 ffmpeg、yt-dlp、osascript 或平台 helper 的分支会返回能力错误。纯 HTTP 插件也可能需要账号、服务权限或特定音频格式。

二维码登录已提供。独立网页 Cookie 登录与手机 OAuth 回调还需要按插件适配。远端设备沿用插件的 remote 协议，依赖外部设备与服务可用性，不等同于电视本机播放。源码安装不能替代插件自身需要的构建产物；选择的上游 release 必须包含可运行 JS/TS。

长文本目前通过系统输入法或直接键盘输入，尚未提供手机扫码输入。

当前未声称 Android 6 实机输入、真实账号同步或所有在线源可播放。详细证据见 [迁移方案](docs/migration-proposal.md) 与 [目录声明快照](docs/evidence/plugin-catalog-2026-11-11.json)。

## 检查与 Android 编译

```sh
python3 scripts/validate_tv_app.py
go test -mod=vendor -race ./core/internal/...
npm ci
npx playwright install chromium
npm test

# JDK 17、Android SDK 35、NDK 27.2.12479018、Gradle 8.9
export ANDROID_HOME=/path/to/android-sdk
bash scripts/build_android_binaries.sh
gradle -p android testDebugUnitTest lintDebug assembleDebug
python3 scripts/verify_apk.py android/app/build/outputs/apk/debug/app-debug.apk
```

GitHub 私有仓库 [aston314/mygo-music-tv](https://github.com/aston314/mygo-music-tv) 的 [CI](https://github.com/aston314/mygo-music-tv/actions/workflows/ci.yml) 执行上述 Go/浏览器/Java/Android 检查并编译 arm64-v8a、armeabi-v7a、x86_64。CI 不把 APK 上传成临时 Actions artifact。尚未配置正式签名、公开下载仓库或应用更新渠道；未创建发布标签。

产品身份、ABI、画布和插件兼容版本保存在 `app.json`。应用版本独立于上游插件 `minAppVersion`。

## 协议入口

核心只绑定 loopback。API 使用 HttpOnly 会话 Cookie 或本机 bearer 凭证，并校验浏览器 Origin。`/health` 明确返回 readiness 与能力；`/api/catalog` 管理目录；`/api/plugins/install` 和 `/api/jobs/{id}` 管理安装；`/api/plugins/updates`、`check-updates` 与 `update` 管理插件检查和更新，详见[插件更新及国内下载回退](docs/plugin-updates.md)；`/api/sources/{instance}/call/{method}` 保持 Source 协议（登录/stream 走专用入口）；`/api/player/*` 管理规范化播放状态；`/media/{lease}` 提供可撤销媒体流。

## 许可证

AGPL-3.0。原始代码归属、移植范围与依赖补丁见 [NOTICE.md](NOTICE.md)。
