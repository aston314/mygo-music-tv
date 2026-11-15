# My Music+ 0.1.5 发布记录

2026-11-15，正式版本 `0.1.5` / versionCode `17` 已从 `main` 标签 `v0.1.5` 构建。

- [GitHub Actions 正式构建](https://github.com/aston314/mygo-music-tv/actions/runs/43709327228)通过核心检查、167 项浏览器测试、Go race、Android 单元测试、lint、三 ABI 构建和签名校验。
- [公开正式版](https://github.com/aston314/my-music-release/releases/tag/v0.1.5)不是草稿或预发布，公开 `update.json` 已更新到 code 17。
- APK 大小 `25,482,182` 字节，SHA256 `ba651f28cf0b8de6209ce56babe41817c631ba659f88da1a6f17a02398d4b419`。APK 内签名证书与 0.1.4 一致，包含 `arm64-v8a`、`armeabi-v7a` 和 `x86_64` 三个核心架构。

154 在本轮发布时可以 ping 通，TCP 5555 端口可达，但 ADB 状态为 `offline`。因此本次没有对 154 执行正式版覆盖安装或发布后的真机回归。此前 `0.1.5-test.1` 已在 154 成功覆盖安装并确认深色焦点显示为圆角，向下移动流畅。向上单次按键延迟的 `test.2` 候选修复已完成 CI 和 APK 校验，等待设备恢复 ADB 后再做发布版实机核对。

公开稳定更新渠道没有发布测试包，仍使用原包名和签名，用户可以从设置中的版本更新获取正式版。
