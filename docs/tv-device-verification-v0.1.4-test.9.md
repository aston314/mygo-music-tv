# SHIELD 更新区间距验收 — 2026-11-13

## 修改与构建

- 设置的版本更新区增加操作行顶部间距，状态文字正常换行，两个主题共用；按钮焦点不改变布局。
- 版本 `0.1.4-test.9`，versionCode `13`，构建提交 `af3d48a`。
- [GitHub Actions 签名构建](https://github.com/aston314/mygo-music-tv/actions/runs/43261531153)成功，Go race、15 项脚本测试、149 项浏览器测试、Android 单元测试与 lint 通过；未在本机编译 APK。
- [草稿测试 Release](https://github.com/aston314/mygo-music-tv/releases/tag/untagged-d0f2cc999d0559e56b8c)保留 APK、update.json、SHA256SUMS；公共稳定更新清单保持 0.1.3/code4。
- APK `23,170,075` 字节，SHA256 `0978a488e91b6df0a74b1d3e406845e0170a259f098b7ee8d160bce49d144797`。下载后校验大小、散列、清单、证书及三个核心 ABI，通过；证书与原正式版一致。

## 117 真机结果

- `adb install -r` 成功，设备确认为 test.9/code13；首次安装时间仍为 `2026-11-11 22:17:13`。原账号、音乐源、语言和队列保留。
- NVIDIA SHIELD，Android 11，WebView 120.0.6099.230。测量使用 Android 1920×1080 的输入／无障碍坐标；截图文件为 3840×2160。
- test.8 中，状态文字底部 y=896，按钮顶部 y=894，边界重叠 2px。
- test.9 淡色主题：状态文字底部 y=860，按钮顶部 y=894，间距 34px；焦点外框与文字分离，按钮完整可见。
- test.9 深色主题：状态文字底部 y=926，按钮顶部 y=960，同为 34px；恢复淡色后间距不变。按键可经账号、语言、主题行往返，选中主题后保留焦点。
- 补充市场检查仍显示 67 / 67 个来源，市场未显示账号或底栏。
- 更多功能回归记录见 [test.8 补充检查](tv-device-verification-v0.1.4-test.8.md)。test.9 只修改更新区 CSS、版本和说明，未改变这些功能逻辑。

结束时恢复淡色、简体中文，停在版本更新区域的检查按钮，未留下音频播放。原始校验、CI 日志、间距测量 JSON、XML 和两主题截图在忽略目录 `build/tv-qa/spacing-test9/`。

网易云当前歌曲解析返回 -460，实际播放未验证成功；不将此次界面回归等同于音频、Android 6、其它电视平台或长期稳定性验收。电视上的官方断线→镜像代理故障注入尚未执行。
