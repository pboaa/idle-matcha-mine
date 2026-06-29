# 抹茶猫マイン ⛏️🐈

1匹の猫が自動でブロックを掘り進む放置採掘ゲー（モック）。ヴァンサバ風に武器・特殊能力が増えて派手になり、コイン／素材／熟練度で成長する。

抹茶猫カフェ（`idle-matcha-cafe`）から採掘部分だけを切り出した独立リポジトリ。

## 技術スタック
- React 19 + TypeScript(strict) + Tailwind v4 + Zustand
- Vite / Vitest / ESLint（クリーンアーキのレイヤー境界を `import/no-restricted-paths` で強制）

## アーキテクチャ
依存方向は **ui → state → application → domain（+ shared）** の一方向。tsx にロジックを書かず、UI は `@state` のセレクタ/フック経由で読む。

```
src/
  domain/        純粋ロジック・マスターデータ
    mining/      balance.ts(数値カタログ) / tile.ts(地形)
    grid/        position.ts(座標)
  application/   ゲームのシミュレーション（決定的・固定100msステップ）
    mining/      step.ts / mineState.ts / weapons.ts / upgrades.ts / prestige.ts
  state/         Zustand ストア＋ビューモデル（miningStore / miningSelectors / useMiningTick）
  ui/mining/     React コンポーネント（描画のみ）
  shared/        rng.ts(seed乱数) / format.ts
```

## 遊び方の要点
- 猫は前方ブロックを自動採掘。掘ると**ダメージは蓄積保存**、壊れると素材＋コイン＋XP。
- レベルアップで**3択**（自動モードは自動選択）。武器は最大6個、**強化(特殊能力)は無制限**に積める。
- **熟練度**はレベルアップで貯まり**転生しても消えない**永続強化。威力に加え**移動速度・射程**も永続で伸び、**周回を重ねるほど序盤がサクサク**になる（深い階は依然コツコツ）。
- コイン → 🔎目利き / 🔥採掘ブースト、素材 → 転生で恒久強化。
- 進行は localStorage に**自動セーブ**（リロード/タブを閉じても続きから）。工房から**データ削除**で最初に戻せる。

## コマンド
```bash
npm install
npm run dev        # 開発サーバ
npm run test       # 単体テスト（バランス監視テスト含む）
npm run lint
npm run build
```
