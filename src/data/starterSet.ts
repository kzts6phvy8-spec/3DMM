// 初期セット（約100個）。AIが用意した内容。
// - 事実の記述には、その星のWikipedia（日本語版）記事を出典として自動で付ける
// - 事実にはWikipedia記事を出典として付ける
// - 出典の記事が実在することは scripts で確認する（内容の一致は利用者が確認する）
// - [[名前]] は星へのリンク。登録されていない名前は「まだ知らない星」になる
import type { StarSpec, RelationSpec } from './buildDataset';

export const STARTER_STARS: StarSpec[] = [
  // ---------------- 哲学 ----------------
  {
    key: 'socrates', title: 'ソクラテス', aliases: ['Socrates'], kind: 'person', category: '哲学', importance: 5, wp: 'ソクラテス',
    summary: '古代ギリシャ・アテナイの哲学者。',
    statements: [
      { text: '[[アテナイ]]出身の古代ギリシアの哲学者である。' },
      { text: '自身は著作を残さず、その思想は主に弟子の[[プラトン]]の著作を通じて伝わっている。' },
      { text: '紀元前399年に裁判で死刑判決を受け、刑死した。', topic: '歴史' },
      { text: '[[無知の知]]は、現代の[[科学的方法]]の「まず疑う」態度に通じるところがある。', kind: 'opinion' },
    ],
  },
  {
    key: 'plato', title: 'プラトン', aliases: ['Plato'], kind: 'person', category: '哲学', importance: 4, wp: 'プラトン',
    summary: 'ソクラテスの弟子で、アリストテレスの師。',
    statements: [
      { text: '[[ソクラテス]]の弟子であり、[[アリストテレス]]の師である。' },
      { text: '[[イデア論]]を説いた。' },
      { text: '[[アテナイ]]郊外に学園[[アカデメイア]]を開いた。' },
    ],
  },
  {
    key: 'aristotle', title: 'アリストテレス', aliases: ['Aristotle'], kind: 'person', category: '哲学', importance: 4, wp: 'アリストテレス',
    summary: '古代ギリシアの哲学者。「万学の祖」と呼ばれる。',
    statements: [
      { text: '[[プラトン]]の弟子である。' },
      { text: '[[アレクサンドロス大王]]の家庭教師を務めた。' },
      { text: '論理学・自然学・倫理学・政治学など幅広い分野を論じ、「万学の祖」と呼ばれる。' },
    ],
  },
  {
    key: 'ignorance', title: '無知の知', kind: 'concept', category: '哲学', importance: 3, wp: '無知の知',
    summary: '自分が知らないということを自覚していること。',
    statements: [
      { text: '[[ソクラテス]]の思想を表す言葉として知られる。' },
      { text: '[[デルポイの神託]]をめぐる逸話と結びつけて語られる。', topic: '由来' },
    ],
  },
  {
    key: 'dialectic', title: '問答法', kind: 'concept', category: '哲学', importance: 3, wp: '問答法',
    summary: '問いと答えを重ねて相手の考えを吟味する方法。',
    statements: [{ text: '[[ソクラテス]]が対話の中で用いた方法として知られる。' }],
  },
  {
    key: 'idea', title: 'イデア論', kind: 'concept', category: '哲学', importance: 3, wp: 'イデア論',
    summary: '感覚でとらえられる物の背後に、真の実在「イデア」があるとする考え。',
    statements: [
      { text: '[[プラトン]]が説いた。' },
      { text: '洞窟の比喩は、イデア論を説明するたとえとして知られる。' },
    ],
  },
  {
    key: 'greek', title: '古代ギリシャ哲学', aliases: ['古代ギリシア哲学', 'ギリシア哲学'], kind: 'concept', category: '哲学', importance: 4, wp: 'ギリシア哲学',
    summary: '古代ギリシャで展開された哲学の総称。',
    statements: [
      { text: '[[ソクラテス]]、[[プラトン]]、[[アリストテレス]]らが代表的な哲学者として挙げられる。' },
      { text: '現在の哲学だけでなく、自然学（物理学）や数学を含む学問の総称でもあった。' },
    ],
  },
  {
    key: 'descartes', title: 'ルネ・デカルト', aliases: ['デカルト'], kind: 'person', category: '哲学', importance: 4, wp: 'ルネ・デカルト',
    summary: 'フランス出身の哲学者・数学者。「近代哲学の父」と呼ばれる。',
    statements: [
      { text: '「[[我思う、ゆえに我あり]]」という命題で知られる。' },
      { text: '「近代哲学の父」と呼ばれる。' },
      { text: '[[直交座標系]]は、彼の名にちなんで「デカルト座標系」とも呼ばれる。', sources: ['wp-cartesian'] },
    ],
  },
  {
    key: 'cogito', title: '我思う、ゆえに我あり', aliases: ['コギト・エルゴ・スム', 'コギト'], kind: 'concept', category: '哲学', importance: 3, wp: '我思う、ゆえに我あり',
    summary: 'すべてを疑っても、疑っている自分の存在は疑えないという命題。',
    statements: [
      { text: '[[ルネ・デカルト]]が『[[方法序説]]』の中で述べた命題である。' },
      { text: 'ラテン語では「コギト・エルゴ・スム」と表される。', topic: '語源' },
    ],
  },
  {
    key: 'kant', title: 'イマヌエル・カント', aliases: ['カント'], kind: 'person', category: '哲学', importance: 3, wp: 'イマヌエル・カント',
    summary: 'ドイツの哲学者。',
    statements: [
      { text: '『[[純粋理性批判]]』を著した。' },
      { text: 'プロイセンのケーニヒスベルクで生まれた。' },
    ],
  },
  {
    key: 'enlightenment', title: '啓蒙思想', kind: 'concept', category: '哲学', importance: 3, wp: '啓蒙思想',
    summary: '17〜18世紀のヨーロッパで広まった、理性を重んじる思想。',
    statements: [
      { text: '理性によって古い権威や慣習を批判し、人々を啓こうとする思想である。' },
      { text: '[[フランス革命]]に影響を与えたとされる。' },
      { text: '18世紀フランスで刊行された『[[百科全書]]』は、啓蒙思想を広める役割を果たした。' },
    ],
  },
  {
    key: 'scientific-method', title: '科学的方法', kind: 'concept', category: '哲学', importance: 3, wp: '科学的方法',
    summary: '観察・仮説・実験による検証を通じて知識を得る方法。',
    statements: [
      { text: '観察や実験によって仮説を検証し、知識を得ていく手続きである。' },
      { text: '[[ガリレオ・ガリレイ]]は、実験と観察を重視したことで知られる。', sources: ['wp-galileo'] },
      { text: 'この宇宙の「確認済み」の仕組みも、小さな科学的方法だと言える。', kind: 'opinion' },
    ],
  },

  // ---------------- 歴史 ----------------
  {
    key: 'athens', title: 'アテナイ', aliases: ['アテネ'], kind: 'place', category: '歴史', importance: 4, wp: 'アテナイ',
    summary: '古代ギリシアの代表的なポリス（都市国家）。現在のアテネ。',
    statements: [
      { text: '現在のギリシャの首都アテネの古名である。' },
      { text: '[[パルテノン神殿]]がある。' },
      { text: '古代に行われた民主政は、[[民主主義]]の源流とされる。', sources: ['wp-democracy'] },
    ],
  },
  {
    key: 'democracy', title: '民主主義', kind: 'concept', category: '歴史', importance: 3, wp: '民主主義',
    summary: '人々が主権を持ち、自ら政治に参加するという考え方。',
    statements: [
      { text: '語源は古代ギリシア語の「デーモス（民衆）」と「クラトス（権力・支配）」である。', topic: '語源' },
      { text: '古代[[アテナイ]]の民主政が源流とされる。' },
    ],
  },
  {
    key: 'alexander', title: 'アレクサンドロス大王', aliases: ['アレクサンドロス3世'], kind: 'person', category: '歴史', importance: 3, wp: 'アレクサンドロス3世',
    summary: '古代マケドニア王国の王。東方遠征で大帝国を築いた。',
    statements: [
      { text: '東方遠征によってアケメネス朝ペルシアを滅ぼした。' },
      { text: '少年時代に[[アリストテレス]]から教育を受けた。' },
      { text: '遠征先に、自らの名にちなむ都市[[アレクサンドリア]]を各地に建設した。' },
    ],
  },
  {
    key: 'rome', title: 'ローマ帝国', kind: 'place', category: '歴史', importance: 3, wp: 'ローマ帝国',
    summary: '地中海世界を広く支配した古代の国家。',
    statements: [
      { text: '地中海沿岸の広い地域を支配した。' },
      { text: '主に[[ラテン語]]とギリシア語が用いられた。' },
    ],
  },
  {
    key: 'renaissance', title: 'ルネサンス', aliases: ['文芸復興'], kind: 'event', category: '歴史', importance: 4, wp: 'ルネサンス',
    summary: '14〜16世紀のヨーロッパで起こった、古典文化を復興しようとする運動。',
    statements: [
      { text: '14世紀の[[イタリア]]で始まり、ヨーロッパ各地に広がった。' },
      { text: '古代ギリシア・ローマの古典文化を再生・復興しようとする運動である。' },
      { text: '[[レオナルド・ダ・ヴィンチ]]は、この時代を代表する人物の一人である。' },
      { text: '[[活版印刷]]・[[羅針盤]]・[[火薬]]は「ルネサンスの三大発明」と呼ばれることがある。', sources: ['wp-printing'] },
    ],
  },
  {
    key: 'printing', title: '活版印刷', kind: 'concept', category: '歴史', importance: 3, wp: '活版印刷',
    summary: '文字ごとの活字を組み合わせて版を作り、印刷する技術。',
    statements: [
      { text: '15世紀半ばに[[ヨハネス・グーテンベルク]]が実用化したことで知られる。' },
      { text: '書物が大量に作られるようになり、知識が広く伝わるきっかけとなった。' },
    ],
  },
  {
    key: 'gutenberg', title: 'ヨハネス・グーテンベルク', aliases: ['グーテンベルク'], kind: 'person', category: '歴史', importance: 3, wp: 'ヨハネス・グーテンベルク',
    summary: 'ドイツの金属加工職人・印刷業者。',
    statements: [
      { text: '[[活版印刷]]技術を実用化した人物として知られる。' },
      { text: '彼が印刷した聖書は「グーテンベルク聖書」と呼ばれる。' },
    ],
  },
  {
    key: 'industrial', title: '産業革命', kind: 'event', category: '歴史', importance: 4, wp: '産業革命',
    summary: '18世紀後半から起こった、工業化による産業と社会の大変革。',
    statements: [
      { text: '18世紀後半の[[イギリス]]で始まった。' },
      { text: '[[蒸気機関]]の改良が大きな役割を果たした。' },
    ],
  },
  {
    key: 'steam', title: '蒸気機関', kind: 'concept', category: '技術', importance: 3, wp: '蒸気機関',
    summary: '蒸気の力を使って動力を得る機関。',
    statements: [
      { text: '[[ジェームズ・ワット]]による改良がよく知られる。' },
      { text: '[[産業革命]]を支えた技術の一つである。' },
    ],
  },
  {
    key: 'french-revolution', title: 'フランス革命', kind: 'event', category: '歴史', importance: 4, wp: 'フランス革命',
    summary: '1789年に始まったフランスの市民革命。',
    statements: [
      { text: '1789年に始まった。' },
      { text: '革命の中で「[[人権宣言]]」が採択された。' },
      { text: '[[啓蒙思想]]の影響を受けたとされる。', sources: ['wp-enlightenment'] },
    ],
  },
  {
    key: 'edo', title: '江戸時代', kind: 'event', category: '歴史', importance: 3, wp: '江戸時代',
    summary: '江戸幕府が日本を治めた時代。',
    statements: [
      { text: '1603年に[[徳川家康]]が江戸幕府を開いてから始まったとされる。' },
      { text: 'この時代に[[浮世絵]]が栄えた。', sources: ['wp-ukiyoe'] },
    ],
  },

  // ---------------- 物理学 ----------------
  {
    key: 'newton', title: 'アイザック・ニュートン', aliases: ['ニュートン'], kind: 'person', category: '物理学', importance: 5, wp: 'アイザック・ニュートン',
    summary: 'イングランドの自然哲学者・数学者。',
    statements: [
      { text: '[[万有引力]]の法則を発見した。' },
      { text: '『[[プリンキピア]]』を著した。' },
      { text: '[[ゴットフリート・ライプニッツ]]とは独立に[[微分積分学]]を確立した。' },
    ],
  },
  {
    key: 'gravity', title: '万有引力', aliases: ['万有引力の法則'], kind: 'concept', category: '物理学', importance: 4, wp: '万有引力',
    summary: '質量を持つすべての物体が互いに引き合う力。',
    statements: [
      { text: '[[アイザック・ニュートン]]が法則として定式化した。' },
      { text: 'リンゴが木から落ちるのを見て着想したという逸話がある。', topic: '逸話' },
      { text: '[[相対性理論]]（一般相対性理論）では、重力は時空のゆがみとして説明される。', sources: ['wp-relativity'] },
    ],
  },
  {
    key: 'einstein', title: 'アルベルト・アインシュタイン', aliases: ['アインシュタイン'], kind: 'person', category: '物理学', importance: 5, wp: 'アルベルト・アインシュタイン',
    summary: 'ドイツ生まれの理論物理学者。',
    statements: [
      { text: '[[相対性理論]]を提唱した。' },
      { text: '[[光電効果]]の法則の発見などにより、1921年の[[ノーベル賞]]（物理学賞）を受賞した。' },
    ],
  },
  {
    key: 'relativity', title: '相対性理論', kind: 'concept', category: '物理学', importance: 4, wp: '相対性理論',
    summary: '特殊相対性理論と一般相対性理論の総称。',
    statements: [
      { text: '[[アルベルト・アインシュタイン]]が提唱した。' },
      { text: '特殊相対性理論では、真空中の[[光]]の速さはどの観測者から見ても一定とされる。' },
    ],
  },
  {
    key: 'quantum', title: '量子力学', kind: 'concept', category: '物理学', importance: 4, wp: '量子力学',
    summary: '原子や電子などのミクロな世界を記述する物理学の理論。',
    statements: [
      { text: '[[原子]]や電子などのミクロな世界の現象を記述する。' },
      { text: '20世紀前半に確立された。' },
      { text: '「観測するまで決まらない」という考え方は、[[無知の知]]のように「知ることの限界」を意識させる。', kind: 'opinion' },
    ],
  },
  {
    key: 'atom', title: '原子', aliases: ['アトム'], kind: 'concept', category: '物理学', importance: 4, wp: '原子',
    summary: '物質を構成する基本的な粒子。原子核と電子からなる。',
    statements: [
      { text: '原子核と、その周りの電子からなる。' },
      { text: '名前は「これ以上分割できないもの」を意味する古代ギリシア語に由来する。', topic: '語源' },
      { text: '古代ギリシアの[[デモクリトス]]は、万物は分割できない粒子からなると考えた。', sources: ['wp-democritus'] },
    ],
  },
  {
    key: 'democritus', title: 'デモクリトス', kind: 'person', category: '哲学', importance: 3, wp: 'デモクリトス',
    summary: '古代ギリシアの哲学者。原子論を唱えた。',
    statements: [
      { text: '万物は分割できない粒子（アトム）と空虚からなるという原子論を唱えた。' },
      { text: '[[ソクラテス]]とほぼ同じ時代の人物である。' },
      { text: '2000年以上前の哲学の考えが、現代物理学の[[原子]]の名前に残っているのは面白い。', kind: 'opinion' },
    ],
  },
  {
    key: 'light', title: '光', kind: 'concept', category: '物理学', importance: 4, wp: '光',
    summary: '目に見える電磁波。広くは電磁波全体を指すこともある。',
    statements: [
      { text: '真空中での速さは秒速約30万キロメートルである。' },
      { text: '[[光電効果]]は、光が粒子としての性質も持つことを示した。', sources: ['wp-photoelectric'] },
    ],
  },
  {
    key: 'photoelectric', title: '光電効果', kind: 'concept', category: '物理学', importance: 2, wp: '光電効果',
    summary: '物質に光を当てると電子が飛び出す現象。',
    statements: [
      { text: '[[アルベルト・アインシュタイン]]は、[[光]]を粒子（光量子）と考えてこの現象を説明した。' },
    ],
  },
  {
    key: 'archimedes', title: 'アルキメデス', kind: 'person', category: '数学', importance: 3, wp: 'アルキメデス',
    summary: '古代ギリシアの数学者・技術者。',
    statements: [
      { text: '浮力に関する「アルキメデスの原理」で知られる。' },
      { text: '原理を思いついたときに「エウレカ（わかった）」と叫んだという逸話がある。', topic: '逸話' },
      { text: '円に内接・外接する多角形を使って[[円周率]]の値を求めた。', sources: ['wp-pi'] },
    ],
  },
  {
    key: 'galileo', title: 'ガリレオ・ガリレイ', aliases: ['ガリレオ'], kind: 'person', category: '天文学', importance: 4, wp: 'ガリレオ・ガリレイ',
    summary: 'イタリアの物理学者・天文学者。',
    statements: [
      { text: '望遠鏡を使って天体を観測し、木星の衛星などを発見した。' },
      { text: '[[地動説]]を支持し、宗教裁判にかけられた。' },
    ],
  },

  // ---------------- 天文学 ----------------
  {
    key: 'heliocentrism', title: '地動説', kind: 'concept', category: '天文学', importance: 4, wp: '地動説',
    summary: '地球が太陽の周りを回っているとする説。',
    statements: [
      { text: '16世紀に[[ニコラウス・コペルニクス]]が唱えた。' },
      { text: '[[ガリレオ・ガリレイ]]が支持した。' },
    ],
  },
  {
    key: 'sun', title: '太陽', kind: 'other', category: '天文学', importance: 5, wp: '太陽',
    summary: '太陽系の中心にある恒星。',
    statements: [
      { text: '[[太陽系]]の中心にある恒星である。' },
      { text: '主に[[水素]]とヘリウムからなる。' },
    ],
  },
  {
    key: 'solar-system', title: '太陽系', kind: 'other', category: '天文学', importance: 4, wp: '太陽系',
    summary: '太陽と、その周りを回る天体の集まり。',
    statements: [
      { text: '[[太陽]]と、その重力によって周りを回る惑星などの天体からなる。' },
      { text: '惑星は[[水星]]・金星・[[地球]]・火星・木星・土星・天王星・海王星の8つである。' },
      { text: '2006年に[[冥王星]]が準惑星に分類され、惑星から外れた。', sources: ['wp-pluto'] },
    ],
  },
  {
    key: 'mercury-planet', title: '水星', aliases: ['マーキュリー'], qualifier: '', kind: 'other', category: '天文学', importance: 3, wp: '水星',
    summary: '太陽系で最も内側を回る惑星。',
    statements: [
      { text: '[[太陽系]]で最も内側を公転する惑星である。' },
      { text: '英語名のマーキュリー（Mercury）は、ローマ神話の神[[メルクリウス]]に由来する。', topic: '語源' },
    ],
  },
  {
    key: 'mercurius', title: 'メルクリウス', kind: 'person', category: '神話', importance: 2, wp: 'メルクリウス',
    summary: 'ローマ神話の商業・旅人などの神。',
    statements: [
      { text: 'ローマ神話の神で、商業や旅人の守護神とされる。' },
      { text: 'ギリシア神話の[[ヘルメス]]と同一視される。' },
      { text: '惑星の[[水星]]の英語名（マーキュリー）の由来となった。', sources: ['wp-mercury-planet'] },
    ],
  },
  {
    key: 'earth', title: '地球', kind: 'place', category: '天文学', importance: 5, wp: '地球',
    summary: '私たちが住む、太陽系の惑星。',
    statements: [
      { text: '[[太陽]]から3番目に近い惑星である。' },
      { text: '生命の存在が確認されている唯一の天体である。' },
    ],
  },
  {
    key: 'moon', title: '月', qualifier: '衛星', kind: 'other', category: '天文学', importance: 4, wp: '月',
    summary: '地球の唯一の自然の衛星。',
    statements: [
      { text: '[[地球]]の唯一の自然の衛星である。' },
      { text: '1969年、[[アポロ11号]]によって人類が初めて月面に降り立った。', sources: ['wp-apollo11'] },
    ],
  },
  {
    key: 'apollo11', title: 'アポロ11号', kind: 'event', category: '天文学', importance: 3, wp: 'アポロ11号',
    summary: '人類初の月面着陸を果たしたアメリカの宇宙飛行。',
    statements: [
      { text: '1969年に人類初の有人月面着陸を果たした。' },
      { text: '[[ニール・アームストロング]]が最初に月面に降り立った。' },
    ],
  },
  {
    key: 'pluto', title: '冥王星', kind: 'other', category: '天文学', importance: 2, wp: '冥王星',
    summary: '太陽系外縁部の準惑星。',
    statements: [
      { text: '1930年に発見された。' },
      { text: '2006年に国際天文学連合の決定により、惑星から準惑星に分類が変わった。' },
      { text: '「惑星」の定義が変わると、同じ天体の呼び方も変わる。知識は固定されたものではない。', kind: 'opinion' },
    ],
  },
  {
    key: 'bigbang', title: 'ビッグバン', kind: 'event', category: '天文学', importance: 4, wp: 'ビッグバン',
    summary: '宇宙が高温・高密度の状態から膨張して始まったとする理論。',
    statements: [
      { text: '宇宙は約138億年前に、極めて高温・高密度の状態から始まったとされる。' },
      { text: '宇宙はビッグバン以来、膨張を続けているとされる。' },
    ],
  },

  // ---------------- 生物学 ----------------
  {
    key: 'darwin', title: 'チャールズ・ダーウィン', aliases: ['ダーウィン'], kind: 'person', category: '生物学', importance: 5, wp: 'チャールズ・ダーウィン',
    summary: 'イギリスの自然科学者。進化論で知られる。',
    statements: [
      { text: '1859年に『[[種の起源]]』を出版した。' },
      { text: '[[自然選択]]による[[進化]]の理論を提唱した。' },
      { text: '[[ビーグル号]]での航海、特に[[ガラパゴス諸島]]での観察が知られる。' },
    ],
  },
  {
    key: 'evolution', title: '進化', kind: 'concept', category: '生物学', importance: 4, wp: '進化',
    summary: '生物の性質が世代を経て変化していくこと。',
    statements: [
      { text: '生物の集団の性質が、世代を重ねるにつれて変化していくことである。' },
      { text: '[[チャールズ・ダーウィン]]は[[自然選択]]によって進化を説明した。', sources: ['wp-darwin'] },
    ],
  },
  {
    key: 'natural-selection', title: '自然選択', aliases: ['自然淘汰', '自然選択説'], kind: 'concept', category: '生物学', importance: 3, wp: '自然選択説',
    summary: '環境に適した性質を持つ個体が多くの子孫を残すことで、その性質が広まるという考え。',
    statements: [
      { text: '[[チャールズ・ダーウィン]]と[[アルフレッド・ラッセル・ウォレス]]が提唱した。' },
      { text: '市場で優れた商品が生き残る様子は、自然選択に似ている。[[見えざる手]]と比べると面白い。', kind: 'opinion' },
    ],
  },
  {
    key: 'dna', title: 'DNA', aliases: ['デオキシリボ核酸'], kind: 'concept', category: '生物学', importance: 4, wp: 'デオキシリボ核酸',
    summary: '生物の遺伝情報を担う物質。',
    statements: [
      { text: '生物の遺伝情報を担う物質である。' },
      { text: '1953年に[[ジェームズ・ワトソン]]と[[フランシス・クリック]]が二重らせん構造を提唱した。' },
      { text: '4種類の塩基の並び方によって情報を記録している。' },
      { text: '4種類の文字で情報を書く仕組みは、0と1の2種類で書く[[二進法]]と比べると面白い。', kind: 'opinion' },
    ],
  },
  {
    key: 'cell', title: '細胞', kind: 'concept', category: '生物学', importance: 4, wp: '細胞',
    summary: '生物の体を構成する基本単位。',
    statements: [
      { text: '生物の体を構成する基本的な単位である。' },
      { text: '17世紀に[[ロバート・フック]]が、コルクの観察から「cell（細胞）」と名付けた。', topic: '語源' },
    ],
  },
  {
    key: 'mendel', title: 'グレゴール・ヨハン・メンデル', aliases: ['メンデル'], kind: 'person', category: '生物学', importance: 3, wp: 'グレゴール・ヨハン・メンデル',
    summary: 'オーストリア帝国の司祭・生物学者。遺伝の法則を発見した。',
    statements: [
      { text: 'エンドウの交配実験から、遺伝の法則（[[メンデルの法則]]）を発見した。' },
      { text: '修道院の司祭であった。' },
    ],
  },
  {
    key: 'photosynthesis', title: '光合成', kind: 'concept', category: '生物学', importance: 3, wp: '光合成',
    summary: '植物などが光のエネルギーで有機物を作るはたらき。',
    statements: [
      { text: '植物などが[[光]]のエネルギーを使って、二酸化炭素と[[水]]から有機物を作るはたらきである。' },
      { text: 'その過程で酸素を放出する。' },
    ],
  },
  {
    key: 'dinosaur', title: '恐竜', kind: 'other', category: '生物学', importance: 3, wp: '恐竜',
    summary: '中生代に繁栄した爬虫類の一群。',
    statements: [
      { text: '中生代に繁栄した。' },
      { text: '鳥類は恐竜の一系統であると考えられている。' },
      { text: '約6600万年前の大量絶滅で、鳥類以外の恐竜は絶滅した。' },
    ],
  },

  // ---------------- 数学 ----------------
  {
    key: 'pythagoras', title: 'ピタゴラス', kind: 'person', category: '数学', importance: 3, wp: 'ピタゴラス',
    summary: '古代ギリシアの数学者・哲学者。',
    statements: [
      { text: '古代ギリシアの数学者・哲学者である。' },
      { text: '[[三平方の定理]]は「ピタゴラスの定理」とも呼ばれる。', sources: ['wp-pythagorean'] },
    ],
  },
  {
    key: 'pythagorean', title: '三平方の定理', aliases: ['ピタゴラスの定理'], kind: 'concept', category: '数学', importance: 3, wp: '三平方の定理',
    summary: '直角三角形の3辺の長さの関係を表す定理。',
    statements: [
      { text: '直角三角形で、斜辺の長さの2乗は、他の2辺の長さの2乗の和に等しい。' },
      { text: '「[[ピタゴラス]]の定理」とも呼ばれる。' },
    ],
  },
  {
    key: 'zero', title: '0', aliases: ['ゼロ', '零'], kind: 'concept', category: '数学', importance: 4, wp: '0',
    summary: '何もないことを表す数。',
    statements: [
      { text: '数としての0の概念は、[[インド]]で確立されたとされる。' },
      { text: '[[二進法]]では、0と1の2つの数字だけで数を表す。', sources: ['wp-binary'] },
    ],
  },
  {
    key: 'pi', title: '円周率', aliases: ['π', 'パイ'], kind: 'concept', category: '数学', importance: 3, wp: '円周率',
    summary: '円の周の長さと直径の比。約3.14159。',
    statements: [
      { text: '円の周の長さの、直径に対する比である。' },
      { text: '無理数である。' },
      { text: '[[アルキメデス]]は多角形を使って円周率の値を求めた。' },
    ],
  },
  {
    key: 'calculus', title: '微分積分学', aliases: ['微積分'], kind: 'concept', category: '数学', importance: 4, wp: '微分積分学',
    summary: '変化や面積・体積を扱う数学の分野。',
    statements: [
      { text: '[[アイザック・ニュートン]]と[[ゴットフリート・ライプニッツ]]が、それぞれ独立に確立した。' },
    ],
  },
  {
    key: 'euclid', title: 'エウクレイデス', aliases: ['ユークリッド'], kind: 'person', category: '数学', importance: 3, wp: 'エウクレイデス',
    summary: '古代ギリシアの数学者。',
    statements: [
      { text: '幾何学の書『[[原論]]』を著した。' },
      { text: '[[アレクサンドリア]]で活動した。' },
    ],
  },
  {
    key: 'cartesian', title: '直交座標系', aliases: ['デカルト座標系'], kind: 'concept', category: '数学', importance: 3, wp: '直交座標系',
    summary: '互いに直交する座標軸を使って位置を表す方法。',
    statements: [
      { text: '[[ルネ・デカルト]]にちなんで「デカルト座標系」とも呼ばれる。' },
      { text: 'この宇宙の星の位置も、3本の直交する軸（x・y・z）で記録されている。', kind: 'opinion' },
    ],
  },
  {
    key: 'fibonacci', title: 'フィボナッチ数列', aliases: ['フィボナッチ数'], kind: 'concept', category: '数学', importance: 3, wp: 'フィボナッチ数',
    summary: '前の2つの数を足して次の数を作る数列（1, 1, 2, 3, 5, 8…）。',
    statements: [
      { text: '前の2つの数を足して次の数を作る数列である。' },
      { text: '隣り合う項の比は、[[黄金比]]に近づいていく。' },
    ],
  },
  {
    key: 'golden', title: '黄金比', kind: 'concept', category: '数学', importance: 3, wp: '黄金比',
    summary: '約1:1.618の比。',
    statements: [
      { text: '約1:1.618の比である。' },
      { text: '[[パルテノン神殿]]や『[[モナ・リザ]]』に黄金比が使われているという説があるが、根拠が乏しいという指摘もある。', topic: '異説' },
    ],
  },

  // ---------------- 芸術 ----------------
  {
    key: 'davinci', title: 'レオナルド・ダ・ヴィンチ', aliases: ['ダ・ヴィンチ'], kind: 'person', category: '芸術', importance: 5, wp: 'レオナルド・ダ・ヴィンチ',
    summary: 'イタリアのルネサンス期の芸術家。',
    statements: [
      { text: '『[[モナ・リザ]]』や『[[最後の晩餐]]』を描いた。' },
      { text: '絵画だけでなく、解剖学・工学など幅広い分野の研究を残した。' },
    ],
  },
  {
    key: 'monalisa', title: 'モナ・リザ', kind: 'work', category: '芸術', importance: 4, wp: 'モナ・リザ',
    summary: 'レオナルド・ダ・ヴィンチが描いた肖像画。',
    statements: [
      { text: '[[レオナルド・ダ・ヴィンチ]]が描いた肖像画である。' },
      { text: '[[ルーヴル美術館]]に所蔵されている。' },
    ],
  },
  {
    key: 'louvre', title: 'ルーヴル美術館', kind: 'place', category: '芸術', importance: 3, wp: 'ルーヴル美術館',
    summary: 'フランス・パリにある美術館。',
    statements: [
      { text: 'フランスの[[パリ]]にある美術館である。' },
      { text: 'もとは王宮として使われていた建物である。' },
    ],
  },
  {
    key: 'parthenon', title: 'パルテノン神殿', kind: 'place', category: '芸術', importance: 3, wp: 'パルテノン神殿',
    summary: '古代アテナイのアクロポリスに建つ神殿。',
    statements: [
      { text: '[[アテナイ]]のアクロポリスに建てられた神殿である。' },
      { text: '女神[[アテーナー]]を祀った。' },
      { text: '紀元前5世紀に建てられた。' },
    ],
  },
  {
    key: 'vangogh', title: 'フィンセント・ファン・ゴッホ', aliases: ['ゴッホ'], kind: 'person', category: '芸術', importance: 4, wp: 'フィンセント・ファン・ゴッホ',
    summary: 'オランダ出身の画家。',
    statements: [
      { text: 'ポスト印象派を代表する画家の一人である。' },
      { text: '『[[ひまわり]]』などの作品で知られる。' },
      { text: '日本の[[浮世絵]]から影響を受けた。' },
    ],
  },
  {
    key: 'ukiyoe', title: '浮世絵', kind: 'concept', category: '芸術', importance: 4, wp: '浮世絵',
    summary: '江戸時代に成立した日本の絵画のジャンル。',
    statements: [
      { text: '[[江戸時代]]に成立した。' },
      { text: '19世紀後半のヨーロッパの[[ジャポニスム]]に影響を与えた。' },
      { text: '[[葛飾北斎]]は代表的な浮世絵師の一人である。', sources: ['wp-hokusai'] },
    ],
  },
  {
    key: 'hokusai', title: '葛飾北斎', aliases: ['北斎'], kind: 'person', category: '芸術', importance: 4, wp: '葛飾北斎',
    summary: '江戸時代後期の浮世絵師。',
    statements: [
      { text: '[[江戸時代]]後期の浮世絵師である。' },
      { text: '『[[富嶽三十六景]]』を描いた。「神奈川沖浪裏」はその一図である。' },
    ],
  },
  {
    key: 'impressionism', title: '印象派', kind: 'concept', category: '芸術', importance: 3, wp: '印象派',
    summary: '19世紀後半のフランスで起こった芸術運動。',
    statements: [
      { text: '19世紀後半のフランスで起こった。' },
      { text: '[[クロード・モネ]]の作品『印象・日の出』が名前の由来となった。', topic: '語源' },
      { text: '[[浮世絵]]の影響を受けた画家も多い。', sources: ['wp-ukiyoe'] },
    ],
  },
  {
    key: 'bach', title: 'ヨハン・ゼバスティアン・バッハ', aliases: ['バッハ'], kind: 'person', category: '音楽', importance: 4, wp: 'ヨハン・ゼバスティアン・バッハ',
    summary: 'ドイツのバロック音楽の作曲家。',
    statements: [
      { text: '[[バロック音楽]]を代表する作曲家の一人である。' },
      { text: '日本では「音楽の父」と呼ばれることがある。' },
    ],
  },
  {
    key: 'beethoven', title: 'ルートヴィヒ・ヴァン・ベートーヴェン', aliases: ['ベートーヴェン', 'ベートーベン'], kind: 'person', category: '音楽', importance: 4, wp: 'ルートヴィヒ・ヴァン・ベートーヴェン',
    summary: 'ドイツの作曲家。',
    statements: [
      { text: '聴覚を失いながらも作曲を続けた。' },
      { text: '交響曲第9番の第4楽章には、[[フリードリヒ・フォン・シラー]]の詩「歓喜に寄す」が用いられている。' },
    ],
  },
  {
    key: 'mozart', title: 'ヴォルフガング・アマデウス・モーツァルト', aliases: ['モーツァルト'], kind: 'person', category: '音楽', importance: 4, wp: 'ヴォルフガング・アマデウス・モーツァルト',
    summary: 'オーストリアの作曲家。',
    statements: [
      { text: '[[ザルツブルク]]で生まれた。' },
      { text: '幼い頃から神童として知られた。' },
    ],
  },

  // ---------------- 言語 ----------------
  {
    key: 'latin', title: 'ラテン語', kind: 'concept', category: '言語', importance: 4, wp: 'ラテン語',
    summary: '古代ローマで使われた言語。',
    statements: [
      { text: '古代[[ローマ帝国]]で使われた言語である。' },
      { text: '[[イタリア語]]・[[フランス語]]・スペイン語などのロマンス諸語は、ラテン語から生まれた。' },
      { text: '生物の学名には、現在もラテン語が使われる。' },
    ],
  },
  {
    key: 'alphabet', title: 'アルファベット', kind: 'concept', category: '言語', importance: 3, wp: 'アルファベット',
    summary: '一定の順序で並べられた文字の体系。',
    statements: [
      { text: '名前は[[ギリシア文字]]の最初の2文字「アルファ」と「ベータ」に由来する。', topic: '語源' },
    ],
  },
  {
    key: 'kanji', title: '漢字', kind: 'concept', category: '言語', importance: 4, wp: '漢字',
    summary: '中国で生まれた文字。',
    statements: [
      { text: '古代中国で生まれた文字である。' },
      { text: '日本の[[平仮名]]と[[片仮名]]は、漢字をもとに作られた。', sources: ['wp-hiragana'] },
    ],
  },
  {
    key: 'hiragana', title: '平仮名', aliases: ['ひらがな'], kind: 'concept', category: '言語', importance: 3, wp: '平仮名',
    summary: '日本語を書き表す文字の一つ。',
    statements: [
      { text: '[[漢字]]の草書体をもとに作られた。' },
      { text: '平安時代に広く使われるようになった。' },
    ],
  },
  {
    key: 'genji', title: '源氏物語', kind: 'work', category: '言語', importance: 4, wp: '源氏物語',
    summary: '平安時代中期に書かれた長編物語。',
    statements: [
      { text: '平安時代中期に[[紫式部]]が書いた長編物語である。' },
      { text: '世界最古の長編小説の一つとされることがある。' },
    ],
  },
  {
    key: 'murasaki', title: '紫式部', kind: 'person', category: '言語', importance: 3, wp: '紫式部',
    summary: '平安時代中期の作家・歌人。',
    statements: [
      { text: '『[[源氏物語]]』の作者である。' },
      { text: '『[[紫式部日記]]』も残した。' },
    ],
  },
  {
    key: 'etymology', title: '語源', kind: 'concept', category: '言語', importance: 3, wp: '語源学',
    summary: '言葉の起源や成り立ち。',
    statements: [
      { text: '言葉の起源や、成り立ちのことである。' },
      { text: '[[水星]]の英語名は、神[[メルクリウス]]に由来する。', sources: ['wp-mercury-planet'] },
      { text: '[[原子]]の語源は「分割できないもの」を意味する古代ギリシア語である。', sources: ['wp-atom'] },
      { text: '語源をたどると、離れた分野の知識が思わぬところでつながっていることがわかる。', kind: 'opinion' },
    ],
  },

  // ---------------- 経済学 ----------------
  {
    key: 'adam-smith', title: 'アダム・スミス', kind: 'person', category: '経済学', importance: 4, wp: 'アダム・スミス',
    summary: 'イギリス（スコットランド）の経済学者・哲学者。',
    statements: [
      { text: '『[[国富論]]』を著し、「経済学の父」と呼ばれる。' },
      { text: '市場の働きを「[[見えざる手]]」という言葉で表したことで知られる。' },
    ],
  },
  {
    key: 'invisible-hand', title: '見えざる手', aliases: ['神の見えざる手'], kind: 'concept', category: '経済学', importance: 3, wp: '見えざる手',
    summary: '個人の利益の追求が、結果として社会全体の利益につながるという考え。',
    statements: [
      { text: '[[アダム・スミス]]が用いた言葉である。' },
      { text: '[[需要と供給]]の調整によって、市場がうまく働くという考え方と結びつけて語られる。', kind: 'opinion' },
    ],
  },
  {
    key: 'supply-demand', title: '需要と供給', kind: 'concept', category: '経済学', importance: 3, wp: '需要と供給',
    summary: '市場での価格と取引量の決まり方を説明する考え方。',
    statements: [{ text: '市場の価格と取引量は、需要と供給の関係によって決まるとされる。' }],
  },
  {
    key: 'money', title: '貨幣', aliases: ['お金'], kind: 'concept', category: '経済学', importance: 4, wp: '貨幣',
    summary: '商品の交換を仲立ちするもの。',
    statements: [
      { text: '商品の交換を仲立ちし、価値をはかる役割を持つ。' },
      { text: '古くは貝殻や金属などが貨幣として使われた。' },
    ],
  },
  {
    key: 'keynes', title: 'ジョン・メイナード・ケインズ', aliases: ['ケインズ'], kind: 'person', category: '経済学', importance: 3, wp: 'ジョン・メイナード・ケインズ',
    summary: 'イギリスの経済学者。',
    statements: [
      { text: '『雇用・利子および[[貨幣]]の一般理論』を著した。' },
      { text: '[[世界恐慌]]後の経済政策に大きな影響を与えた。' },
    ],
  },

  // ---------------- 心理学 ----------------
  {
    key: 'freud', title: 'ジークムント・フロイト', aliases: ['フロイト'], kind: 'person', category: '心理学', importance: 4, wp: 'ジークムント・フロイト',
    summary: 'オーストリアの精神科医。精神分析学の創始者。',
    statements: [
      { text: '[[精神分析学]]を創始した。' },
      { text: '[[無意識]]の働きを重視した。' },
    ],
  },
  {
    key: 'unconscious', title: '無意識', kind: 'concept', category: '心理学', importance: 3, wp: '無意識',
    summary: '自覚されていない心の働き。',
    statements: [
      { text: '自分では自覚されていない心の働きのことである。' },
      { text: '[[ジークムント・フロイト]]の精神分析学で重要な概念とされた。' },
    ],
  },
  {
    key: 'dunning-kruger', title: 'ダニング＝クルーガー効果', kind: 'concept', category: '心理学', importance: 3, wp: 'ダニング＝クルーガー効果',
    summary: '能力の低い人ほど自分の能力を過大評価しやすいという認知バイアス。',
    statements: [
      { text: '能力の低い人ほど、自分の能力を実際より高く評価しやすいという[[認知バイアス]]である。' },
      { text: '1999年にデイヴィッド・ダニングとジャスティン・クルーガーが発表した。' },
      { text: '[[無知の知]]の大切さを、現代の心理学の側から示しているようにも見える。', kind: 'opinion' },
    ],
  },
  {
    key: 'cognitive-bias', title: '認知バイアス', kind: 'concept', category: '心理学', importance: 3, wp: '認知バイアス',
    summary: '判断や意思決定で生じる思考の偏り。',
    statements: [
      { text: '物事を判断するときに生じる、思考の偏りのことである。' },
      { text: '[[ダニング＝クルーガー効果]]はその一例である。', sources: ['wp-dunning-kruger'] },
      { text: '思い込みを避けるには、出典を確かめる[[科学的方法]]が役に立つ。', kind: 'opinion' },
    ],
  },

  // ---------------- 技術 ----------------
  {
    key: 'computer', title: 'コンピュータ', aliases: ['コンピューター'], kind: 'concept', category: '技術', importance: 4, wp: 'コンピュータ',
    summary: '計算や情報処理を行う機械。',
    statements: [
      { text: '現在のコンピュータの多くは、内部で情報を[[二進法]]で表している。', sources: ['wp-binary'] },
      { text: '[[アラン・チューリング]]は、コンピュータ科学の基礎を築いた一人である。', sources: ['wp-turing'] },
    ],
  },
  {
    key: 'binary', title: '二進法', aliases: ['2進法'], kind: 'concept', category: '数学', importance: 3, wp: '二進法',
    summary: '0と1の2つの数字だけで数を表す方法。',
    statements: [
      { text: '[[0]]と1の2つの数字だけで数を表す。' },
      { text: '[[コンピュータ]]の内部で使われている。' },
      { text: '[[ゴットフリート・ライプニッツ]]が研究したことでも知られる。' },
    ],
  },
  {
    key: 'leibniz', title: 'ゴットフリート・ライプニッツ', aliases: ['ライプニッツ'], kind: 'person', category: '数学', importance: 4, wp: 'ゴットフリート・ライプニッツ',
    summary: 'ドイツの哲学者・数学者。',
    statements: [
      { text: '[[アイザック・ニュートン]]とは独立に[[微分積分学]]を確立した。' },
      { text: '[[二進法]]を研究した。' },
    ],
  },
  {
    key: 'turing', title: 'アラン・チューリング', kind: 'person', category: '技術', importance: 4, wp: 'アラン・チューリング',
    summary: 'イギリスの数学者。コンピュータ科学の基礎を築いた。',
    statements: [
      { text: '第二次世界大戦中、ドイツの暗号機[[エニグマ]]の解読に携わった。' },
      { text: '機械が知的かどうかを判定する「[[チューリング・テスト]]」を考案した。' },
    ],
  },
  {
    key: 'ai', title: '人工知能', aliases: ['AI'], kind: 'concept', category: '技術', importance: 4, wp: '人工知能',
    summary: '人間の知的な働きをコンピュータで実現しようとする技術・研究分野。',
    statements: [
      { text: '1956年の[[ダートマス会議]]で「人工知能」という言葉が使われた。' },
      { text: '機械の知能を判定する方法として[[チューリング・テスト]]が知られる。', sources: ['wp-turing'] },
      { text: 'AIの答えも出典で確かめる必要がある。だからこの宇宙では、AIの用意した知識を「確認済み」にしない。', kind: 'opinion' },
    ],
  },
  {
    key: 'internet', title: 'インターネット', kind: 'concept', category: '技術', importance: 4, wp: 'インターネット',
    summary: '世界中のコンピュータネットワークを相互につないだネットワーク。',
    statements: [
      { text: 'アメリカの[[ARPANET]]が起源とされる。' },
      { text: 'その上で動く[[World Wide Web]]は、[[ティム・バーナーズ＝リー]]が考案した。' },
    ],
  },
  {
    key: 'encyclopedia', title: '百科事典', kind: 'concept', category: '言語', importance: 3, wp: '百科事典',
    summary: 'あらゆる分野の知識を項目ごとにまとめた書物。',
    statements: [
      { text: 'あらゆる分野の知識を、項目ごとに整理してまとめたものである。' },
      { text: '18世紀フランスの『[[百科全書]]』は、[[啓蒙思想]]を広めた。', sources: ['wp-enlightenment'] },
      { text: '[[ウィキペディア]]は、インターネット上で誰でも編集できる百科事典である。', sources: ['wp-wikipedia'] },
    ],
  },
  {
    key: 'wikipedia', title: 'ウィキペディア', aliases: ['Wikipedia'], kind: 'work', category: '技術', importance: 3, wp: 'ウィキペディア',
    summary: '誰でも編集できるインターネット上の百科事典。',
    statements: [
      { text: '誰でも編集できる、[[インターネット]]上の[[百科事典]]である。' },
      { text: '2001年に英語版が始まった。' },
      { text: '言葉から言葉へリンクをたどって知らないものに出会う楽しさは、この宇宙の原点の一つ。', kind: 'opinion' },
    ],
  },

  // ---------------- 化学 ----------------
  {
    key: 'hydrogen', title: '水素', kind: 'concept', category: '化学', importance: 3, wp: '水素',
    summary: '最も軽い元素。元素記号はH。',
    statements: [
      { text: '最も軽い元素で、元素記号はHである。' },
      { text: '宇宙で最も多く存在する元素である。' },
    ],
  },
  {
    key: 'water', title: '水', kind: 'concept', category: '化学', importance: 4, wp: '水',
    summary: '水素と酸素からなる化合物。化学式はH₂O。',
    statements: [
      { text: '[[水素]]と酸素からなる化合物で、化学式はH₂Oである。' },
      { text: '[[地球]]の表面の約7割は海に覆われている。', sources: ['wp-earth'] },
    ],
  },
  {
    key: 'nobel', title: 'ノーベル賞', kind: 'concept', category: '歴史', importance: 3, wp: 'ノーベル賞',
    summary: '人類に貢献した人々に贈られる国際的な賞。',
    statements: [
      { text: '[[アルフレッド・ノーベル]]の遺言によって創設された。' },
      { text: '1901年に最初の授賞が行われた。' },
    ],
  },
];

