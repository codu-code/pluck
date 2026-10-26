---
title: 稍后读 App 一个接一个关门。
description: Pocket 没了。Omnivore 没了。把你的资料库交给下一个之前，先检查这五件事。
keywords: 开源稍后读, 自托管稍后读, Pocket 替代, Wallabag, Karakeep, Linkwarden
---

Omnivore 在 2024 年 11 月关闭，只提前了大约两周通知。Pocket 在 2025 年 7 月关闭，留了几个月导出。两者都装着人们好几年里打算读的东西。

两个都不是因为用户做错了什么才关门。一家公司做了决定，倒计时就开始了。

所以，在信任下一个之前，先检查五件事。Pluck 是我们做的 App，我们也拿这五条来要求它。

![一个资料库以能直接打开的文件离开 App：JSON、Markdown、一个 CSV 和一个 zip。](/blog/read-it-later-apps-keep-closing/hero.png)

## 1. 今天就能把所有东西拿出来吗？

不是“导出功能即将上线”。不是给客服发邮件。是今天就有一个按钮，和一个不用这个 App 也能打开的文件。

Pluck 的导出在设置里，一两分钟内，zip 的下载链接就会发到你的邮箱。里面是每个条目的 JSON，带着你的笔记和高亮，外加每个条目和每个清单各一个 Markdown 文件。任何一个清单也能在它自己的页面上下载为 Markdown。

## 2. 它留下的是网页，还是只有链接？

链接只在别人还维护着那个网页时才有用。网站会搬家、加上付费墙，或者干脆消失。

Pluck 在你摘下时就留下网页正文，所以网站没了，你的副本还在。网页读不出来时，Pluck 会直说，并提供 Wayback 的存档副本。

## 3. 代码公开吗？

如果代码公开，App 就能比公司活得久。有人可以 fork 它，你也能看清它拿你的数据做了什么。

Pluck 是开源的：服务端和 App 都用 Apache-2.0。

不过，公开代码也不是全部答案。Omnivore 也是开源的。

## 4. 自己运行它，会不会搭进去一个周末？

公司没了的时候，救你的就是这一条，所以运行你自己的副本必须是件平常事。

对 Pluck 来说，就是 `git clone`，然后 `docker compose up -d`。Web App、iPhone App 和你的 AI 都能连你的服务器，Chrome 扩展再多一条命令就能为它构建。[自托管指南](https://github.com/codu-code/pluck/blob/main/docs/self-host.md)讲了邮件、存储和扩展。

## 5. 你的 AI 是按你的规矩进来的吗？

迟早你会想让你的 AI 搜索、整理你的资料库。问题是谁说了算。

Pluck 内部没有 AI。你自己的 AI 工具通过开放标准 MCP，用一个链接连进来，你让它做什么它就做什么。它不能删除任何东西，也不能把清单公开，它建的每个标签和清单都有标记。详情见[连接你的 AI](/connect)。

## 其他选择

你应该多看看。几个不错的：

- **Wallabag** 是开源的，存在很久了。它是为在你自己的服务器上运行而做的，不想自己折腾的话也有付费托管。
- **Karakeep**（以前叫 Hoarder）是开源、自托管的，如果你配置了模型，里面还有 AI 打标签。
- **Linkwarden** 是开源的，会给你交给它的网页留一份副本。
- **Raindrop**、**Readwise Reader** 和 **Instapaper** 做得很精致，但都是闭源的。在撰写本文时，Raindrop 的 AI 连接器还是付费套餐里的测试版。

Pluck 的位置：在 getpluck.io 上免费使用，同样的代码能在你自己的服务器上跑，每个账号都带一个 AI 连接器。一个收件箱，装文章、视频、笔记、待办，还有你正琢磨要不要买的那台灶台。

## 如果你要搬家

Pluck 能导入 Pocket CSV、Omnivore zip、Raindrop CSV，以及你的浏览器导出的书签文件。所有东西都落进归档，都能搜到，所以你的收件箱一开始是空的。如果你留着 Pocket 的导出文件，[这是搬家指南](/blog/pocket-is-gone)。Omnivore 的话，[看这篇](/blog/omnivore-is-gone)。

先摘下，稍后再整理。
