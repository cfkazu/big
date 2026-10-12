import type { Individual, Thought } from './individual';
import type { Rng } from './rng';
import { VARIANTS, type Tag } from './thought-variants';

export type ThoughtKey =
  | 'winDisplay' | 'loseDisplay' | 'winFight' | 'loseFight'
  | 'takeHarem' | 'loseHarem' | 'mated' | 'matedMany'
  | 'groomedHoko' | 'groomedHokoGroup' | 'groomedWound' | 'groomedFur'
  | 'hungry' | 'abandon' | 'seasonHappy' | 'seasonZero' | 'seasonSome'
  | 'sneakSuccess' | 'sneakCaught' | 'satelliteSuccess'
  | 'rivalBigger' | 'youngWatch' | 'peripheralIdle' | 'holderIdle'
  | 'fMoveCrowded' | 'fMoveAttracted' | 'fGroomHoko' | 'fGroomHokoGroup' | 'fGroomWound' | 'fGroomFur'
  | 'fSplashHoko' | 'fShooCrab' | 'fShooGull' | 'splashedHoko' | 'crabShooed' | 'gullShooed'
  | 'fGaveBirth' | 'fPupLost' | 'fMated' | 'fEstrus' | 'fProtest' | 'fIdle' | 'fAdmire'
  | 'pupIdle' | 'pupMilk' | 'pupHelpGroom' | 'pupWaitMom' | 'pupWaitMate' | 'pupCheer' | 'youngEnvy'
  | 'orcaEscape' | 'fat' | 'thin' | 'holderFasting' | 'newHolderFemale'
  | 'fOrderedOk' | 'fOrderedNo' | 'fCourtNotYet' | 'fCourtAccept' | 'orderRefused' | 'courtRefused'
  | 'fTended' | 'fEscorted' | 'fSoothed' | 'tendDone' | 'sootheDone' | 'fBigPup' | 'withdrew';

type Mood = Thought['mood'];

interface Entry {
  mood: Mood;
  /** 気の強い個体用 */
  brash?: string[];
  /** 気の弱い個体用 */
  timid?: string[];
  any: string[];
}

