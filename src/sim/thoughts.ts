import type { Individual, Thought } from './individual';
import type { Rng } from './rng';

export type ThoughtKey =
  | 'winDisplay' | 'loseDisplay' | 'winFight' | 'loseFight'
  | 'takeHarem' | 'loseHarem' | 'mated' | 'matedMany'
  | 'groomedHoko' | 'groomedWound' | 'groomedFur'
  | 'hungry' | 'abandon' | 'seasonHappy' | 'seasonZero' | 'seasonSome'
  | 'sneakSuccess' | 'sneakCaught' | 'satelliteSuccess'
  | 'rivalBigger' | 'youngWatch' | 'peripheralIdle' | 'holderIdle'
  | 'fMoveCrowded' | 'fMoveAttracted' | 'fGroomHoko' | 'fGroomWound' | 'fGroomFur'
  | 'fGaveBirth' | 'fPupLost' | 'fMated' | 'fEstrus' | 'fProtest' | 'fIdle' | 'fAdmire'
  | 'pupIdle' | 'pupMilk'
  | 'orcaEscape' | 'fat' | 'thin' | 'holderFasting' | 'newHolderFemale'
  | 'fOrderedOk' | 'fOrderedNo' | 'fCourtNotYet' | 'fCourtAccept' | 'orderRefused' | 'courtRefused'
  | 'fTended' | 'fEscorted' | 'fSoothed' | 'tendDone' | 'sootheDone' | 'fBigPup';

type Mood = Thought['mood'];

interface Entry {
  mood: Mood;
  /** 気の強い個体用 */
  brash?: string[];
  /** 気の弱い個体用 */
  timid?: string[];
  any: string[];
}