export const STARTER_RELATIONS: RelationSpec[] = [
  { from: 'socrates', to: 'plato', type: 'historical', explanation: '師弟関係' },
  { from: 'plato', to: 'aristotle', type: 'historical', explanation: '師弟関係' },
  { from: 'aristotle', to: 'alexander', type: 'historical', explanation: '家庭教師として教えた', sources: ['wp-alexander'] },
  { from: 'socrates', to: 'greek', type: 'partWhole', explanation: '古代ギリシャ哲学を代表する人物', sources: ['wp-greek'] },
  { from: 'printing', to: 'renaissance', type: 'causal', explanation: '書物が広まり、文化の復興を後押しした', kind: 'opinion' },
  { from: 'steam', to: 'industrial', type: 'causal', explanation: '動力の革新が工業化を支えた', sources: ['wp-industrial'] },
  { from: 'enlightenment', to: 'french-revolution', type: 'causal', explanation: '革命の思想的な背景となった', sources: ['wp-french-revolution'] },
  { from: 'gravity', to: 'relativity', type: 'application', explanation: '重力の理論が一般相対性理論へ発展した', sources: ['wp-relativity'] },
  { from: 'democritus', to: 'atom', type: 'application', explanation: '古代の原子論が現代の原子の名前に残る', sources: ['wp-atom'] },
  { from: 'ignorance', to: 'dunning-kruger', type: 'similarity', explanation: 'どちらも「自分の知識の限界」に関わる', kind: 'opinion' },
  { from: 'natural-selection', to: 'invisible-hand', type: 'similarity', explanation: '個々の競争が全体の秩序を生むという発想が似ている', kind: 'opinion' },
  { from: 'ukiyoe', to: 'impressionism', type: 'causal', explanation: '浮世絵が印象派の画家に影響を与えた', sources: ['wp-ukiyoe'] },
  { from: 'ukiyoe', to: 'vangogh', type: 'causal', explanation: 'ゴッホは浮世絵を模写し、影響を受けた', sources: ['wp-vangogh'] },
  { from: 'fibonacci', to: 'golden', type: 'partWhole', explanation: '隣り合う項の比が黄金比に近づく', sources: ['wp-fibonacci'] },
  { from: 'newton', to: 'leibniz', type: 'opposition', explanation: '微分積分学の先取権をめぐって争った', sources: ['wp-leibniz'] },
  { from: 'heliocentrism', to: 'solar-system', type: 'application', explanation: '太陽を中心とする太陽系の理解につながった', kind: 'opinion' },
  { from: 'binary', to: 'computer', type: 'application', explanation: 'コンピュータは二進法で情報を扱う', sources: ['wp-binary'] },
  { from: 'kanji', to: 'hiragana', type: 'historical', explanation: '漢字の草書体から平仮名が作られた', sources: ['wp-hiragana'] },
  { from: 'latin', to: 'rome', type: 'partWhole', explanation: 'ローマ帝国で使われた言語', sources: ['wp-latin'] },
  { from: 'mercurius', to: 'mercury-planet', type: 'historical', explanation: '神の名が惑星の英語名になった', sources: ['wp-mercury-planet'] },
];

