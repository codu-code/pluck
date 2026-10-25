# Pluck in Korean (ko)

How Pluck's product words are said in Korean, and why. Use these in every catalog (`packages/i18n/messages/*/ko.json`) and in `docs/store/ko.json`. When a new string needs one of these words, use the word here, not a synonym.

## Product words

| English | Korean | Why | Seen in |
|---|---|---|---|
| Pluck (brand) | Pluck | The brand stays in Latin letters everywhere. Read as 플럭, so it takes the particles for a final consonant: Pluck은, Pluck이, Pluck을, Pluck으로, Pluck과. | Notion, Todoist, Gmail keep their names in Latin letters in Korean UI |
| pluck (verb) | 담다 (담기, 담아요, 담아 두세요) | "To put into", the everyday verb for a basket or a bag (장바구니에 담기). It is quick and physical like "pluck", and it is not 저장 (save), 북마크 or 스크랩, which the English avoids. The literal 뽑다/따다 read as "extract" or "pick fruit" and do not work as a button. | 장바구니에 담기 (Coupang, Naver Shopping, every Korean shop) |
| Pluck it (button) | 담기 | Shortest natural button. | as above |
| Plucked (confirmation) | 담았어요. | Past tense, polite, one word. | |
| a pluck (noun, a thing you plucked) | 담은 것, 담은 항목 | Korean has no handy noun from the verb; "what you plucked". | |
| Item | 항목 | The neutral word for one entry in a list; counted 항목 #개. Not 저장 항목 or 북마크. | Gmail (항목), Apple Reminders and Files (항목), Safari Reading List (항목) |
| Kind | 종류 | Plain "kind/sort". Not 유형 (type) or 카테고리, which the English avoids. | Apple Files (종류) |
| Read | 읽기 | Keeps the English verb feel; pairs with 보기. | Safari 읽기 목록 |
| Watch | 보기 | Pairs with 읽기. Only ever shown next to the other Kinds, so it does not read as the View menu. | |
| PDF | PDF | Unchanged. | |
| Image | 이미지 | Standard. | Apple Photos, Gmail |
| Note | 메모 | What Korean users call a note. | Apple 메모, Samsung Notes (삼성 노트, 메모) |
| Todo | 할 일 | Standard. | Todoist (할 일), Microsoft To Do (할 일), Apple Reminders |
| Thing | 물건 | A Thing is something to get or buy: 물건 is exactly that. 것 alone is too vague to be a label. | |
| Status | 상태 | Standard. | |
| Inbox | 수신함 | Pluck's Inbox is not mail, so not 받은 편지함 (Gmail, Apple Mail). Todoist's 관리함 reads as "management box". 수신함 ("where things arrive") is short, neutral and used for non-mail inboxes. | Things 3 (수신함), Todoist (관리함, its help centre), Gmail (받은편지함) |
| Later | 나중에 | The market already says 나중에 읽기 for read-later. Used as a name: "나중에로" is avoided; sentences say 나중에 볼 항목 or 나중에 보려고 남겨 뒀어요. | Pocket and Korean app store listings (나중에 읽기) |
| Archived (status) | 보관됨 | Gmail and Apple Mail call archive 보관 and the place 보관함. | Gmail (보관처리, 전체보관함), Apple Mail (보관) |
| Archive (place) | 보관함 | as above | as above |
| archive (verb) | 보관하다 | as above | as above |
| Done | 완료 | Status and button. | Apple Reminders (완료됨), Todoist (완료) |
| Tag | 태그 | Universal. Not 라벨 (Gmail's word), which the English avoids. | Apple Reminders and Notes (태그), Pocket, Notion |
| List | 리스트 | A List is a thing you make (a trip, a talk, a shopping list), and 리스트 is how Koreans say that kind of list (쇼핑 리스트, 위시리스트, 버킷리스트). 목록 is kept for the generic UI meaning, so "List" stays a distinct product word. Never 컬렉션 (Raindrop's word), which the English avoids. | Apple Reminders (목록), Spotify (플레이리스트), Raindrop.io (컬렉션, not used) |
| your AI | 내 AI | Korean UI says 내 for "your" (내 정보, 내 파일). In longer sentences, 쓰고 있는 AI ("the AI you use"). Never one vendor alone. | Naver (내 정보), Google (내 드라이브) |
| AI tools | AI 도구 | Standard. | Claude and ChatGPT Korean help |
| connector | 커넥터 | What Claude and ChatGPT call it in Korean. | Claude (커스텀 커넥터 추가), ChatGPT (커넥터) |
| Highlight | 하이라이트 | Standard in Korean reading apps. | the usual word in Korean e-book and reading apps |
| Bin | 휴지통 | Standard. | Gmail, Apple (휴지통) |
| Handle | 핸들 | YouTube Korea uses 핸들 for @handle. | YouTube (핸들) |
| Expiry | 자동 보관 | Untouched Items move to the Archive, so "automatic archiving" says what happens. 만료 sounds like deletion. | |
| kept page | 담아 둔 페이지 | Not 보관한 페이지, which would clash with the Archive. | |
| tick / ticked | 체크 / 체크함 | Korean checklists say 체크. | |
| Shared List, see only | 공유받은 리스트, 보기 전용 | Standard sharing words. | Google Drive (보기 전용) |
| Public / Private | 공개 / 비공개 | Standard. | YouTube, Naver Blog |
| Email-in | 이메일로 담기 | Says what it does. | |
| weekly email (Digest) | 주간 이메일 | The English UI already says "weekly email". | |
| Re-pluck | 다시 담기 | | |
| Archive it all | 모두 보관하기 | | |

Words the English avoids, and Korean avoids too: 저장 (save), 북마크 (bookmark), 스크랩 (clip), 컬렉션 (collection), 스마트 (smart), AI 기반 (AI-powered), 마법 (magic). Two exceptions, both outside the product's own voice: the import source "Browser bookmarks (HTML)" is 브라우저 북마크 (HTML), because that is what the file is; and the App Store keywords use the search words Korean users type (see below). 저장 is used only where the English itself says Save or store: the Save button, "Name saved", the note editor's Saved / Saving states (저장됨 / 저장 중), and the Privacy and Terms pages. Plucking is never 저장. 저장소 in the self-host copy means the code repository.

## Tone

- **Address:** polite 해요체 (담았어요, 해 보세요), the register of Korean consumer apps (Toss, Kakao, Apple Korea). No 합쇼체 (합니다) except where the English is legal: the Privacy and Terms pages use 합니다체, as Korean legal text does.
- **No pronoun "you":** Korean drops 당신. Use 내 (내 AI, 내 리스트) or nothing.
- **People:** a person's name or {sharer} takes 님 (Niall님, {sharer}님이). This also fixes the particle after a placeholder.
- **Placeholders and particles:** a particle after a {placeholder} depends on the word, so sentences are built so a placeholder is followed by a particle that does not change (에, 에서, 님이, 의) or by a noun (“{name}” 리스트).
- **Buttons:** noun form (담기, 보관하기, 삭제, 취소). Short.
- **Short and plain:** Pluck's English is short and warm; Korean keeps it short, drops subject words, and keeps the jokes where they land in Korean ("사라졌어요. 아니, 보관했어요.", "진짜로요.").
- **No exclamation marks, no emoji, no ~ and no ㅎㅎ.**
- **Expiry copy** always says the Item moves to the 보관함 and 삭제되지 않아요 (nothing is deleted).

## Punctuation and capitals

- Hangul has no capitals. Product words are not capitalised or quoted; Latin words (Pluck, PDF, MCP, iOS, Chrome) keep their English case.
- Sentences end with a full stop (.), as in Korean UI. Headlines keep the full stop where the English has one; labels and buttons have none.
- Quotes: the English “ ” curly quotes stay “ ”, which Korean uses for quoted speech and names.
- The middle dot (·) and the ellipsis (…) stay as in English.
- Numbers: counted with 개 (항목 3개), days 일 (30일), minutes 분, hours 시간. Dates come from the formatter. Times are 24-hour as in English (06:00).
- Plurals: Korean has only the `other` category; messages use `{count, plural, other {#개}}`.

## Store keywords

From what Korean users search in the App Store for this kind of app (Korean link apps list themselves as 링크 저장, 링크 모음, 스크랩, 나중에 읽기): 읽기목록, 링크저장, 아티클, 웹페이지, 스크랩, 오프라인, 리더, 메모, 할일, 리스트, 공유, 뉴스레터, 읽을거리, 웹클리퍼, 북마크, 기사, 링크모음, 독서, MCP. 나중에 읽기 is left out because it is already in the name, which the App Store indexes. These are search words, so 저장, 스크랩 and 북마크 are allowed here though the app's copy never uses them.
