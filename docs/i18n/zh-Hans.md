# Pluck in Simplified Chinese (zh-Hans)

How Pluck's product words are said in Simplified Chinese for mainland China, and why. Every catalog in `packages/i18n/messages/*/zh-Hans.json` and the store listing in `docs/store/zh-Hans.json` follow this page.

Sources checked: Safari 阅读列表 (Reading List) and Apple Reminders/Notes in zh-CN, Todoist's zh-CN help centre (收件箱, 标签), Gmail zh-CN (收件箱, 归档), Readwise Reader's location names as described in Chinese (收件箱 / 稍后读 / 归档), Pocket's Chinese edition (稍后读, 归档), Notion zh-CN (收件箱, 标签), Claude's zh-CN help centre (连接器, 自定义连接器), sspai.com's read-it-later coverage, and mainland App Store read-it-later apps (只读, 阅读列表, InfoFlow), which describe themselves with 稍后读, 稍后阅读, 网页剪藏 and 离线阅读.

## Product words

| English | 简体中文 | Why | Seen in |
|---|---|---|---|
| Pluck (the brand) | Pluck | Stays in Latin letters everywhere, with a space either side when it sits in Chinese text. | — |
| pluck (verb) | 摘下 / 摘（短句里用“摘”） | 摘 is the literal "pluck" (摘苹果, 摘花): one hand, quick, light, which is the feel of the English. It keeps clear of 保存/收藏/书签 (saved, bookmarked) that the English avoids on purpose. "pluck into a List" is 摘进清单. | No comparable app has its own verb; Pocket and Safari say 保存/添加到阅读列表, which is what we avoid. |
| Plucked (confirmation) | 已摘下。 | The standard zh-CN past-state pattern (已发送, 已拷贝, 已归档). | Apple and Gmail confirmations |
| Pluck it (button) | 摘下来 | Spoken and a little warm, like the English. Used for the paste box, the hero line and the web top bar. | — |
| Plucking… | 正在摘下… | The zh-CN progress pattern (正在载入…). | Apple |
| a pluck / plucks (noun) | 摘下的内容, or a count: 3 条 | Chinese has no natural noun from 摘; the counter 条 does the work. | — |
| Item | 条目 (counter 条, sometimes 个条目) | Neutral, used for entries in lists of things. Not 收藏 or 书签. | Notion, many zh-CN list UIs |
| Kind | 类别 | "Category" without sounding like a folder or a file type (类型 reads technical). | — |
| Read | 阅读 | The English Kinds are verbs; 阅读 and 观看 keep that. | Safari 阅读列表 |
| Watch | 观看 | Pairs with 阅读. | — |
| PDF | PDF | Unchanged. | — |
| Image | 图片 | The everyday word. | Apple, WeChat |
| Note | 笔记 | The everyday word for a note you write. Apple's app is 备忘录, but 笔记 is what people call a note. | Notion, Readwise (笔记) |
| Todo | 待办 | The standard word. | Microsoft To Do (待办事项), Chinese task apps |
| Thing | 物品 | Something to get or buy. 东西 is too vague for a label; 物品 reads like "an object on a list". | Shopping and packing list apps |
| Inbox | 收件箱 | Universal. | Gmail, Todoist, Notion, Readwise |
| Later | 稍后 | Short, matches 稍后读/稍后阅读, which every read-later app in China uses. | Pocket, Readwise, App Store category |
| Archive / Archived | 归档 / 已归档 | Universal. Expiry copy says 移到归档，不会删除任何东西. | Gmail, Pocket |
| Done | 完成 (button) / 已完成 (status) | Apple's button word and Reminders' status. | Apple, Todoist |
| Tag | 标签 | Universal. "Tag it" is 打标签. | Gmail labels, Todoist, Notion |
| List | 清单 | Warmer than 列表: a list you are making (购物清单, 阅读清单, 旅行清单). Not 收藏集 (collection) or 文件夹. Generic UI lists (the shortcut list) stay 列表. | Everyday use (购物清单, 阅读清单); Apple Reminders says 列表, which we keep for generic UI lists |
| Status | 状态 | Standard. | — |
| your AI | 你的 AI | Literal and natural. "AI tools" is AI 工具. Vendors are always named as examples, never alone. | — |
| connector | 连接器 | Claude's own zh-CN term (自定义连接器). | Claude help centre zh-CN |
| Bin | 回收站 | What Chinese users call it on every desktop OS. | Windows, many apps |
| Highlight | 高亮 | Universal for read-later apps. | Readwise, Raindrop |
| kept page | 留存的网页 / Pluck 留下的网页 | 留 (keep) instead of 保存 (save). "The page is kept" is 网页已留下. | — |
| Touch / untouched | 动过 / 没动过 | Spoken, short and exact: "30 天没动过". | — |
| Expiry | 到期 | Neutral; never 清理 or 自动删除. | — |
| Archive it all. No, really. | 全部归档。说真的。 | Keeps the dry joke; 说真的 is "seriously". Same pattern for 全部删除。说真的。 | — |
| Digest / weekly email | 每周邮件 | Plain; not 周报 or 摘要. | — |
| Handle | 用户名 | No natural Chinese word separates "handle" from "username"; 用户名 with the @ is what Chinese social apps show. | Weibo, GitHub zh |
| Email-in | 邮件摘入 | Short label in the same family as 摘下. | — |
| library | 资料库 | Neutral, holds everything. Not 收藏库. | Apple (资料库 in Photos, Music) |
| Shared with you / see only | 与你共享 / 仅可查看 | Apple's and Google's zh-CN wording. | iCloud, Google Docs |
| Public / Private | 公开 / 私密 | Standard. | — |
| Sign in / Sign out | 登录 / 退出登录 | Standard. | Apple, WeChat |
| Copy (web) / Copy (iPhone) | 复制 / 拷贝 | The web uses 复制, the iPhone uses Apple's 拷贝 so the app matches iOS. | Apple zh-CN, Chrome zh-CN |

