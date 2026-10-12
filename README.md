# ハマトド

ホコ（生殖器）の大きさで序列が決まる架空の海獣「ハマトド」の群れで、一頭のオスとして生き、血統を何世代も残していくブラウザゲーム。

- 遺伝：二倍体・XY、組換え、突然変異、Y 連鎖、性限定発現、致死のスーパージーン、近交弱勢
- 繁殖：精子の産生と枯渇、精子競争（くじ引き）、ハーレムの見張りの限界、メスの移動
- 見た目：ドット絵（ENDESGA 32 パレット、手打ちスプライト）

設計の詳細は [docs/DESIGN.md](docs/DESIGN.md)。

## 動かす

```sh
npm install
npm run dev      # http://localhost:5173/
```

## 開発

```sh
npm test         # 遺伝・群れのテスト
npm run typecheck
npm run build
npm run balance -- 1 150            # シード 1 で 150 年自動進行し、形質と個体数の推移を表示
node scripts/autoplay.mjs out 10    # dev サーバー起動中に、ブラウザで 10 年遊ぶスモークテスト
```

`preview.html` はスプライト一覧（開発用）。
