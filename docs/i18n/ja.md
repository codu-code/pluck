# Japanese (ja) glossary

How Pluck says its product words in Japanese, and why. Translators and reviewers keep to this table in every catalog (`site`, `app`, `email`, `ios`, `extension`, `share`) and in the store listings (`docs/store/ja.json`).

## Product words

| English | Japanese | Why | Seen in |
|---|---|---|---|
| Pluck (brand) | Pluck | The brand stays in Latin letters everywhere, never プラック. | All brand names in Japanese UIs (Pocket, Notion, Todoist) stay Latin. |
| pluck (verb) | Pluckする | The brand as a verb, the way Japanese turns a name into a verb with する. Buttons say 「Pluckする」, sentences say 「Pluckしました」「Pluckしたもの」. Not 保存する: the English avoids "save" on purpose, and 保存 is what every other app says. When a sentence explains what plucking does, it uses 残す / 取っておく ("keep"), never 保存. | Pocket says 「Pocketに保存」; Safari 「リーディングリストに追加」. We keep the brand-verb instead, like Pluck's English does. |
| Plucked (confirmation) | Pluckしました。 | The polite past of the verb. Short enough for a toast and the share sheet. | Pocket's 「保存しました」 pattern, with the brand verb. |
| a pluck / plucks (noun) | Pluck（件数は「#件のPluck」） | Counted with 件, like mail and tasks. In sentences, 「Pluckしたもの」 reads more naturally than a bare noun. | Gmail and Todoist count with 件. |
| Re-pluck | もう一度Pluckする | Plain and literal. | — |
| Item | アイテム | The standard katakana word for one thing in a list or library. Counted with 件 (「3件」). | Pocket JP (アイテム), Raindrop.io, Apple Files. |
| Kind | 種類 | The everyday word for "what sort of thing". Not タイプ or カテゴリ (the English avoids Type and Category). | Apple Files and Finder (種類). |
| Read | 記事 | A Japanese Kind label is a noun, not a verb: 読む next to 画像 and メモ looks broken. 記事 is what Japanese read-it-later apps call web pages to read. | Pocket JP filters (記事, 動画), Instapaper JP reviews. |
| Watch | 動画 | Same reason; 動画 is the word for any video. | Pocket JP (動画), YouTube JP. |
| PDF | PDF | Unchanged. | Everywhere. |
| Image | 画像 | Standard. | Pocket JP, Google, Apple. |
| Note | メモ | Apple's Notes app is 「メモ」 in Japanese; ノート reads as a notebook. | Apple Notes (メモ), Google Keep (メモ). |
| Todo | ToDo | The usual Japanese spelling, used as-is in Japanese UIs. Plural is the same. | Notion JP (ToDoリスト), Todoist JP articles. |
| Thing | モノ | A Thing is something to get. Katakana モノ is the common word for physical goods and wish-list things, and reads as a label, not as the grammatical もの. | Japanese shopping and wish-list apps (欲しいモノ). |
| Links (Read, Watch, PDF, Image) | リンク | Standard. | — |
| Status | ステータス | Standard in Japanese software. | Notion JP, Todoist JP. |
| Inbox | インボックス | Pluck's Inbox is a triage place, like Todoist's, not a mailbox. 受信トレイ was considered (Gmail, Outlook), but it reads as email. | Todoist JP (インボックス), Notion JP. |
| Later | あとで | 「あとで読む」 is how Japanese people say read-it-later. As a status and tab, 「あとで」 alone. In a sentence it goes in brackets so it reads as a place: 「あとで」に移しました。 | Japanese read-it-later apps and articles (あとで読む), Hatena Bookmark (あとで読む). |
| Archive / Archived | アーカイブ / アーカイブ済み | The place is アーカイブ, the status アーカイブ済み, the button アーカイブ. | Gmail JP, Pocket JP. |
| Done | 完了 | The standard word for a finished task. | Todoist JP (完了したタスク), Apple Reminders (完了). |
| Tag | タグ | Standard. Not ラベル (the English avoids Label). | Pocket JP, Raindrop.io, Apple Reminders. |
| List | リスト | Standard. Never コレクション, which the English avoids on purpose (Raindrop.io calls its folders コレクション). | Apple Reminders (リスト), Safari (リーディングリスト). |
| Shared List | 共有リスト / あなたと共有 | 「あなたと共有」 is the iOS heading for things others shared with you. It is the only place あなた is used. | iOS Photos, Notes (あなたと共有). |
| Public / Private | 公開 / 非公開 | Standard. | YouTube JP, Notion JP. |
| Public page | 公開ページ | Standard. | Notion JP. |
| Handle | ハンドル | The public @name. ユーザー名 is avoided like "Username" in English. | — |
| Highlight | ハイライト | Standard. | Kindle JP, Raindrop.io. |
| Kept page | 残したページ | Follows "keep" = 残す. Not 保存したページ or キャッシュ. | — |
| Keep (an Item, so it does not expire) | 残す | Short, natural, and not 保存. | — |
| Touch / untouched | 触れる / 手つかず | 「30日間手つかず」 is the natural way to say "untouched for 30 days". | — |
| Expiry | 自動アーカイブ | Settings and the Archive filter say 「自動アーカイブ」. Not 期限: in Japanese 期限 is a deadline, and it already means a Todo's due date (「期限」「期限切れ」 = Due, overdue). Copy always says the Item moves to the Archive and nothing is deleted: 「アーカイブに移ります。削除はされません。」 | Slack JP (チャンネルの自動アーカイブ). |
| Due / overdue | 期限 / 期限切れ | Only for Todo due dates. | Todoist JP (期限), Apple Reminders. |
| Archive it all | すべてアーカイブ | Plain. The joke button reads 「本当に、すべてアーカイブする」. | — |
| Bin | ゴミ箱 | What Gmail and Windows call it. | Gmail JP, Windows. |
| Digest | 週1回のメール | The English UI says "the weekly email", so Japanese does too. Not ニュースレター. | — |
| Library | ライブラリ | Standard katakana, no long vowel at the end. | Apple Music and Photos JP (ライブラリ). |
| Email-in | メールでPluck | The feature is forwarding mail to Pluck. On an Item's site line it is 「メール経由」. | — |
| your AI | お使いのAI | お使いの… is how Japanese software says "your" without あなた. In buttons and titles, 「AI」 alone: 「AIと接続」. | Apple JP (お使いのiPhone), Google JP. |
| AI tools | AIツール | Standard. Always plural in spirit; never one vendor alone. When vendors are named, at least three: Claude、ChatGPT、Cursor. | — |
| Connector | コネクタ | The word Claude and ChatGPT use in Japanese for an MCP connection, without the long vowel. | Claude JP help (MCPコネクタ, カスタムコネクタを追加). |
| Connect / Disconnect | 接続 / 接続を解除 | Standard. | Apple, Google. |
| Sign in / Sign out | サインイン / サインアウト | Apple's spelling. | Apple JP. |
| by AI (mark) | AIによる | Short, neutral. | — |
| Tick (an Item on a List) | チェック | A checklist tick. 「12件中3件チェック済み」. | Apple Reminders. |