const T: Record<ThoughtKey, Entry> = {
  winDisplay: {
    mood: 'happy',
    brash: ['見たか{other}。格が違うんだよ。', '{other}のやつ、ひと目見て逃げやがった。', '勝負にもならん。{I}のホコを見て出直せ。'],
    timid: ['……あれ、{other}が引いてくれた？', '見せただけで勝てた。心臓に悪い。'],
    any: ['{other}を見せ合いで退けた。', '{I}のホコ、今日も冴えてる。'],
  },
  loseDisplay: {
    mood: 'sad',
    brash: ['……今日は調子が悪かっただけだ。', '{other}め、覚えてろ。'],
    timid: ['{other}のは大きすぎる。無理です。', 'ひと目で分かった。負けだ。'],
    any: ['{other}のホコ、あれは反則だろう。', '見せ合いで負けた。比べるんじゃなかった。'],
  },
  winFight: {
    mood: 'happy',
    brash: ['{other}を叩きのめした！ ホコだけじゃないんだよ！', '体で分からせてやった。'],
    any: ['取っ組み合いで{other}に勝った。体じゅうが痛い。', '僅差の勝負だったが、勝った。'],
  },
  loseFight: {
    mood: 'sad',
    brash: ['くそっ、{other}め……次は負けん。'],
    timid: ['痛い……もう取っ組み合いはこりごりだ。'],
    any: ['{other}に組み伏せられた。傷が疼く。', '大きさは互角だったのに……'],
  },
  takeHarem: {
    mood: 'happy',
    brash: ['今日からこの浜は{I}のものだ！', 'ついに主だ。メスたちよ、ひれ伏せ。'],
    timid: ['えっ、{I}が主に？ 大丈夫かな……'],
    any: ['{other}から浜を奪った。', 'ハーレムの主になった。胸が熱い。'],
  },
  loseHarem: {
    mood: 'sad',
    any: ['{other}に浜を奪われた……', 'みんな、すまない。', '主の座から転げ落ちた。'],
  },
  mated: {
    mood: 'love',
    brash: ['また一頭。{I}の血は広がるばかりだ。'],
    timid: ['……ありがとう。'],
    any: ['{other}とつがえた。幸せだ。', '今日はいい日だ。'],
  },
  matedMany: {
    mood: 'love',
    brash: ['これで{n}頭目。{I}は浜の王だ。'],
    any: ['今年はもう{n}頭とつがえた。幸せだ。', '{n}頭……さすがに精が尽きてきた。'],
  },
  groomedHoko: {
    mood: 'happy',
    brash: ['{other}にホコを磨かせた。ツヤが違う。'],
    timid: ['{other}がホコの手入れをしてくれた。照れる。'],
    any: ['{other}がホコを手入れしてくれた。今日は映える。', 'ホコがぴかぴかだ。'],
  },
  groomedWound: {
    mood: 'happy',
    any: ['{other}が傷をなめてくれた。少し楽になった。', '傷の手当てがありがたい。'],
  },
  groomedFur: {
    mood: 'happy',
    any: ['{other}に毛づくろいしてもらった。極楽だ。', '背中がかゆいところに届く。いい子だ。'],
  },
  hungry: {
    mood: 'sad',
    any: ['腹が減った。でも浜を離れたら終わりだ。', '何日食べていないだろう。'],
  },
  holderFasting: {
    mood: 'neutral',
    any: ['痩せてきた。だが目は離せない。', '海の匂いがする。……いや、まだだ。'],
  },
  abandon: {
    mood: 'sad',
    any: ['もう限界だ。海へ帰る。', '体がもたない。浜は誰かにくれてやる。'],
  },
  seasonHappy: {
    mood: 'happy',
    any: ['今年は{n}頭とつがえた。いい一年だった。', '{n}頭。悪くない。来年もこうありたい。'],
  },
  seasonSome: {
    mood: 'neutral',
    any: ['今年は{n}頭。まあ、ぼちぼちだ。', '{n}頭とつがえた。贅沢は言うまい。'],
  },
  seasonZero: {
    mood: 'sad',
    brash: ['来年こそは……！', '今年は誰ともつがえなかった。屈辱だ。'],
    timid: ['今年も誰とも……', 'まあ、生きてるだけで丸もうけ。'],
    any: ['ホコがすべてじゃない。……すべてじゃないよな？'],
  },
  sneakSuccess: {
    mood: 'scheme',
    any: ['誰も{I}をオスだと思ってない。好都合だ。', 'ふふ、主は今ごろ何も知らずに寝ている。', 'メスのふりも楽じゃない。でも成果はあった。'],
  },
  satelliteSuccess: {
    mood: 'scheme',
    any: ['ボスが喧嘩してる。今だ！', '主のおこぼれ、ありがたくいただいた。', '付き従った甲斐があった。'],
  },
  sneakCaught: {
    mood: 'sad',
    any: ['ばれた！ 尻を噛まれた。', '{other}に見破られた。逃げろ！'],
  },
  rivalBigger: {
    mood: 'angry',
    any: ['{other}のホコ、去年より育ってないか……？', 'あいつのは{I}より少し大きい……いや、気のせいだ。'],
  },
  youngWatch: {
    mood: 'neutral',
    any: [
      'いつか{I}もあんなホコに……',
      '大人たちは何を比べているんだろう。',
      'ボスってかっこいいな。',
      '{I}のホコ、まだ育つよな？',
      '波打ち際は落ち着く。大人は怖い。',
      'あのメス、こっちを見た気がする。',
      '今日も見てるだけ。でも覚えたことはある。',
    ],
  },
  peripheralIdle: {
    mood: 'neutral',
    brash: ['どいつもこいつも、今に見てろ。', 'あの主、最近痩せてきたな。狙い目だ。'],
    timid: ['浜の端っこが落ち着く。', '目を合わせないようにしよう。'],
    any: ['チャンスを待つ。', '主たちの様子をうかがう。', '見張りの外にいるメスはいないか。', '砂が熱い。'],
  },
  holderIdle: {
    mood: 'neutral',
    brash: ['この浜に{I}より立派なホコはない。', '挑みたいやつはいつでも来い。'],
    any: ['みんな元気そうだ。', '見張りは疲れる。', 'あの若いの、さっきからこっちを見ている。', '目を離すとすぐに誰か寄ってくる。'],
  },
  fMoveCrowded: {
    mood: 'sad',
    any: ['ここは騒がしすぎる。子が踏まれる前に移ろう。', '押し合いへし合い、もううんざり。'],
  },
  fMoveAttracted: {
    mood: 'love',
    any: ['{other}のところ、居心地が良さそう。', '{other}……悪くないわね。'],
  },
  fGroomHoko: {
    mood: 'neutral',
    any: ['今日もボスのホコを磨いてあげた。まんざらでもない顔。', 'ホコの手入れ。これも務めのうち。', 'ツヤが出てきたわ。わたしの腕前ね。'],
  },
  fGroomWound: {
    mood: 'neutral',
    any: ['ボスったらまた傷だらけ。', '無茶ばかりするんだから。'],
  },
  fGroomFur: {
    mood: 'neutral',
    any: ['毛づくろいしてあげた。いびきをかいてる。', '背中の砂を払ってあげた。'],
  },
  fGaveBirth: {
    mood: 'love',
    any: ['生まれた！ この子は{other}って名前にしよう。', 'かわいい……{other}、元気に育ってね。'],
  },
  fPupLost: {
    mood: 'sad',
    any: ['あの子が……オスたちの喧嘩に巻き込まれて……', 'もうあんな騒がしい所にはいられない。'],
  },
  fMated: {
    mood: 'neutral',
    any: ['{other}とつがった。', 'まあ、{other}なら。'],
  },
  fEstrus: {
    mood: 'love',
    any: ['なんだか落ち着かない。', '今年は誰の子を産もうかしら。'],
  },
  fProtest: {
    mood: 'angry',
    any: ['ちょっと！ 誰よあんた！', '{other}、勝手に寄ってこないで！'],
  },
  fIdle: {
    mood: 'neutral',
    any: [
      'お日さまが気持ちいい。',
      'ボスは強いけど、あの若いのも悪くない。',
      '早く海に戻りたい。',
      'となりの子、寝相が悪い。',
      'オスってどうしてああなのかしら。',
      'ここの砂はあったかい。',
    ],
  },
  fAdmire: {
    mood: 'love',
    any: ['うちのボス、今日のホコは立派だったわ。', '{other}が勝った。さすがね。'],
  },
  newHolderFemale: {
    mood: 'neutral',
    any: ['主が{other}に替わった。……まあ、いいけど。', '新しいボスは{other}か。様子を見よう。'],
  },
  fOrderedOk: {
    mood: 'neutral',
    brash: ['はいはい、ボス。ご命令とあらば。', 'しょうがないわね、今日だけよ。'],
    any: ['ボスに呼ばれた。はいはい、ホコね。', 'ボスったら甘えん坊なんだから。', '{other}の世話も楽じゃないわ。'],
  },
  fOrderedNo: {
    mood: 'angry',
    any: ['今はそんな気分じゃないの。', '自分でやって。', '{other}、あたしを何だと思ってるの？', 'ほかの子に頼めば？'],
  },
  fCourtNotYet: {
    mood: 'angry',
    any: ['ちょっと、まだその時期じゃないでしょ！', '{other}、気が早すぎ。', '子育て中なの。あっち行って。'],
  },
  fCourtAccept: {
    mood: 'love',
    any: ['……ボスなら、いいわ。', '待ってたのよ、{other}。', 'あなたの子なら丈夫に育ちそう。'],
  },
  orderRefused: {
    mood: 'sad',
    brash: ['生意気な……主を誰だと思ってる。'],
    timid: ['……ごめん。'],
    any: ['{other}にそっぽを向かれた。', '主の威厳とは……'],
  },
  courtRefused: {
    mood: 'sad',
    brash: ['{other}め、つれないやつだ。'],
    timid: ['また今度にしよう……'],
    any: ['{other}に突っぱねられた。', '焦りすぎたか。'],
  },
  fTended: {
    mood: 'love',
    any: ['ボスが背中をかいてくれた。……悪くない。', '{other}って、意外とやさしいのね。', 'そこそこ、もうちょっと右。', 'こんなボス、はじめて。'],
  },
  fEscorted: {
    mood: 'love',
    any: ['{other}がずっとそばにいてくれる。安心。', '今日は誰も寄ってこない。', 'この子も、{other}がいれば大丈夫。'],
  },
  fSoothed: {
    mood: 'happy',
    any: ['ボスの声、落ち着く。', 'ふう、やっと静かになった。', 'この浜にいてもいいかな。'],
  },
  tendDone: {
    mood: 'happy',
    brash: ['たまにはこういうのも悪くない。'],
    timid: ['喜んでくれたかな……'],
    any: ['{other}の機嫌が直ったようだ。', '主たるもの、メスを大事にせねば。'],
  },
  sootheDone: {
    mood: 'neutral',
    any: ['みんな落ち着いたようだ。', 'ここは安全だと伝わっただろうか。'],
  },
  fBigPup: {
    mood: 'love',
    any: ['この子は大物になる。わかるの。', '{other}、なんて立派な体つき。', 'この子、父親に似てたくましい。'],
  },
  pupIdle: {
    mood: 'neutral',
    any: ['お母さんのそばがいちばん。', 'おなかすいた。', '大きいのがこわい。', 'うみ、ひろい。', 'となりの子とあそびたい。'],
  },
  pupMilk: {
    mood: 'happy',
    any: ['おっぱいおいしい。', 'ぽかぽか。'],
  },
  orcaEscape: {
    mood: 'sad',
    any: ['シャチに追われた。生きた心地がしない。', 'ホコが重くて泳ぎにくい……'],
  },
  fat: {
    mood: 'happy',
    any: ['よく食べた。脂がのってきた。', '海は豊かだ。'],
  },
  thin: {
    mood: 'sad',
    any: ['餌が見つからない。', '痩せてしまった。来年の浜が不安だ。'],
  },
};

