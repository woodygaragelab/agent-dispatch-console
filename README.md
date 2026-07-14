# agent-dispatch-console

エージェント指示コンソール（Vite + React + Tailwind CSS）

## ローカル動作確認

```bash
npm install
npm run dev
```

## AWS Amplify Hosting へのデプロイ

1. このフォルダの中身をGitHubリポジトリにpushする（task-managerと同じ要領で新規リポジトリを作成）

   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/woodygaragelab/<リポジトリ名>.git
   git push -u origin main
   ```

2. AWS Amplifyコンソール (https://console.aws.amazon.com/amplify/) を開く
3. 「新しいアプリを作成」→「GitHubからデプロイ」を選択し、対象リポジトリ・ブランチ(main)を選択
4. ビルド設定は同梱の amplify.yml が自動検出されるのでそのまま進める
5. 「保存してデプロイ」を実行すると、以降 main ブランチへのpushのたびに自動ビルド・デプロイされる

## 補足

- リポジトリはprivateのままで問題ありません（Amplifyの連携時にGitHub認証で接続すればアクセス可能）
- カスタムドメインを使う場合は、Amplifyコンソールの「ドメイン管理」からRoute 53のホストゾーンと紐付け可能です
