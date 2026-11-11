# 主题与语言

设置支持深色 / 淡色主题和简体中文 / 繁体中文。Go 的 `preferences.json` 保存 `theme`（`dark` / `light`）和 `language`（`zh-CN` / `zh-TW`）；校验、写入成功后界面才切换。旧配置默认深色、简体中文。

## 独立语言资源

- `ui/locales/zh-CN.js`：简体中文界面文案与默认回退。
- `ui/locales/zh-TW.js`：繁体中文界面文案。
- `ui/i18n.js`：选择语言、查找文案和回退逻辑，不存放翻译字典。
- `core/internal/i18n/zh_cn.go` / `zh_tw.go`：核心及插件宿主的对应语言资源。
- Android 的 `res/values/strings.xml` / `res/values-zh-rTW/strings.xml`：原生启动、退出和通知文案。

Web 界面使用 `tr('简体文案')` 查找当前语言资源。新增文案时同步维护两个 JS 文件；静态 HTML 通过 `data-i18n`、`data-i18n-aria-label` 等属性标记。应用弹窗使用 `dialog` 翻译标题，内部状态仍保留稳定标识；音乐源提供的标题直接用 `modal` 展示。

歌曲名、歌手、专辑、歌词、评论及插件提供的内容保持原文，不做整个 DOM 的简繁转换。两份 JS 语言资源随共享 Web UI 打包，可复用于之后的平台壳。缺少繁体条目时先回退到简体，未知键保留原文。

## 外观与启动

淡色主题使用通透白色、深色文字与少量珊瑚红点缀；减少静态边框，在首页突出真实音乐封面，焦点通过轮廓与阴影保持清晰。CSS 使用显式颜色，兼容不支持 CSS 变量的旧 WebView。

浏览器缓存和 Android SharedPreferences 仅用于首帧外观；连接后以 Go 配置为准。Android 原生启动页、退出弹窗及通知使用缓存中的语言和主题，避免动态端口导致设置丢失。

运行 `npm run check`、`npm test` 和 `go test -mod=vendor -race ./core/internal/...`。浏览器检查覆盖两种主题和两种语言、刷新恢复、快速选择、保存失败、焦点、界面资源覆盖及原始音乐内容保护；Android 单元测试、lint 与构建由 CI 执行。
