# ご利用料金 概算シミュレーター

デイサービス にじいろ 向けの利用料金シミュレーターです。
エリア・要介護度・自己負担割合から、「1日利用（夕食あり／なし）」と「1ヶ月宿泊」の概算料金を表示します。
面談時にPC/タブレットで使用し、ご家族がスマホで後から見返すことを想定した設計です。

## 起動方法

`config.json` を `fetch` で読み込むため、ローカルサーバー経由での起動を推奨します。

```bash
cd nijiiro_simulator

# Python 3
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

ブラウザで `http://localhost:8000` を開いてください。

## レスポンシブ対応方針

### ブレークポイント

| 区分 | 幅 | 主な調整 |
|------|-----|---------|
| Mobile | ≤ 600px | padding 24px、1カラム縦並び |
| Tablet | 601 〜 1024px | padding 32px、ロゴ大きめ、余白増 |
| Desktop | 1025px〜 | padding 40px、見出し拡大、余白最大 |

### レイアウト方針

- 基本1カラム構成（全デバイス共通）
- 最大横幅 **720px**（デスクトップでも広げすぎない）
- PC/タブレットでは余白を増やし、中央寄せで読みやすく
- 結果の内訳は **アコーディオン** で折りたたみ（スマホでもスクロール量を抑制）

### タッチ・操作性

- 全てのタップ領域は **最小44px以上**（ボタン min-height: 48px、選択肢 min-height: 48px）
- フォーム入力は縦並びを基本（スマホでも操作しやすい）
- 角丸UIで誤タップを防止

### タイポグラフィ

- フォント: **Noto Sans JP**（Google Fonts）
- 最小フォントサイズ: **16px**
- 見出し: font-weight 600 / 本文: font-weight 400
- 行間: **1.8**

## カラー

| 用途 | 色 |
|------|-----|
| 背景 | `#FFFFFF` |
| セクション背景 | `#F7F9F8` |
| メイン（ボタン・進捗） | `#8DBD3C` |
| アクセント（注意のみ） | `#D84F83` |
| 本文 | `#333333` |
| 補助テキスト | `#666666` |
| ボーダー | `#E5E5E5` |

## ファイル構成

```
nijiiro_simulator/
├── index.html        ... メインHTML（トップ・質問・結果。パスワード画面は github.io でのみ表示）
├── 404.html          ... 存在しないURLを開いたときの案内ページ
├── config.json       ... 料金・用語・お問合せ先などの設定データ
├── robots.txt        ... 検索エンジンのクロール拒否
├── favicon.ico       ... ブラウザのタブ用アイコン（慣例でルートに置く）
├── css/
│   └── styles.css    ... スタイルシート（3段階レスポンシブ）
├── js/
│   └── app.js        ... アプリケーションロジック
├── images/
│   ├── nijiiro-logo.png      ... ロゴ
│   ├── image_1.webp / image_2.webp ... 用語解説のイラスト
│   ├── ogp.jpg               ... OGP画像（LINE等で共有したときのカード画像）
│   └── icon-192.png / apple-touch-icon.png ... アイコン
├── htaccess.txt      ... 本番サーバーの .htaccess 用の設定（https転送・404・キャッシュ）
└── README.md         ... このファイル
```

## config.json の編集ガイド

料金はエリアごとに `areas[].pricing` へ持たせています。

| 変更内容 | 編集箇所 |
|---------|---------|
| エリアの追加・公開 | `areas[]` に `pricing` を追加し `available` を `true` に |
| 他エリアと同じ料金を使う | `areas[].pricingFrom` に参照先エリアの `id` を指定（独自料金にするときは `pricing` に置き換え） |
| 地域単価（1単位あたりの円） | `areas[].pricing.unitPrice` |
| 計算に使う時間区分 | `areas[].pricing.serviceTimeId`（`serviceTimes[].id` から選択） |
| 介護度別の単位数 | `areas[].pricing.serviceTimes[].units` |
| 昼食・夕食・宿泊代 | `areas[].pricing.fees` |
| 1ヶ月の日数・泊数 | `areas[].pricing.monthly` |
| 区分支給限度額（全国共通） | `careLevels[].limitUnits` |
| お問合せボタンの文言・リンク先 | `contact`（`url` を空にするとボタン非表示） |
| 用語説明 | `glossary` / `glossaryImages` |
| 持参書類 | `documentsToBring[]` |
| 注意書き・注意事項 | `notes` / `disclaimers[]` |

## 更新時の注意（キャッシュ）

- `config.json` は毎回サーバーに更新確認をするため、アップロードすればすぐ反映されます。
- `js/app.js` / `css/styles.css` を変更したときは、`index.html` 内の `?v=YYYYMMDD` の数字を更新してください（古いファイルが端末に残るのを防ぐため）。
- 本番サーバーの `.htaccess` は heteml の「アクセス制限」設定と共用です。上書きせず `htaccess.txt` の内容を追記してください。

## 計算ロジック（概要）

```
費用        = 単位数 × 地域単価（1円未満切り捨て）
利用者負担額 = 費用 −（費用 × 保険給付割合（1円未満切り捨て））

① 1日利用
  夕食なし = 利用者負担額 + 昼食代
  夕食あり = 利用者負担額 + 昼食代 + 夕食代

② 1ヶ月宿泊
  月間単位数 = 1日の単位数 × 日数
  限度額内   → 1〜3割負担
  限度額超過 → 全額自己負担（10割）
  月額合計 = 上記 + 宿泊代×泊数 + 昼食代×日数 + 夕食代×日数
※ 各種加算（入浴介助・処遇改善など）は含めていません
```

## 次の改善案

- [ ] PDF出力機能（html2pdf.js / jsPDF）
- [ ] LINE公式アカウント連携（結果送信）
- [ ] メール送信機能（SendGrid / Resend）
- [ ] 相談履歴の保存（localStorage / Supabase）
- [ ] 管理画面（config.json の GUI 編集）
- [ ] 北海道・静岡・福岡エリアの料金データ登録
- [ ] アクセス解析（離脱ステップの把握）
