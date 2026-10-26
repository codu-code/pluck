---
title: 내 Pluck을 직접 운영하세요.
description: docker compose 한 번, RAM 1GB, 그리고 내 서버에서 도는 같은 앱. 귀찮은 부분까지 전부 담았어요.
keywords: 셀프호스팅 나중에 읽기, Pocket 대체 셀프호스팅, 나중에 읽기 도커, 셀프호스팅 북마크 관리, 오픈소스 나중에 읽기 서버
---

getpluck.io의 Pluck은 무료예요. 같은 코드가 내 서버에서도 돌아가고, 시작은 명령어 하나예요.

전부 적었어요. 귀찮은 부분까지요.

![Pluck을 시작하는 터미널, 그리고 홈 서버 주소에서 돌아가는 같은 수신함.](/blog/run-your-own-pluck/hero.png)

## 필요한 것

Docker, 그리고 vCPU 1개와 RAM 1GB짜리 기계. 작은 VPS, 오래된 노트북, TV 밑에서 먼지 쌓인 박스, 다 돼요.

## 시작하기

```
git clone https://github.com/codu-code/pluck
cd pluck
docker compose up -d
```

http://localhost:3000 을 여세요. Pluck은 이메일로 보낸 링크로 로그인해요. 새로 설치한 상태라면 그 이메일은 내장 메일 캐처인 http://localhost:8025 로 가요. 써 보는 데 메일 서버는 필요 없어요.

## 돌아가는 것

Docker 이미지 하나를 두 번 띄워요. 하나는 앱을 제공해요. 다른 하나는 워커예요. 페이지를 읽고, 밤사이 손대지 않은 항목을 보관함으로 옮기고, 월요일 이메일을 보내고, 휴지통을 비워요.

그 옆에는 라이브러리를 위한 MongoDB, 담아 둔 페이지와 파일을 위한 MinIO, 이메일을 받아 둘 Mailpit이 있어요.

## 진짜 주소에 올리기

앞에 HTTPS 리버스 프록시를 두고, compose 파일 옆 `.env` 파일에 이걸 설정하세요.

- `PLUCK_URL`, 쓸 주소.
- `SMTP_URL`과 `EMAIL_FROM`, 로그인 메일이 진짜 메일함에 닿도록.
- `S3_ACCESS_KEY`와 `S3_SECRET_KEY`, 기본값을 바꿔서.

공개 주소에서 기본 스토리지 비밀번호로는 Pluck이 시작하지 않아요. 일부러 그렇게 했어요. 모든 설정은 [셀프호스팅 가이드](https://github.com/codu-code/pluck/blob/main/docs/self-host.md)에 있어요.

## 앱 연결하기

- **iPhone.** 휴대폰에서 `pluck://signin?server=https://your.address` 를 여세요. 앱이 대신 내 서버에 로그인해요.
- **Chrome.** 스토어의 확장 프로그램은 getpluck.io하고만 통신해요. `PLUCK_SERVER=https://your.address pnpm --filter @pluck/extension build` 로 직접 빌드하고, “압축해제된 확장 프로그램 로드”로 불러오세요.
- **내 AI.** `https://your.address/mcp` 에 연결하세요. 서버에 공개 주소가 없다면 설정에서 API 키를 만들고 `npx @pluck/mcp --server https://your.address --key pk_live_…` 를 쓰세요.

## 귀찮은 부분

이메일로 담기를 쓰려면 내 도메인으로 오는 메일을 받아서 스토리지에 넣어 주는 서비스가 필요해요. compose 파일에는 없어서, 무엇을 설정해야 하는지는 가이드에 있어요.

백업은 직접 해야 해요. `mongo`와 `minio` 볼륨을 백업하세요. 그게 내 라이브러리 전부예요.

## 업그레이드

```
git pull && docker compose up -d --build
```

서버는 AGPL-3.0, 앱은 MIT예요.

저희가 멈춰도 내 Pluck은 멈추지 않아요.
