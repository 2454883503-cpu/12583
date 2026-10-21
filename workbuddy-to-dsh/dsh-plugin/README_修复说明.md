# WorkBuddy → DSH：渠道拒绝诊断补丁

适用：上传版本 `dsh-plugin` 1.7.0；Node.js >=18。

## 本补丁修了什么
- 明确将 `Illegal API invocation from an unapproved channel` 归类为非重试的 `PROVIDER_ERROR`，不再当成推理档位/输出参数错误。
- 明确提示服务端拒绝当前接入渠道，并保留上游原始 `11128` 错误码。
- 同为 `11128` 但报 `first message is not system prompt` 的正常协议错误仍归类 `INVALID_REQUEST`。
- 加了两项基于模拟本地 HTTP 响应的回归测试；不联系真实 WorkBuddy，不消耗额度。

**重要边界：补丁不改变 WorkBuddy 的身份认证或渠道验证，不保证服务端允许第三方接入。**

## 安装（仅覆盖这两个源码文件）
1. 停止 DSH 插件所管理的本地桥及 DSH 客户端。
2. 对原插件的 `lib/adapter.mjs` 做备份（建议也备份整个插件目录）。
3. 在你自己的 `dsh-plugin` 根目录下解压此压缩包，覆盖 `lib/adapter.mjs`；`tests/adapter.test.mjs` 可选。
4. 在插件根目录执行 `node --test tests/adapter.test.mjs`，再重启 DSH。
5. 如需观察请求结构，在启动桥的环境配置中临时设置 `WORKBUDDY_LOG=1` 和 `WORKBUDDY_SHAPE=1`，复现一次后查看桥日志。关闭诊断开关以免产生冗余日志。日志勿对外分享敏感信息。

## 可区分的两类上游错误
- `400 / 11128 / Illegal API invocation from an unapproved channel`：上游拒绝接入渠道。请核查官方授权渠道与服务端政策，不应无限重试。
- `400 / 11128 / first message is not system prompt`：首条消息协议格式错误，可检查消息转换。

## 测试记录
- `node --test tests/adapter.test.mjs`：24 / 24 通过。
- 上传包缺少原完整仓库顶层 `dashboard/` 和 `lib/` 路径；完整测试需要完整仓库布局。
- 未进行真实 WorkBuddy 服务端请求，因此无法证明服务端渠道限制已解除。

## 隐私安全
原上传文件含 `.bridge-token` 和 `acl-recovery/` 文件。本补丁包没有纳入任何此类文件。请不要把真实凭据贴到公开仓库或 issue。
