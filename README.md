# 入居相談＆概算見積シミュレーター

デイサービス にじいろ 向けの入居相談・月額概算見積シミュレーター（MVP）です。
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
├── index.html        ... メインHTML（4画面構成）
├── styles.css        ... スタイルシート（3段階レスポンシブ）
├── app.js            ... アプリケーションロジック
├── config.json       ... 料金・FAQ・用語などの設定データ
├── nijiiro-logo.png  ... ロゴ画像
└── README.md         ... このファイル
```

## config.json の編集ガイド

| 変更内容 | 編集箇所 |
|---------|---------|
| 介護度別の基本サービス費 | `careLevels[].baseCareFeeMonthly` |
| 居住費（部屋タイプ別） | `roomTypes[].housingFeeMonthly` |
| 食費 | `meals[].mealFeeMonthly` / `meals[].addOnMonthly` |
| 生活支援オプション | `options[].feeMonthly` |
| 加算のON/OFF | `additions[].defaultOn` を `true` / `false` |
| 加算の金額 | `additions[].feeMonthly` |
| 負担軽減の割引率 | `burdenReduction.discountRate` |
| FAQ | `faq[]` の `question` / `answer`（先頭3件が表示） |
| 用語説明 | `glossary` のキーと値 |
| 持参書類 | `documentsToBring[]` の `label` / `note` |
| 注意事項 | `disclaimers[]` |

## 計算ロジック（概要）

```
介護保険自己負担分 = (基本サービス費 + 加算合計) × 自己負担割合
保険外費用 = 居住費 + 食費 + 食事形態加算 + オプション合計
月額合計 = 介護保険自己負担分 + 保険外費用
※ 10円単位で切り捨て
```

## 次の改善案

- [ ] PDF出力機能（html2pdf.js / jsPDF）
- [ ] LINE公式アカウント連携（結果送信）
- [ ] メール送信機能（SendGrid / Resend）
- [ ] 相談履歴の保存（localStorage / Supabase）
- [ ] 管理画面（config.json の GUI 編集）
- [ ] 複数施設対応
- [ ] アクセス解析（離脱ステップの把握）