/**
 * 雑学（星をタップしたときに「✦ 雑学」として1つ見せる）。
 * 出典はその星のWikipedia記事。
 * 定説として知られる話を選んでいるが、逸話や異説も含む（ファクトチェックの題材）。
 */
const T = (text: string) => ({ text, topic: '雑学' });
export const STARTER_TRIVIA: Record<string, { text: string; topic: string }[]> = {
  socrates: [
    T('死刑は、毒ニンジン（ドクニンジン）の杯を飲むことで執行された。'),
    T('妻のクサンティッペは「悪妻」として多くの逸話が伝えられている。'),
  ],
  plato: [T('「プラトン」は本名ではなく、「広い」を意味するあだ名だという説がある。')],
  aristotle: [T('弟子たちと歩きながら議論したことから、その学派は「逍遥学派（ペリパトス派）」と呼ばれる。')],
  descartes: [T('スウェーデン女王クリスティーナに招かれ、早朝の講義を続けるうちに肺炎にかかり、ストックホルムで亡くなった。')],
  kant: [T('毎日決まった時刻に散歩したため、町の人がそれで時計を合わせたという逸話がある。')],
  athens: [T('都市の名前は、守護神である女神アテーナーに由来する。')],
  alexander: [T('愛馬ブケファラスが死んだとき、その名にちなむ都市を建設した。')],
  renaissance: [T('「ルネサンス」はフランス語で「再生」を意味する。')],
  gutenberg: [T('グーテンベルク聖書は現存する数が少なく、世界で最も貴重な本の一つとされる。')],
  'french-revolution': [T('長さの単位メートルを基準とするメートル法は、フランス革命期に定められた。')],
  edo: [T('江戸時代は約260年続いた。')],
  newton: [
    T('ペストの流行で大学が閉鎖され故郷にいた時期に、重要な発見の多くを成し遂げた。'),
    T('晩年は王立造幣局の長官を務め、偽金づくりの取り締まりにも関わった。'),
  ],
  einstein: [T('死後、脳が取り出されて保存され、研究の対象となった。')],
  relativity: [T('GPS衛星の時計は、相対性理論による時間の進み方の違いを補正して使われている。')],
  quantum: [T('「[[シュレーディンガーの猫]]」は、量子力学の解釈の奇妙さを示すための思考実験である。')],
  democritus: [T('いつも笑っていたことから「笑う哲学者」と呼ばれた。')],
  galileo: [T('1992年、ローマ教皇庁はガリレオの裁判が誤りだったことを認めた。')],
  pythagoras: [T('ピタゴラスの教団では、豆を食べることが禁じられていたと伝えられる。')],
  pythagorean: [T('証明の方法は数百通りあるといわれる。')],
  sun: [
    T('太陽の光が地球に届くまでには、約8分20秒かかる。'),
    T('太陽系全体の質量の約99.8%を太陽が占める。'),
  ],
  'mercury-planet': [T('水星では、1日（日の出から次の日の出まで）が約176地球日で、1年（約88日）より長い。')],
  moon: [
    T('月は地球に常に同じ面を向けている。'),
    T('月は1年に約3.8センチメートルずつ地球から遠ざかっている。'),
  ],
  apollo11: [T('月面に置かれた反射鏡は、今も地球と月の距離をレーザーで測るのに使われている。')],
  pluto: [T('「Pluto」という名前は、イギリスの11歳の少女ヴェネチア・バーニーが提案した。')],
  bigbang: [T('「ビッグバン」という名前は、この理論に批判的だった天文学者フレッド・ホイルが付けた。')],
  darwin: [T('はじめは医学を学んだが、手術を見るのが耐えられず医師になるのをやめた。')],
  dna: [T('ヒトの1つの細胞に含まれるDNAをまっすぐに伸ばすと、約2メートルになる。')],
  cell: [T('ヒトの体は約37兆個の細胞からなると推定されている。')],
  mendel: [T('遺伝の法則は生前ほとんど評価されず、死後の1900年に再発見された。')],
  dinosaur: [T('「恐竜（Dinosauria）」という名前は「恐ろしいトカゲ」を意味する。')],
  pi: [T('3月14日は「円周率の日」とされている。')],
  fibonacci: [T('数列は、ウサギのつがいが増えていく様子を考える問題として紹介された。')],
  monalisa: [T('1911年にルーヴル美術館から盗まれ、2年後にイタリアで見つかった。')],
  louvre: [T('中庭のガラスのピラミッドは、1989年に完成した入口である。')],
  parthenon: [T('1687年、火薬庫として使われていたときに砲撃を受けて爆発し、大きく壊れた。')],
  vangogh: [T('生前に売れた絵は『赤い葡萄畑』の1点だけという話がよく知られるが、異説もある。')],
  hokusai: [
    T('生涯に90回以上も引っ越しをしたといわれる。'),
    T('「画狂老人卍」など、生涯に30以上の画号を使った。'),
  ],
  ukiyoe: [T('輸出された陶磁器の包み紙として浮世絵がヨーロッパに渡った、という話が伝えられている。')],
  impressionism: [T('「印象派」という呼び名は、もともと批評家がからかって使った言葉だった。')],
  bach: [T('2度の結婚で、合わせて20人の子どもをもうけた。')],
  beethoven: [T('ウィーンで何十回も引っ越しを繰り返したことで知られる。')],
  mozart: [T('35歳の若さで亡くなった。')],
  latin: [T('現在もバチカン市国の公用語の一つである。')],
  hiragana: [T('すべての仮名を1回ずつ使って作られた歌に「[[いろは歌]]」がある。')],
  genji: [T('二千円札の裏面に、源氏物語絵巻の一場面と紫式部が描かれている。')],
  murasaki: [T('本名は分かっていない。「紫式部」は宮中での呼び名である。')],
  'adam-smith': [T('「見えざる手」という言葉は、『国富論』の中では一度しか使われていない。')],
  'invisible-hand': [T('有名な言葉だが、『国富論』の中で使われたのは一度だけである。')],
  money: [T('ミクロネシアのヤップ島では、大きな石の貨幣（石貨）が使われてきた。')],
  turing: [T('2021年から、イングランド銀行の50ポンド紙幣に肖像が描かれている。')],
  binary: [T('[[ゴットフリート・ライプニッツ]]は、中国の易経の八卦に二進法との共通点を見いだした。')],
  computer: [T('英語の「computer」は、もともと「計算をする人」を指す言葉だった。')],
  wikipedia: [T('「Wiki」は、ハワイ語で「速い」を意味する言葉に由来する。')],
  water: [T('水は約4℃で最も密度が大きくなる。そのため氷は水に浮く。')],
  nobel: [T('賞を作ったアルフレッド・ノーベルは、ダイナマイトの発明者である。')],
};