## Words we do not use

- 保存 (saved) for plucking. The English avoids "saved" for what Pluck does; Japanese uses Pluckする and 残す. 保存 appears only where the English itself says Save: the Save button, a note's "Saved" state, a name or handle being saved.
- ブックマーク (bookmark), except for the browser bookmarks file people import, which is what the English says too.
- コレクション, スマート, AI搭載 (AI-powered), 魔法 / マジック.

## Tone

- Polite です/ます in every sentence: 「アーカイブに移ります。削除はされません。」 Short, plain and warm, the way the English is. No keigo stacks (いたします, させていただきます): Pluck is a friend who makes a tool, not a bank.
- Buttons and labels are noun forms or short plain verbs: 「アーカイブ」「キャンセル」「Pluckする」「元に戻す」「リストを作成」. Confirming buttons that need a verb use the plain dictionary form: 「削除する」「許可する」.
- Avoid あなた in the product. Use お使いの… or leave the subject out, as Japanese does. The exceptions: the heading 「あなたと共有」 (as iOS says it), Privacy and Terms, where the legal text needs a clear "you", and the few marketing lines whose point is "yours" (「データはあなたのもの」「AIは、あなたが決める」).
- Headlines can be short phrases and end with 。 when they are a sentence: 「Pluckして、整理はあとで。」 Labels and tab names have no full stop.
- The jokes in English ("Gone. Well, archived." is 「片付けました。アーカイブにあります。」, "Pluck off", "No, really") are rewritten to work in Japanese, not translated word for word. Where a pun cannot survive, the line is plain and kind.
- The welcome email is Niall's own voice: polite, warm, first person (私), signed Niall.

## Typography

- Full-width 。、：？ and （）. No exclamation marks of any kind (! or ！), no emoji.
- Quotes are 「」; a quote inside a quote is 『』. They replace English “ ” and " ".
- No spaces between Japanese and Latin letters or numbers: 「Pluckしました」「30日」「AIツール」. Keep Latin product and vendor names as they are spelled.
- Numbers are half-width Arabic numerals (3件, 10分). Counters: 件 for Items, Plucks and results; 日 for days; 分 for minutes; 個 only for browser tabs (「5個のタブ」), as Chrome says it.
- Japanese has one plural form, so ICU plurals use only `other`. `#` is the number.
- Japanese has no capital letters, so product words are not marked by case. Status names that could read as ordinary words go in 「」 inside sentences (「あとで」); インボックス, アーカイブ and ゴミ箱 are clear without them.
- The middle dot separator ` · ` in meta lines is kept as it is in English.
- Keyboard keys (Alt+Shift+P, Esc, Enter, Shift+J), URLs, email addresses and code stay unchanged.
