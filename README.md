# Online English Quiz - オンライン早押し英語クイズ

3人で対戦できるオンライン早押しクイズアプリケーションです。

## 特徴

- 🎯 リアルタイム同期（Supabase Realtime使用）
- 🚀 早押しボタンで競争
- 📱 複数デバイス対応
- 🎨 モダンなUIデザイン
- 🔊 効果音付き

## セットアップ

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com) でアカウントを作成
2. 新しいプロジェクトを作成
3. Settings > API から以下を取得：
   - Project URL
   - anon public key

### 2. 設定ファイルの作成

`config.example.js` を `config.js` にコピーし、Supabase認証情報を入力：

```bash
cp config.example.js config.js
```

`config.js` を編集：
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. ローカルで実行

シンプルなHTTPサーバーを起動：

```bash
# Python 3の場合
python3 -m http.server 8000

# Node.jsの場合
npx http-server
```

ブラウザで `http://localhost:8000` を開く

## デプロイ

### Vercelへのデプロイ

1. [Vercel](https://vercel.com) でアカウントを作成
2. GitHubリポジトリをインポート
3. デプロイ後、Vercelのファイルエディタで `config.js` を作成し、Supabase認証情報を設定

詳細は[デプロイメントガイド](implementation_plan.md)を参照してください。

## 遊び方

1. ホストがルームを作成（ブラウザでアプリを開く）
2. 表示されたURLを他のプレイヤーに共有
3. 3人揃ったら "Start Game" ボタンでゲーム開始
4. ホストが "Start Q" ボタンで問題を出題
5. 早押しボタンで回答権を獲得
6. 正解で +1点、不正解で -1点（次の問題は1回休み）

## 技術スタック

- HTML5 / CSS3 / JavaScript (Vanilla)
- [Supabase](https://supabase.com) - リアルタイム通信
- Web Audio API - 効果音

## ライセンス

MIT
