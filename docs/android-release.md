# Android 电视测试版发布

私有源码仓库通过 [Android Release 工作流](https://github.com/aston314/mygo-music-tv/actions/workflows/release.yml) 构建、校验并发布签名 APK。默认手动发布为测试版；当前版本为 `v0.1.3` / versionCode `4`。从 `main` 手动运行，或推送与 app.json 一致且可追溯到 main 的版本标签。

## 填写签名项

在 [仓库 Actions Secrets](https://github.com/aston314/mygo-music-tv/settings/secrets/actions) 中编辑以下四项。它们是 Repository Secrets，不是普通 Variables。空占位项会让发布预检直接失败，不会创建标签或 Release。

| Secret | 填写内容 |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | 完整 Android release keystore 文件的 Base64 文本 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | keystore 中用于发布的密钥别名 |
| `ANDROID_KEY_PASSWORD` | 对应密钥的密码，通常与 keystore 密码一致 |

已有本项目发布签名时继续使用同一文件和别名。首次签名可在本机交互生成，密码不放在命令行或聊天中：

```sh
mkdir -p "$HOME/.mygo-signing"
keytool -genkeypair -keystore "$HOME/.mygo-signing/mygo-music-tv-release.jks" \
  -alias mygo-music-tv -keyalg RSA -keysize 3072 -validity 10000
```

Mac 上将完整文件的 Base64 复制到剪贴板，再粘贴到 `ANDROID_KEYSTORE_BASE64`：

```sh
base64 < "$HOME/.mygo-signing/mygo-music-tv-release.jks" | tr -d '\n' | pbcopy
```

该签名文件及密码需长期保存，后续覆盖安装必须沿用同一个签名。`.jks`、`.keystore` 与本地发布环境文件已加入忽略列表。GitHub 自带的 `GITHUB_TOKEN` 无需填写；当前私有发布不需要额外访问令牌。

## 构建与下载

填写完成后从 `main` 触发工作流。预检先验证版本、分支归属、签名项和 keystore。通过 Go race、浏览器测试、Android 单元测试和 lint 后构建非调试 release APK，再校验包名、版本、最低 SDK、应用名称、v1/v2 签名、证书指纹及三个 ABI。

Release 仅包含从同一份签名 APK 生成的文件：

- `mygo-music-tv-0.1.3.apk`
- `update.json`：大小、SHA256、证书指纹与版本信息
- `SHA256SUMS.txt`

临时 keystore 在任务结束时清除，不上传为 Actions artifact。私有 Release 需要登录后手动下载；当前不配置公开下载仓库或应用内升级地址。测试版可通过 U 盘或 ADB 安装到电视。已装过其他签名的 debug APK 时可能无法覆盖，应先确认其数据是否需要保留，再决定如何安装。

首次电视检查建议覆盖：核心启动、音乐源安装/更新、登录、连续切歌与暂停恢复、进度拖动、歌词同步、遥控器区块切换、后台播放及断网恢复。记录设备 Android/WebView 版本、来源仓库/版本和错误表现后再修复，不能仅凭解析音频地址判定播放成功。
