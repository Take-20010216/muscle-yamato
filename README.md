# MUSCLE YAMATO

筋トレ記録 PWA。Next.js 14 + Supabase（Auth/DB）で完全無料で動かせます。

- **3種類のセット記録**：NORMAL / DROP（2段固定） / SUPER（2種目固定）
- **自己ベスト**：種目ごとに「重量×回数」最大値を自動計算、更新時にお祝い演出
- **ルーティン**：自分専用のメニューを名前付きで保存・編集・削除
- **記録の削除**：種目削除（関連記録も連鎖削除）／ワークアウト記録単体削除
- **タイムライン**：投稿・いいね・コメント（自分の投稿/コメントは削除可）
- **会員登録**：ユーザー名＋パスワードのみ（メール不要）

---

## 1. Supabase プロジェクトを作る（無料）

1. https://supabase.com にサインアップ → **New project**
2. プロジェクト作成後 **SQL Editor** を開き、`supabase/schema.sql` の中身をコピペして **Run**
3. **Authentication → Providers → Email** を開き、**Confirm email** を **OFF** にする  
   （ユーザー名＋パスワード運用のため、確認メールを使わない）
4. **Project Settings → API** から以下をコピー：
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. ローカルで起動

```bash
cp .env.example .env.local
# .env.local に上の2つを貼り付ける

npm install
npm run dev
# → http://localhost:3000
```

最初に `/signup` でアカウント作成してください。  
ユーザー名は半角英数字・`_`・`-` のみ、パスワードは6文字以上。

## 3. Vercel にデプロイ（無料）

1. このディレクトリを GitHub にプッシュ
2. https://vercel.com にログイン → **Add New → Project** → リポジトリ選択
3. Environment Variables に下記を登録：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_AUTH_DOMAIN`（任意、デフォルト `muscleyamato.local`）
4. Deploy → 数十秒で公開

スマホで開き「ホーム画面に追加」するとフルスクリーンの PWA として動きます。

---

## ディレクトリ

```
app/
  page.tsx              ホーム
  login/ signup/        認証
  record/               ワークアウト記録（normal/drop/super）
  routine/              ルーティン作成・保存・編集・削除
  stats/                統計（今週ボリューム / 履歴 / 自己ベスト一覧）
  timeline/             投稿・いいね・コメント
  settings/             プロフィール / 種目管理 / ログアウト
components/
  BottomNav.tsx         iOS風タブバー
  ExercisePicker.tsx    種目選択 + 追加 + 削除モーダル
lib/
  supabase/             SSR/CSR/middleware 用クライアント
  auth.ts               username → email 変換
  types.ts              型定義（SetType / BodyPart など）
  utils.ts              日付フォーマット / setScore
supabase/
  schema.sql            一発で流し込むスキーマ + RLS + トリガ
middleware.ts           未ログインを /login にリダイレクト
```

## 自己ベスト判定ルール

- 1セットあたりの **重量 × 回数** が同一種目の過去最大を超えたら「自己ベスト更新」
- DB ビュー `personal_bests` で全ユーザー × 全種目を1クエリで取得可能
- 例: `100kg × 8回 (=800)` > `100kg × 5回 (=500)` → 更新

## 既知の注意

- `NEXT_PUBLIC_AUTH_DOMAIN` は実在ドメインにしないこと（パスワードリセット等で誤送信されない）
- 種目を削除すると、その種目を参照する全 `workouts` / `routine_items` / `personal_bests` も連鎖削除
- ワークアウトをタイムラインへ投稿すると、その記録を消しても投稿は残る（`workout_id` が NULL になる）