export function pronoun(ind: Individual, age: number): string {
  if (ind.sex === 'F') {
    if (age <= 1) return 'わたし';
    return ind.base.boldness > 0.62 ? 'あたし' : 'わたし';
  }
  if (age <= 2) return 'ぼく';
  if (age >= 12) return 'わし';
  if (ind.base.aggression > 0.62) return '俺';
  if (ind.base.boldness < 0.38) return '僕';
  return '俺';
}

export function makeThought(
  ind: Individual,
  key: ThoughtKey,
  rng: Rng,
  ctx: { year: number; day: number; other?: string; n?: number },
): Thought {
  const e = T[key];
  let pool = e.any;
  const brashness = (ind.base.aggression + ind.base.boldness) / 2;
  if (e.brash && brashness > 0.6 && rng.chance(0.7)) pool = e.brash;
  else if (e.timid && brashness < 0.4 && rng.chance(0.7)) pool = e.timid;
  const age = ind.ageAt(ctx.year);
  const text = rng
    .pick(pool)
    .replaceAll('{I}', pronoun(ind, age))
    .replaceAll('{other}', ctx.other ?? '誰か')
    .replaceAll('{n}', String(ctx.n ?? 0));
  return { text, year: ctx.year, day: ctx.day, mood: e.mood };
}
