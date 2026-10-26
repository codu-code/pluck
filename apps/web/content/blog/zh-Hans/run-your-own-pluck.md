---
title: 运行你自己的 Pluck。
description: 一个 docker compose，1 GB 内存，在你自己的服务器上跑同一个 App。从头到尾讲清楚，麻烦的部分也包括在内。
keywords: 自托管稍后读, 自托管 Pocket 替代, 稍后读 Docker 部署, 开源稍后读服务器, 自建稍后读
---

getpluck.io 上的 Pluck 是免费的。同样的代码也能在你自己的服务器上跑，一条命令就能启动。

下面是全部内容，麻烦的部分也包括在内。

![一个终端正在启动 Pluck，旁边是跑在家用服务器地址上的同一个收件箱。](/blog/run-your-own-pluck/hero.png)

## 你需要什么

Docker，以及一台 1 vCPU、1 GB 内存的机器。一台小 VPS、一台旧笔记本，或者电视柜里那个小盒子，都行。

## 启动

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

打开 http://localhost:3000。Pluck 用邮件里的链接让你登录；全新安装时，这封邮件会发到内置的邮件捕获器 http://localhost:8025。想试一试的话，不需要邮件服务器。

## 跑着的是什么

一个 Docker 镜像，启动两次。一份负责提供 App。另一份是 worker：它读取网页，每晚把没动过的条目移到归档，发送周一的邮件，并清空回收站。

旁边还有：MongoDB 放你的资料库，MinIO 放留下的网页和文件，Mailpit 负责接住邮件。

## 放到一个真正的地址上

在前面加一个带 HTTPS 的反向代理，然后在 compose 文件旁边的 `.env` 文件里设置这些：

- `PLUCK_URL`，你要用的地址。
- `SMTP_URL` 和 `EMAIL_FROM`，让登录邮件能送到真正的收件箱。
- `S3_ACCESS_KEY` 和 `S3_SECRET_KEY`，替换掉默认值。

如果用的还是默认的存储密码，Pluck 不会在公网地址上启动。这是故意的。[自托管指南](https://github.com/codu-code/pluck/blob/main/docs/self-host.md)列出了每一项设置。

## 让你的 App 指向它

- **iPhone。** 在手机上打开 `pluck://signin?server=https://your.address`。App 就会改为登录到你的服务器。
- **Chrome。** 商店里的扩展只连 getpluck.io。用 `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` 构建你自己的版本，再用“加载未打包的扩展程序”加载它。
- **你的 AI。** 把它连接到 `https://your.address/mcp`。如果服务器没有公网地址，在设置里生成一个 API 密钥，然后用 `npx @pluck/mcp --server https://your.address --key pk_live_…`。

## 麻烦的部分

邮件摘入需要一个服务，替你的域名接收邮件并放进存储。compose 文件里没有这个，所以指南会讲需要搭什么。

备份归你管。备份 `mongo` 和 `minio` 两个卷。那就是你的整个资料库。

## 升级

```
git pull && docker compose up -d --build
```

服务端和 App 都是 Apache-2.0。

就算我们哪天停了，你也不用停。
