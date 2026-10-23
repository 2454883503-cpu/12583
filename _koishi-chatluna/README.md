# Koishi + ChatLuna

这里同时包含一个可复现 starter，以及两个完整上游源码快照（已去掉各自 `.git` 元数据，许可证原文保留）：

- `sources/koishi/`：官方仓库 [koishijs/koishi](https://github.com/koishijs/koishi)，`master` 快照 `97d5c395750cec37b772e0b94dc63c427e3bb868`，MIT。
- `sources/chatluna/`：官方仓库 [ChatLunaLab/chatluna](https://github.com/ChatLunaLab/chatluna)，`v1-dev` 快照 `819b7f337b70750503823ec38646ed03bb76f5c4`，AGPL-3.0。

## Starter 依赖兼容性

- `koishi` 4.18.11 — MIT
- `koishi-plugin-chatluna` 1.4.3 — AGPL-3.0
- `koishi-plugin-chatluna-storage-service` 1.0.7 — AGPL-3.0

ChatLuna 1.4.3 声明 Koishi peer 范围 `^4.18.9`，与 4.18.11 兼容。Storage Service 是 ChatLuna 可选 peer（`^1.0.6`），starter 显式固定 1.0.7。ChatLuna 需要 Node.js >=18。各上游许可证分别适用，本组合不重新授权；分发或修改组合部署前请审阅 AGPL-3.0 义务。

## 安装与启动

```sh
npm ci
npm start
```

`koishi.yml` 加载 ChatLuna 核心与存储服务。完整机器人仍需添加平台适配器、数据库，并在 Koishi 控制台配置 ChatLuna 模型提供商。不要把 API 密钥写入仓库，使用环境变量或部署平台的密钥管理。

Starter 发布包 SHA-256：

- `koishi-4.18.11.tgz`: `467F44D5C534F33244D70A43108EC44E5419D9AABCF2600AB991C464EDE39DB1`
- `koishi-plugin-chatluna-1.4.3.tgz`: `137E875B69E2DAB1893C0138D52FDEF9F9EABA4DAE4E9BC55CDD9EE8FBC377B6`