## Words we kept away from

- 保存, 收藏, 书签 for plucking. 书签 only appears where the English means real browser bookmarks (importing a bookmarks HTML file), and 个人收藏 only as Apple's own name for share-sheet favourites. The store keywords leave 收藏 and 书签 out too.
- 智能, 魔法, AI 驱动. Pluck has no AI inside; the copy says so.
- 存储 appears once, on the iPhone's generic Save button, because that is Apple's button word. The web uses 保存 for the Save button and "Saved" note state, as the English does.

## Tone

- Address the reader as 你, never 您. Pluck's English is short, plain and warm; 您 would make it a bank. Apple and most mainland consumer apps use 你.
- Short sentences. Buttons are two to four characters where that reads naturally (摘下来, 留着, 放下吧, 先不了).
- Keep the jokes where they land in Chinese ("没了。好吧，是归档了。", "摘吧，算我一个" / "不摘，谢谢", "一点碎屑都没拿。"). The cookie buttons are quoted verbatim in the privacy policy, so change both together.
- No exclamation marks of any kind (neither ! nor ！), no emoji.
- The welcome email is Niall writing in Chinese: first person, plain, signed "Niall".

## Typography

- Full-width punctuation: ，。；：？（）、 and Chinese quotes “” (‘’ inside). Book titles are not used.
- A space between Chinese and Latin letters or digits (Pluck 的, 30 天, API 密钥), as sspai, Notion and most mainland tech copy do. No space next to full-width punctuation.
- Ellipsis: a single … in UI progress labels (正在摘下…), matching Apple's zh-CN UI; …… is not used in short labels.
- Product words have no capitals in Chinese. Where English capitalises a status or button in running text, Chinese quotes it instead when it is a button or a screen name (轻点“分享”, 设置的“到期与归档”).
- Plurals: Chinese has only `other`. Exact matches (`=0`, `=1`) are kept where the one-item sentence reads differently.
- Dates: 2026 年 10 月 24 日; weekdays come from the formatter (星期一).
- Settings paths use > (设置 > AI 工具 > 断开连接), as Apple's zh-CN help does.

## Legal pages

Privacy and Terms are translated conservatively and in full: every obligation, time limit (30 天, 90 天, 3 个工作日, 16 岁) and name (Codú Limited, Data Protection Commission) is kept. The translation notice says the English version applies if they differ.