// {I} は一人称、{other} は相手の名前、{n} は回数。長さの数字はセリフに入れない。
const T: Record<ThoughtKey, Entry> = {
  winDisplay: {
    mood: 'happy',
    brash: ['見たか{other}。格が違うんだよ。', '{other}のやつ、ひと目見て逃げやがった。', '勝負にもならん。{I}のホコを見て出直せ。'],
    timid: ['……あれ、{other}が引いてくれた？', '見せただけで勝てた。心臓に悪い。'],
    any: ['ブルンッ！　{I}のホコのひと振りで決まりだ。', 'ドドン！　{other}、目をそらしたな。', '{other}を見せ合いで退けた。', '{I}のホコ、今日も冴えてる。'],
  },
  loseDisplay: {
    mood: 'sad',
    brash: ['……今日は調子が悪かっただけだ。', '{other}め、覚えてろ。'],
    timid: ['{other}のは大きすぎる。無理です。', 'ひと目で分かった。負けだ。'],
    any: ['しおしお……。', 'ぐぬぬ……{other}のホコ、でかかった。', '{other}のホコ、あれは反則だろう。', '見せ合いで負けた。比べるんじゃなかった。'],
  },
  winFight: {
    mood: 'happy',
    brash: ['{other}を叩きのめした！ ホコだけじゃないんだよ！', '体で分からせてやった。'],
    any: ['ドスン！　バチーン！　……{I}の勝ちだ。', 'ゼエ、ゼエ……勝った……。', '取っ組み合いで{other}に勝った。体じゅうが痛い。', '勝った。だが次はどうだか。', '砂まみれだが、立っているのは{I}だ。'],
  },
  loseFight: {
    mood: 'sad',
    brash: ['くそっ、{other}め……次は負けん。'],
    timid: ['痛い……もう取っ組み合いはこりごりだ。'],
    any: ['イテテテ……。', 'ドサッ。……砂の味がする。', '{other}に組み伏せられた。傷が疼く。', '負けた。傷が癒えたら、また。', '砂の味がする。'],
  },
  withdrew: {
    mood: 'neutral',
    brash: ['今日のところは見逃してやる。'],
    timid: ['危なかった……引いて正解だ。'],
    any: ['スススッ……今日はこのへんで。', '今日のところは引いておく。', '勝てない勝負はしない。それも強さだ。'],
  },
  takeHarem: {
    mood: 'happy',
    brash: ['今日からこの浜は{I}のものだ！', 'ついに主だ。メスたちよ、ひれ伏せ。'],
    timid: ['えっ、{I}が主に？ 大丈夫かな……'],
    any: ['ブォオオオ！　今日からここは{I}の浜だ！', '{other}から浜を奪った。', 'ハーレムの主になった。胸が熱い。'],
  },
  loseHarem: {
    mood: 'sad',
    any: ['トボトボ……。', '{other}に浜を奪われた……', 'みんな、すまない。', '主の座から転げ落ちた。', '浜も、メスたちも、もう{I}のものじゃない。', 'あの子たちの顔が見られない。'],
  },
  mated: {
    mood: 'love',
    brash: ['また一頭。{I}の血は広がるばかりだ。'],
    timid: ['……ありがとう。'],
    any: ['ぜえ、はあ……。{other}、ありがとな。', '{other}とつがえた。幸せだ。', '今日はいい日だ。'],
  },
  matedMany: {
    mood: 'love',
    brash: ['これで{n}回目。{I}は浜の王だ。'],
    any: ['ヘトヘトだ……でも、まだいける。', '今年はもう{n}回つがえた。幸せだ。', '{n}回……さすがに精が尽きてきた。', '休む暇もない。', 'ハーレムの主はつらいよ。'],
  },
  groomedHoko: {
    mood: 'happy',
    brash: ['{other}にホコをなめさせた。ツヤが違う。'],
    timid: ['{other}がホコをなめて綺麗にしてくれた。照れる。'],
    any: ['ぺろぺろ……くすぐったい。', 'ピカーン！　ホコが光ってる。', '{other}がホコをなめて綺麗にしてくれた。今日は映える。', 'ホコがぴかぴかだ。'],
  },
  groomedHokoGroup: {
    mood: 'love',
    brash: ['{n}頭がかりで{I}のホコをなめさせた。これぞ主の特権。', '{other}が総出でなめてくれる。浜の王とはこういうことだ。'],
    timid: ['{other}がいっぺんに……！ ど、どこを見ていればいいんだ。', 'みんなでなめてくれるなんて、{I}にはもったいない。'],
    any: ['{other}がみんなでホコをなめてくれた。極楽だ。', 'ぺろぺろぺろぺろ……右からも左からも。', '{n}頭に囲まれて、ホコがぴっかぴかだ。', 'これだけなめてもらえば、明日はどのオスよりも光る。', '取り合いになってたな。ふふ。'],
  },
  groomedWound: {
    mood: 'happy',
    any: ['ペロペロ……しみるっ。', '{other}が傷をなめてくれた。少し楽になった。', '傷の手当てがありがたい。', '傷にしみる……でも、ありがたい。', '{other}の舌は薬だ。', 'これでまた戦える。'],
  },
  groomedFur: {
    mood: 'happy',
    any: ['ゴシゴシ……ああ、そこそこ。', '首の後ろまで届く。器用なものだ。', 'うとうと……はっ、寝てた。', '{other}の毛づくろいは、ていねいだ。', '{other}に毛づくろいしてもらった。極楽だ。', '背中がかゆいところに届く。いい子だ。', '{other}の毛づくろいで、眠くなってきた。', '砂まみれだった背中がすっきりした。', '主でよかったと思う瞬間だ。'],
  },
  hungry: {
    mood: 'sad',
    any: ['ぐぅぅ〜……。', '腹が減った。でも浜を離れたら終わりだ。', '何日食べていないだろう。', '腹の虫がうるさい。', 'メスたちは食べに行けていいな。', '海の魚の夢を見た。'],
  },
  holderFasting: {
    mood: 'neutral',
    any: ['げっそり……。', '痩せてきた。だが目は離せない。', '海の匂いがする。……いや、まだだ。', '脂肪が減っていくのがわかる。', 'あと何日、もつだろう。', '食べるのは冬にまとめてだ。'],
  },
  abandon: {
    mood: 'sad',
    any: ['もう限界だ。海へ帰る。', '体がもたない。浜は誰かにくれてやる。', 'みんな、すまない。来年また来る。', '腹が減って、もうホコどころじゃない。', '浜を見張る力が残っていない。'],
  },
  seasonHappy: {
    mood: 'happy',
    any: ['今年は{n}回つがえた。いい一年だった。', '{n}回。悪くない。来年もこうありたい。', 'いい季節だった。子が楽しみだ。', '{n}回。胸を張って海へ帰れる。', '海で太って、来年もこの浜に帰ってこよう。'],
  },
  seasonSome: {
    mood: 'neutral',
    any: ['今年は{n}回。まあ、ぼちぼちだ。', '{n}回つがえた。贅沢は言うまい。', '{n}回か。上には上がいる。', '少しは血を残せたはずだ。', '来年はもっと。'],
  },
  seasonZero: {
    mood: 'sad',
    brash: ['来年こそは……！', '今年は誰ともつがえなかった。屈辱だ。'],
    timid: ['今年も誰とも……', 'まあ、生きてるだけで丸もうけ。'],
    any: ['ホコがすべてじゃない。……すべてじゃないよな？'],
  },
  sneakSuccess: {
    mood: 'scheme',
    any: ['コソコソ……ふふ、うまくいった。', '誰も{I}をオスだと思ってない。好都合だ。', 'ふふ、主は今ごろ何も知らずに寝ている。', 'メスのふりも楽じゃない。でも成果はあった。', 'ハーレムの主様、ごちそうさま。', 'メスたちも気づいてないみたいだ。'],
  },
  satelliteSuccess: {
    mood: 'scheme',
    any: ['ボスが喧嘩してる。今だ！', '主のおこぼれ、ありがたくいただいた。', '付き従った甲斐があった。', 'ボスのおかげで、メスが集まる。', '白いたてがみも悪くない。'],
  },
  sneakCaught: {
    mood: 'sad',
    any: ['ヒィッ！　見つかった！', 'ばれた！ 尻を噛まれた。', '{other}に見破られた。逃げろ！', '逃げ足だけは自信がある。', 'ほかの浜に紛れ直そう。', '危うく噛み殺されるところだった。'],
  },
  rivalBigger: {
    mood: 'angry',
    any: ['{other}のホコ、去年より育ってないか……？', 'あいつのは{I}より少し大きい……いや、気のせいだ。', '{other}とは目を合わせないでおこう。', '比べないほうがいいこともある。', '……今年の{I}は、まだ伸びしろがある。'],
  },
  youngWatch: {
    mood: 'neutral',
    any: ['ブルン……！（練習）', 
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
    any: ['チラッ……チラッ……。', 'チャンスを待つ。', '主たちの様子をうかがう。', '見張りの外にいるメスはいないか。', '砂が熱い。'],
  },
  holderIdle: {
    mood: 'neutral',
    brash: ['この浜に{I}より立派なホコはない。', '挑みたいやつはいつでも来い。'],
    any: ['ブォオオ！（とりあえず吠えておく）', 'ゴロン。……見張りは目でする。', 'みんな元気そうだ。', '見張りは疲れる。', 'あの若いの、さっきからこっちを見ている。', '目を離すとすぐに誰か寄ってくる。'],
  },
  fMoveCrowded: {
    mood: 'sad',
    any: ['ここは騒がしすぎる。子が踏まれる前に移ろう。', '押し合いへし合い、もううんざり。', 'ここじゃ、ゆっくり子育てもできない。', 'もっと静かな浜があるはず。', 'ボス、見張りが手一杯みたい。'],
  },
  fMoveAttracted: {
    mood: 'love',
    any: ['{other}のところ、居心地が良さそう。', '{other}……悪くないわね。', '{other}の浜、空いてるみたい。', '前のボスより、{other}のほうが頼りになりそう。', '{other}って、なかなかの体つき。'],
  },
  fGroomHoko: {
    mood: 'neutral',
    any: ['ぺろぺろ……ぺろり。はい、ピカピカ。', 'ペロペロペロ……ふう、あごが疲れた。', '今日もボスのホコをなめて綺麗にしてあげた。まんざらでもない顔。', 'ホコをなめるのも、務めのうち。', 'ツヤが出てきたわ。わたしの舌の腕前ね。', 'ボスのホコ、今日も念入りに。', 'なめてあげると、ボスがおとなしくなるの。'],
  },
  fGroomHokoGroup: {
    mood: 'happy',
    any: ['みんなでボスのホコをなめた。ちょっとしたお祭りね。', 'ぺろぺろ、ぺろぺろ……{n}頭がかりよ。', 'ほかの子と頭がぶつかっちゃった。', '手分けしたら、あっという間にピカピカ。', '先っぽはわたしの担当。ゆずらないわよ。', 'ボス、うっとりしてたわね。'],
  },
  fSplashHoko: {
    mood: 'neutral',
    any: ['乾いちゃだめ。はい、ばしゃっ。', '今日は日差しが強いから、ホコに海水をかけてあげた。', 'ばしゃばしゃ……ほら、しっとりした。', '{other}ったら、ホコが乾いてるのに気づかないんだから。', '冷たかった？　がまんして。', '潮水で湿らせておくと、ツヤが長持ちするのよ。'],
  },
  fShooCrab: {
    mood: 'angry',
    any: ['シッシッ！　ボスのホコはエサじゃないの！', 'カニがボスのホコをはさもうとしてた。危ないところだったわ。', 'このカニ、しつこい！　あっち行きなさい！', '{other}ったら、カニに狙われてるのに寝てるんだから。', 'カニを追い払ってあげた。お礼はいいのよ。'],
  },
  fShooGull: {
    mood: 'angry',
    any: ['カモメ！　ボスのホコをつつかないで！', 'バサバサ……もう、しつこい鳥。', 'カモメって光るものが好きなのよね。ボスのホコ、ツヤツヤだから。', '追い払ってあげたわ。{other}はのんきなんだから。', '空から狙うなんて卑怯よ。'],
  },
  splashedHoko: {
    mood: 'happy',
    any: ['ひゃっ、冷たい！　……でも気持ちいい。', '{other}が海水をかけてくれた。ホコがしゃきっとした。', 'ばしゃっ。……目が覚めた。', 'ホコが乾いていたのか。気づかなかった。', '{other}は気がきく。'],
  },
  crabShooed: {
    mood: 'happy',
    any: ['カニがホコを狙っていたらしい。{other}、助かった。', 'チョキチョキ……ひっ！　……{other}が追い払ってくれた。', '寝ている間にカニが来ていたとは。', 'カニめ、二度と近づくな。', '{other}がいなかったら、と思うとぞっとする。'],
  },
  gullShooed: {
    mood: 'happy',
    any: ['カモメがホコを狙ってきた。{other}が追い払ってくれた。', 'ツヤが出すぎるのも考えものだ。カモメに狙われる。', '空からとは……油断も隙もない。', '{other}、頼りになる。', 'バサバサッ！　……な、何だ？'],
  },
  fGroomWound: {
    mood: 'neutral',
    any: ['ペロッ。……しみる？　がまんして。', 'ボスったらまた傷だらけ。', '無茶ばかりするんだから。', 'この傷、深いわね。じっとしてて。', '喧嘩はほどほどにね、ボス。', 'なめておけば治るわよ。'],
  },
  fGroomFur: {
    mood: 'neutral',
    any: ['ゴシゴシ。はい、すっきり。', '毛づくろいしてあげた。いびきをかいてる。', '背中の砂を払ってあげた。', 'ボスの背中、砂だらけ。', 'ここ、かゆいでしょ。', 'ボスの毛並み、つやつやになったわ。'],
  },
  fGaveBirth: {
    mood: 'love',
    any: ['ぴゃあ、ぴゃあ……元気な声。', '生まれた！ この子は{other}って名前にしよう。', 'かわいい……{other}、元気に育ってね。', '{other}、ようこそ浜へ。', 'ちっちゃい……でも、しっかり鳴いてる。', '{other}を守らなきゃ。'],
  },
  fPupLost: {
    mood: 'sad',
    any: ['あの子が……オスたちの喧嘩に巻き込まれて……', 'もうあんな騒がしい所にはいられない。', 'どうしてあの子が……', '強いオスなんて、もうたくさん。', '来年は、もっと静かな浜で産もう。'],
  },
  fMated: {
    mood: 'neutral',
    any: ['ドキドキした……。', '{other}とつがった。', 'まあ、{other}なら。', '{other}の子を宿したかしら。', '……これで、今年の務めは果たしたわ。', '{other}、思ったより優しかった。'],
  },
  fEstrus: {
    mood: 'love',
    any: ['ソワソワ……。', 'なんだか落ち着かない。', '今年は誰の子を産もうかしら。', 'ボスのことが気になって仕方ない。', '体が熱い。', 'そろそろかしら。'],
  },
  fProtest: {
    mood: 'angry',
    any: ['シャーッ！　あっち行って！', 'ちょっと！ 誰よあんた！', '{other}、勝手に寄ってこないで！', 'ボスを呼ぶわよ！', 'あんたなんかお呼びじゃないの。', '見張りの外だからって、なめないで。'],
  },
  fIdle: {
    mood: 'neutral',
    any: ['ふわぁ……（あくび）', 'ゴロゴロ……。', 
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
    any: ['キャー、ボス！', 'うちのボス、今日のホコは立派だったわ。', '{other}が勝った。さすがね。', 'うちのボスに勝てるオスなんていないわ。', '{other}がいれば、この浜は安心ね。', 'あの挑戦者、尻尾を巻いて逃げたわ。'],
  },
  newHolderFemale: {
    mood: 'neutral',
    any: ['主が{other}に替わった。……まあ、いいけど。', '新しいボスは{other}か。様子を見よう。', '前のボス、どこへ行ったのかしら。', '{other}って、どんなオスかしら。', '主が替わっても、浜は浜よ。'],
  },
  fOrderedOk: {
    mood: 'neutral',
    brash: ['はいはい、ボス。ご命令とあらば。', 'しょうがないわね、今日だけよ。'],
    any: ['ボスに呼ばれた。はいはい、ホコね。', 'ボスったら甘えん坊なんだから。', '{other}の世話も楽じゃないわ。'],
  },
  fOrderedNo: {
    mood: 'angry',
    any: ['今はそんな気分じゃないの。', '自分でやって。', '{other}、あたしを何だと思ってるの？', 'ほかの子に頼めば？', 'また今度ね。'],
  },
  fCourtNotYet: {
    mood: 'angry',
    any: ['ちょっと、まだその時期じゃないでしょ！', '{other}、気が早すぎ。', '子育て中なの。あっち行って。', 'もう少し待ってくれる？', 'そういう気分じゃないの。'],
  },
  fCourtAccept: {
    mood: 'love',
    any: ['……ボスなら、いいわ。', '待ってたのよ、{other}。', 'あなたの子なら丈夫に育ちそう。', 'いいわよ、{other}。', '今日は、あなたのものよ。'],
  },
  orderRefused: {
    mood: 'sad',
    brash: ['生意気な……主を誰だと思ってる。'],
    timid: ['……ごめん。'],
    any: ['{other}にそっぽを向かれた。', '主の威厳とは……', '{other}の機嫌が悪いらしい。'],
  },
  courtRefused: {
    mood: 'sad',
    brash: ['{other}め、つれないやつだ。'],
    timid: ['また今度にしよう……'],
    any: ['{other}に突っぱねられた。', '焦りすぎたか。', '時期を見誤ったな。'],
  },
  fTended: {
    mood: 'love',
    any: ['ボスが背中をかいてくれた。……悪くない。', '{other}って、意外とやさしいのね。', 'そこそこ、もうちょっと右。', 'こんなボス、はじめて。'],
  },
  fEscorted: {
    mood: 'love',
    any: ['{other}がずっとそばにいてくれる。安心。', '今日は誰も寄ってこない。', 'この子も、{other}がいれば大丈夫。', 'ボスに守られてるって、いいわね。', '{other}、ほかの子は見なくていいの？'],
  },
  fSoothed: {
    mood: 'happy',
    any: ['ほっ……。', 'ボスの声、落ち着く。', 'ふう、やっと静かになった。', 'この浜にいてもいいかな。', 'みんな落ち着いたみたい。', '低い声、好きよ。'],
  },
  tendDone: {
    mood: 'happy',
    brash: ['たまにはこういうのも悪くない。'],
    timid: ['喜んでくれたかな……'],
    any: ['{other}の機嫌が直ったようだ。', '主たるもの、メスを大事にせねば。', '{other}、いい顔になった。'],
  },
  sootheDone: {
    mood: 'neutral',
    any: ['みんな落ち着いたようだ。', 'ここは安全だと伝わっただろうか。', '鳴いたら喉が渇いた。', 'メスたちの顔がやわらいだ。', '静かな浜がいちばんだ。'],
  },
  fBigPup: {
    mood: 'love',
    any: ['この子は大物になる。わかるの。', '{other}、なんて立派な体つき。', 'この子、父親に似てたくましい。', '大きくなったら、きっと浜の主ね。', '{other}は、ほかの子よりひとまわり大きい。'],
  },
  pupIdle: {
    mood: 'neutral',
    any: ['ぴゃあ！', 'ころころ〜。', 'お母さんのそばがいちばん。', 'おなかすいた。', '大きいのがこわい。', 'うみ、ひろい。', 'となりの子とあそびたい。'],
  },
  pupMilk: {
    mood: 'happy',
    any: ['ちゅうちゅう……。', 'んくんく……ぷはっ。', 'おっぱいおいしい。', 'ぽかぽか。', 'もっとのむ。', 'おかあさん、あったかい。', 'おなかいっぱい。ねむい。'],
  },
  pupHelpGroom: {
    mood: 'happy',
    any: ['お母さんのまねして、{other}の背中をゴシゴシ。', 'ゴシゴシ……こう？　お母さん、こう？', '{other}の背中、おっきい！', 'わたしも手伝った！　ほめられた！', 'お母さんみたいに上手になりたい。', 'ペロッ。……いたくない？', '{other}、くすぐったそう。'],
  },
  // 母がボスのホコの手入れをしているあいだ、子は待っている（子のセリフはホコにも手入れの中身にも触れない）
  pupWaitMom: {
    mood: 'neutral',
    any: ['お母さん、{other}のお世話で忙しそう。', 'お母さんまだかなあ。', 'お母さん、お仕事中。じゃましちゃだめなんだって。', 'ひまだなあ。砂でもほろう。', 'お母さん、終わったらあそんでくれるかな。', 'おなかすいた……お母さん、まだ？', '{other}のお世話、ながいなあ。'],
  },
  // 母がつがうあいだ、子は離れたところで待っている（子のセリフはつがいに触れない）
  pupWaitMate: {
    mood: 'neutral',
    any: ['お母さん、どこ行ったのかな。', 'おいてけぼり……。', 'となりのおばさんと待ってる。', 'お母さん、すぐ戻るって。', 'ひとりで待てるもん。', '砂にお絵かきして待ってよう。'],
  },
  // 父や母の浜の主が、見せ合いや取っ組み合いで勝つのを見た子
  pupCheer: {
    mood: 'happy',
    any: ['{other}、つよい！', 'すごーい！　{other}が勝った！', '{other}がいれば、こわくない。', 'いまの見た？　{other}、かっこいい！', '{other}の浜は、いちばん安全なんだって。'],
  },
  youngEnvy: {
    mood: 'neutral',
    any: ['{other}はいいなあ。みんなにお世話してもらって。', '{I}も大きくなったら、{other}みたいにハーレムを持つんだ。', '{other}、モテモテだ……。', 'いつか{I}も、あの浜の主に。', '{other}みたいになるには、いっぱい食べなきゃ。', 'ずるいなあ、{other}ばっかり。', '{I}だって、いつか……！'],
  },
  orcaEscape: {
    mood: 'sad',
    any: ['ザバァッ！　……あ、危なかった。', 'シャチに追われた。生きた心地がしない。', 'ホコが重くて泳ぎにくい……', '黒い背びれが見えた。必死で逃げた。', '仲間がひとり、帰ってこなかった。', '海は豊かだけど、怖い。'],
  },
  fat: {
    mood: 'happy',
    any: ['もっちもち。', 'ぽよん。', 'よく食べた。脂がのってきた。', '海は豊かだ。', '体が重い。いい意味で。', '来年はホコもよく張るだろう。', 'たらふく食べた。'],
  },
  thin: {
    mood: 'sad',
    any: ['ガリガリだ……。', '餌が見つからない。', '痩せてしまった。来年の浜が不安だ。', '冬の海は厳しい。', '骨が浮いてきた。', 'もっと遠くまで食べに行くべきだったか。'],
  },
};

// ─────────────────────────────────────────────
// 場面の案内（セリフ帳で使う）
// ─────────────────────────────────────────────

export type SituationGroup = 'オス' | 'メス' | '子ども・冬';

export interface Situation {
  label: string;
  group: SituationGroup;
  /** {other} に入るものの呼び名（ない場面は null） */
  other: string | null;
  /** {n} が使えるなら、その呼び名と説明 */
  count: { label: string; hint: string } | null;
  /** この場面で付けられる条件 */
  tags: Tag[];
}

const SIZE: Tag[] = ['huge', 'big', 'small'];
const AGE: Tag[] = ['old', 'young'];
const HER: Tag[] = ['fond', 'cold', 'hokoFan', 'gentleFan'];
const SEX: Tag[] = ['boy', 'girl'];
const RIVAL: Tag[] = ['rivalBig', 'rivalEven', 'rivalSmall'];
/** オスについて話すメス */
const F_ABOUT_M: Tag[] = [...SIZE, ...HER];

const MATED_N = { label: '回数', hint: 'この季につがった回数' };
const LICKERS_N = { label: '頭数', hint: '一緒になめたメスの数' };
const sit = (label: string, group: SituationGroup, other: string | null, tags: Tag[], count: Situation['count'] = null): Situation => ({ label, group, other, count, tags });

export const SITUATIONS: Record<ThoughtKey, Situation> = {
  winDisplay: sit('見せ合いで勝ったオス', 'オス', '相手', [...SIZE, ...AGE, ...RIVAL]),
  loseDisplay: sit('見せ合いで負けたオス', 'オス', '相手', [...SIZE, ...AGE, ...RIVAL]),
  winFight: sit('取っ組み合いで勝ったオス', 'オス', '相手', [...SIZE, ...AGE, ...RIVAL]),
  loseFight: sit('取っ組み合いで負けたオス', 'オス', '相手', [...SIZE, ...AGE, ...RIVAL]),
  withdrew: sit('にらみ合いから身を引いたオス', 'オス', '相手', [...SIZE, ...AGE, ...RIVAL]),
  rivalBigger: sit('自分より大きいホコを見たオス', 'オス', '相手', [...SIZE, ...AGE]),
  takeHarem: sit('浜を奪って主になったオス', 'オス', '前の主', [...SIZE, ...AGE]),
  loseHarem: sit('浜を奪われたオス', 'オス', '奪った相手', [...SIZE, ...AGE]),
  mated: sit('つがったオス', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  matedMany: sit('たくさんつがったオス', 'オス', null, [...SIZE, ...AGE], MATED_N),
  groomedHoko: sit('ホコをなめてもらったオス', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  groomedHokoGroup: sit('何頭かにホコをなめてもらったオス', 'オス', 'メスたち', [...SIZE, ...AGE], LICKERS_N),
  splashedHoko: sit('ホコに海水をかけてもらったオス', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  crabShooed: sit('カニを追い払ってもらったオス', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  gullShooed: sit('カモメを追い払ってもらったオス', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  groomedWound: sit('傷の手当てをしてもらったオス', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  groomedFur: sit('毛づくろいしてもらったオス', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  orderRefused: sit('世話を断られた主', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  courtRefused: sit('迫って断られた主', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  tendDone: sit('メスを毛づくろいしてやった主', 'オス', 'メス', [...SIZE, ...AGE, ...HER]),
  sootheDone: sit('ハーレムをなだめた主', 'オス', null, [...SIZE, ...AGE]),
  holderIdle: sit('浜を守る主のひとりごと', 'オス', null, [...SIZE, ...AGE]),
  hungry: sit('腹ぺこの主', 'オス', null, [...SIZE, ...AGE]),
  holderFasting: sit('絶食で痩せてきた主', 'オス', null, [...SIZE, ...AGE]),
  abandon: sit('力尽きて浜を去るオス', 'オス', null, [...SIZE, ...AGE]),
  peripheralIdle: sit('浜の端でうかがうオス', 'オス', null, [...SIZE, ...AGE]),
  youngWatch: sit('大人を眺める若いオス', 'オス', null, [...SIZE]),
  sneakSuccess: sit('紛れ込んでつがえた忍び型', 'オス', null, AGE),
  satelliteSuccess: sit('隙を突いてつがえた衛星型', 'オス', null, AGE),
  sneakCaught: sit('見つかって追い払われたオス', 'オス', '主', [...AGE, ...RIVAL]),
  seasonHappy: sit('繁殖期の終わり（たくさんつがえた）', 'オス', null, [...SIZE, ...AGE], MATED_N),
  seasonSome: sit('繁殖期の終わり（少しつがえた）', 'オス', null, [...SIZE, ...AGE], MATED_N),
  seasonZero: sit('繁殖期の終わり（つがえなかった）', 'オス', null, [...SIZE, ...AGE]),
  fGroomHoko: sit('ホコをなめて綺麗にしたメス', 'メス', 'ボス', F_ABOUT_M),
  fGroomHokoGroup: sit('ほかのメスと一緒にホコをなめたメス', 'メス', 'ボス', F_ABOUT_M, LICKERS_N),
  fSplashHoko: sit('ホコに海水をかけてあげたメス', 'メス', 'ボス', F_ABOUT_M),
  fShooCrab: sit('ホコを狙うカニを追い払ったメス', 'メス', 'ボス', F_ABOUT_M),
  fShooGull: sit('ホコを狙うカモメを追い払ったメス', 'メス', 'ボス', F_ABOUT_M),
  fGroomWound: sit('傷の手当てをしたメス', 'メス', 'ボス', F_ABOUT_M),
  fGroomFur: sit('毛づくろいをしたメス', 'メス', 'ボス', F_ABOUT_M),
  fOrderedOk: sit('頼まれた世話を引き受けたメス', 'メス', 'ボス', F_ABOUT_M),
  fOrderedNo: sit('頼まれた世話を断ったメス', 'メス', 'ボス', F_ABOUT_M),
  fCourtAccept: sit('迫られて受け入れたメス', 'メス', 'ボス', F_ABOUT_M),
  fCourtNotYet: sit('発情前に迫られたメス', 'メス', 'ボス', F_ABOUT_M),
  fMated: sit('つがったメス', 'メス', 'オス', F_ABOUT_M),
  fTended: sit('ボスに毛づくろいしてもらったメス', 'メス', 'ボス', F_ABOUT_M),
  fEscorted: sit('ボスに寄り添ってもらったメス', 'メス', 'ボス', F_ABOUT_M),
  fSoothed: sit('ボスの声で落ち着いたメス', 'メス', 'ボス', F_ABOUT_M),
  fAdmire: sit('主の防衛を見届けたメス', 'メス', 'ボス', F_ABOUT_M),
  newHolderFemale: sit('主が替わったときのメス', 'メス', '新しい主', F_ABOUT_M),
  fMoveAttracted: sit('別の主のもとへ移るメス', 'メス', '新しい主', F_ABOUT_M),
  fMoveCrowded: sit('騒がしい浜を出ていくメス', 'メス', null, HER),
  fProtest: sit('見知らぬオスに寄られたメス', 'メス', 'オス', F_ABOUT_M),
  fEstrus: sit('発情したメス', 'メス', null, HER),
  fIdle: sit('メスのひとりごと', 'メス', 'ボス', F_ABOUT_M),
  fGaveBirth: sit('子を産んだメス', 'メス', '子', HER),
  fBigPup: sit('大物の子を産んだメス', 'メス', '子', HER),
  fPupLost: sit('子を喧嘩で亡くしたメス', 'メス', null, HER),
  pupIdle: sit('子どものひとりごと', '子ども・冬', null, SEX),
  pupMilk: sit('乳を飲む子ども', '子ども・冬', null, SEX),
  pupHelpGroom: sit('母のまねで世話を手伝う子（メス）', '子ども・冬', 'ボス', []),
  pupWaitMom: sit('母がボスの世話をしているあいだ待つ子', '子ども・冬', 'ボス', SEX),
  pupWaitMate: sit('母がつがうあいだ、離れて待つ子', '子ども・冬', null, SEX),
  pupCheer: sit('勝った父（浜の主）に憧れる子', '子ども・冬', '父・主', SEX),
  youngEnvy: sit('主をうらやむ子・若いオス', '子ども・冬', '主', []),
  orcaEscape: sit('シャチから逃げた', '子ども・冬', null, [...SIZE, ...AGE]),
  fat: sit('冬によく太った', '子ども・冬', null, [...SIZE, ...AGE]),
  thin: sit('冬に痩せた', '子ども・冬', null, [...SIZE, ...AGE]),
};

export const TAG_LABEL: Record<Tag, string> = {
  huge: '並外れて大きいホコ',
  big: '大きいホコ',
  small: '小さいホコ',
  fond: '懐いている',
  cold: '機嫌が悪い',
  hokoFan: 'ホコ好きのメス',
  gentleFan: '穏やか好きのメス',
  old: '年寄り',
  young: '若い',
  rivalBig: '相手のほうが大きい',
  rivalEven: '相手と互角',
  rivalSmall: '相手のほうが小さい',
  boy: 'オスの子',
  girl: 'メスの子',
};

// ─────────────────────────────────────────────
// 足されたセリフ（セリフ帳）
// ─────────────────────────────────────────────

export interface CustomLine {
  id: string;
  key: ThoughtKey;
  /** 条件の札。'' はどんなときでも */
  tag: Tag | '';
  text: string;
}

let custom: CustomLine[] = [];

/** 足されたセリフを入れ替える。次にセリフを選ぶときから使われる。 */
export function setCustomLines(lines: CustomLine[]): void {
  custom = lines.filter((l) => l.key in T && (l.tag === '' || l.tag in TAG_LABEL) && typeof l.text === 'string' && l.text.length > 0);
}

export function customLines(): readonly CustomLine[] {
  return custom;
}

/** もともとあるセリフの一覧（セリフ帳で見せる）。kind は どんなとき／強気／弱気／条件の札。 */
export function builtinLines(key: ThoughtKey): { kind: 'any' | 'brash' | 'timid' | Tag; text: string }[] {
  const e = T[key];
  const out: { kind: 'any' | 'brash' | 'timid' | Tag; text: string }[] = [];
  for (const t of e.any) out.push({ kind: 'any', text: t });
  for (const t of e.brash ?? []) out.push({ kind: 'brash', text: t });
  for (const t of e.timid ?? []) out.push({ kind: 'timid', text: t });
  for (const [tag, lines] of Object.entries(VARIANTS[key] ?? {})) for (const t of lines ?? []) out.push({ kind: tag as Tag, text: t });
  return out;
}

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
  ctx: { year: number; day: number; other?: string; n?: number; tags?: Tag[]; cm?: number; aboutId?: number; avoid?: (raw: string) => boolean },
): Thought {
  const e = T[key];
  const mine = custom.filter((c) => c.key === key);
  const anyExtra = mine.filter((c) => c.tag === '').map((c) => c.text);
  // 条件の札ごとの束（もともとのセリフ＋足されたセリフ）
  const tagged = (t: Tag) => [...(VARIANTS[key]?.[t] ?? []), ...mine.filter((c) => c.tag === t).map((c) => c.text)];
  const matched = (ctx.tags ?? []).filter((t) => tagged(t).length > 0);
  const brashness = (ind.base.aggression + ind.base.boldness) / 2;
  let pool: string[];
  // 状況に合うセリフがあれば、そちらを優先する
  if (matched.length > 0 && rng.chance(0.75)) pool = tagged(rng.pick(matched));
  else if (e.brash && brashness > 0.6 && rng.chance(0.7)) pool = [...e.brash, ...anyExtra];
  else if (e.timid && brashness < 0.4 && rng.chance(0.7)) pool = [...e.timid, ...anyExtra];
  else pool = [...e.any, ...anyExtra];
  // 最近言った・ほかの個体が言ったばかりの文は避ける。選んだ束で尽きたら、ふつうのセリフから選ぶ。
  if (ctx.avoid) {
    const fresh = pool.filter((t) => !ctx.avoid!(t));
    const base = [...e.any, ...(e.brash ?? []), ...(e.timid ?? []), ...anyExtra].filter((t) => !ctx.avoid!(t));
    if (fresh.length > 0) pool = fresh;
    else if (base.length > 0) pool = base;
  }
  const raw = rng.pick(pool);
  const age = ind.ageAt(ctx.year);
  const text = raw
    .replaceAll('{I}', pronoun(ind, age))
    .replaceAll('{other}', ctx.other ?? '誰か')
    .replaceAll('{n}', String(ctx.n ?? 0));
  return { text, year: ctx.year, day: ctx.day, mood: e.mood, key, aboutId: ctx.aboutId, raw };
}
