// 初期セット 第2弾（約75個）。第1弾で「まだ知らない星」だった言葉を中心に、分野をまたぐ星を足す。
// 決まりは第1弾と同じ：事実にはその星のWikipedia記事を出典として付ける。
import type { RelationSpec, StarSpec } from './buildDataset';

const T = (text: string) => ({ text, topic: '雑学' });
const O = (text: string) => ({ text, kind: 'opinion' as const });

export const STARTER_STARS_2: StarSpec[] = [
  // ---------------- 哲学・思想 ----------------
  {
    key: 'academeia', title: 'アカデメイア', kind: 'place', category: '哲学', importance: 3, wp: 'アカデメイア',
    summary: 'プラトンがアテナイ郊外に開いた学園。',
    statements: [
      { text: '[[プラトン]]が紀元前387年頃に開いた学園である。' },
      { text: '英語の「academy（アカデミー）」の語源となった。', topic: '語源' },
    ],
  },
  {
    key: 'delphi', title: 'デルポイの神託', aliases: ['デルポイ'], kind: 'other', category: '歴史', importance: 2, wp: 'デルポイ',
    summary: '古代ギリシアの聖域デルポイで告げられたアポロンの神託。',
    statements: [
      { text: 'デルポイは、アポロンの神殿があった古代ギリシアの聖域である。' },
      { text: '「[[ソクラテス]]より賢い者はいない」という神託の逸話が、[[無知の知]]の由来として知られる。', sources: ['wp-ignorance'] },
      T('古代ギリシアでは「世界のへそ（中心）」と信じられていた。'),
    ],
  },
  {
    key: 'discourse', title: '方法序説', kind: 'work', category: '哲学', importance: 3, wp: '方法序説',
    summary: 'デカルトが1637年に出版した哲学書。',
    statements: [
      { text: '[[ルネ・デカルト]]が1637年に出版した。' },
      { text: '「[[我思う、ゆえに我あり]]」の命題が述べられている。' },
      T('もともとは、屈折光学・気象学・幾何学の3つの試論の序文として書かれた。'),
    ],
  },
  {
    key: 'critique', title: '純粋理性批判', kind: 'work', category: '哲学', importance: 2, wp: '純粋理性批判',
    summary: 'カントの主著。',
    statements: [{ text: '[[イマヌエル・カント]]の主著で、1781年に初版が出版された。' }],
  },
  {
    key: 'encyclopedie', title: '百科全書', kind: 'work', category: '歴史', importance: 3, wp: '百科全書',
    summary: '18世紀フランスで刊行された百科事典。',
    statements: [
      { text: 'ディドロとダランベールが中心となって編集した。' },
      { text: '18世紀のフランスで刊行され、[[啓蒙思想]]を広めた。' },
    ],
  },
  {
    key: 'confucius', title: '孔子', kind: 'person', category: '哲学', importance: 4, wp: '孔子',
    summary: '中国・春秋時代の思想家。儒教の祖。',
    statements: [
      { text: '中国の春秋時代の思想家である。' },
      { text: '弟子たちが孔子の言葉をまとめたものが『[[論語]]』である。' },
      O('[[ソクラテス]]と同じく、弟子たちの記録を通じて思想が伝えられた点が似ている。'),
    ],
  },
  {
    key: 'analects', title: '論語', kind: 'work', category: '哲学', importance: 3, wp: '論語',
    summary: '孔子と弟子たちの言行を記録した書物。',
    statements: [
      { text: '[[孔子]]と弟子たちの言行を記録した書物である。' },
      { text: '「温故知新」は論語に由来する言葉である。', topic: '語源' },
    ],
  },
  {
    key: 'buddha', title: '釈迦', aliases: ['ゴータマ・シッダールタ', 'ブッダ'], kind: 'person', category: '哲学', importance: 4, wp: '釈迦',
    summary: '仏教の開祖。',
    statements: [
      { text: '[[仏教]]の開祖である。' },
      { text: '本名はゴータマ・シッダールタとされる。' },
    ],
  },
  {
    key: 'buddhism', title: '仏教', kind: 'concept', category: '哲学', importance: 4, wp: '仏教',
    summary: '釈迦が開いた宗教。',
    statements: [
      { text: '[[釈迦]]が開いた宗教である。' },
      { text: '古代[[インド]]で生まれた。' },
    ],
  },

  // ---------------- 歴史・地理 ----------------
  {
    key: 'alexandria', title: 'アレクサンドリア', kind: 'place', category: '地理', importance: 3, wp: 'アレクサンドリア',
    summary: 'エジプトの地中海沿岸の都市。',
    statements: [
      { text: '[[アレクサンドロス大王]]によって建設された都市である。' },
      { text: '古代には「アレクサンドリア図書館」があったことで知られる。' },
      T('古代世界の七不思議の一つ「アレクサンドリアの大灯台」があった。'),
    ],
  },
  {
    key: 'italy', title: 'イタリア', kind: 'place', category: '地理', importance: 3, wp: 'イタリア',
    summary: '南ヨーロッパの国。',
    statements: [
      { text: '首都はローマである。' },
      { text: '[[ルネサンス]]が始まった地である。', sources: ['wp-renaissance'] },
    ],
  },
  {
    key: 'uk', title: 'イギリス', aliases: ['イギリス連合王国', '英国'], kind: 'place', category: '地理', importance: 3, wp: 'イギリス',
    summary: 'ヨーロッパ北西部の島国。',
    statements: [
      { text: '首都はロンドンである。' },
      { text: '[[産業革命]]が始まった国である。', sources: ['wp-industrial'] },
    ],
  },
  {
    key: 'india', title: 'インド', kind: 'place', category: '地理', importance: 3, wp: 'インド',
    summary: '南アジアの国。',
    statements: [
      { text: '首都はニューデリーである。' },
      { text: '数としての[[0]]の概念は、インドで確立されたとされる。', sources: ['wp-zero'] },
    ],
  },
  {
    key: 'paris', title: 'パリ', kind: 'place', category: '地理', importance: 3, wp: 'パリ',
    summary: 'フランスの首都。',
    statements: [
      { text: 'フランスの首都である。' },
      { text: '[[ルーヴル美術館]]がある。' },
      T('エッフェル塔は、1889年のパリ万国博覧会に合わせて建てられた。'),
    ],
  },
  {
    key: 'salzburg', title: 'ザルツブルク', kind: 'place', category: '地理', importance: 2, wp: 'ザルツブルク',
    summary: 'オーストリアの都市。',
    statements: [
      { text: 'オーストリアの都市である。' },
      { text: '[[ヴォルフガング・アマデウス・モーツァルト]]が生まれた町である。' },
      T('映画『サウンド・オブ・ミュージック』の舞台としても知られる。'),
    ],
  },
  {
    key: 'galapagos', title: 'ガラパゴス諸島', kind: 'place', category: '地理', importance: 3, wp: 'ガラパゴス諸島',
    summary: '太平洋上のエクアドル領の島々。',
    statements: [
      { text: '太平洋上にある、エクアドル領の島々である。' },
      { text: '[[チャールズ・ダーウィン]]が訪れ、[[進化]]を考えるきっかけを得たとされる。' },
      T('独自の進化をとげた生き物が多いことから、日本では独自に発達した製品や市場を「ガラパゴス化」と呼ぶことがある。'),
    ],
  },
  {
    key: 'ieyasu', title: '徳川家康', kind: 'person', category: '歴史', importance: 3, wp: '徳川家康',
    summary: '江戸幕府の初代将軍。',
    statements: [
      { text: '江戸幕府の初代将軍である。' },
      { text: '1603年に征夷大将軍に任じられた。' },
    ],
  },
  {
    key: 'rights', title: '人権宣言', aliases: ['フランス人権宣言'], kind: 'work', category: '歴史', importance: 3, wp: '人間と市民の権利の宣言',
    summary: 'フランス革命の中で採択された宣言。',
    statements: [
      { text: '[[フランス革命]]中の1789年に採択された。' },
      { text: '人間の自由と平等などをうたっている。' },
    ],
  },
  {
    key: 'depression', title: '世界恐慌', kind: 'event', category: '歴史', importance: 3, wp: '世界恐慌',
    summary: '1929年に始まった世界的な大不況。',
    statements: [
      { text: '1929年のニューヨーク株式市場の大暴落をきっかけに始まった。' },
      { text: '世界中に広がった深刻な不況である。' },
    ],
  },
  {
    key: 'caesar', title: 'ガイウス・ユリウス・カエサル', aliases: ['カエサル', 'シーザー'], kind: 'person', category: '歴史', importance: 4, wp: 'ガイウス・ユリウス・カエサル',
    summary: '共和政ローマ末期の政治家・軍人。',
    statements: [
      { text: '共和政ローマ末期の政治家・軍人である。' },
      { text: '暦の「ユリウス暦」を定めた。' },
      T('英語の「July（7月）」は、彼の名前に由来する。'),
    ],
  },
  {
    key: 'gregorian', title: 'グレゴリオ暦', kind: 'concept', category: '歴史', importance: 3, wp: 'グレゴリオ暦',
    summary: '現在世界で広く使われている暦。',
    statements: [
      { text: '1582年にローマ教皇グレゴリウス13世が定めた。' },
      { text: '[[ガイウス・ユリウス・カエサル]]が定めたユリウス暦を改良したものである。' },
    ],
  },
  {
    key: 'egypt', title: '古代エジプト', kind: 'place', category: '歴史', importance: 4, wp: '古代エジプト',
    summary: 'ナイル川流域に栄えた古代文明。',
    statements: [
      { text: 'ナイル川の流域に栄えた文明である。' },
      { text: '[[ピラミッド]]が建てられた。' },
      { text: '[[ヒエログリフ]]という文字が使われた。' },
    ],
  },
  {
    key: 'pyramid', title: 'ピラミッド', kind: 'place', category: '歴史', importance: 3, wp: 'ピラミッド',
    summary: '古代エジプトなどで造られた四角錐の巨大建造物。',
    statements: [
      { text: '[[古代エジプト]]の王の墓とされる巨大な建造物である。' },
      { text: 'ギザの大ピラミッドは、古代世界の七不思議の一つである。' },
    ],
  },
  {
    key: 'hieroglyph', title: 'ヒエログリフ', aliases: ['神聖文字'], kind: 'concept', category: '言語', importance: 3, wp: 'ヒエログリフ',
    summary: '古代エジプトで使われた文字。',
    statements: [
      { text: '[[古代エジプト]]で使われた文字である。' },
      { text: '[[ロゼッタ・ストーン]]をもとに、シャンポリオンが解読した。' },
    ],
  },
  {
    key: 'rosetta', title: 'ロゼッタ・ストーン', kind: 'other', category: '歴史', importance: 3, wp: 'ロゼッタ・ストーン',
    summary: '古代エジプトの文字解読の手がかりとなった石碑。',
    statements: [
      { text: '同じ内容が、[[ヒエログリフ]]・デモティック・[[ギリシア文字]]の3種類で刻まれている。' },
      { text: '大英博物館に所蔵されている。' },
    ],
  },

  // ---------------- 科学・技術 ----------------
  {
    key: 'compass', title: '羅針盤', aliases: ['コンパス'], kind: 'concept', category: '技術', importance: 2, wp: '方位磁針',
    summary: '方位を知るための道具。',
    statements: [
      { text: '磁石が南北を指す性質を利用して、方位を知る道具である。' },
      { text: '[[火薬]]・[[活版印刷]]とともに「ルネサンスの三大発明」に数えられることがある。', sources: ['wp-printing'] },
    ],
  },
  {
    key: 'gunpowder', title: '火薬', kind: 'concept', category: '化学', importance: 2, wp: '火薬',
    summary: '燃焼・爆発を利用する物質。',
    statements: [
      { text: '古代中国で発明されたとされる。' },
      { text: '黒色火薬は、硝石・硫黄・木炭を混ぜて作られる。' },
    ],
  },
  {
    key: 'watt', title: 'ジェームズ・ワット', kind: 'person', category: '技術', importance: 3, wp: 'ジェームズ・ワット',
    summary: 'スコットランドの技術者・発明家。',
    statements: [
      { text: '[[蒸気機関]]の改良で知られる。' },
      { text: '仕事率の単位「ワット」は、彼の名前に由来する。', topic: '語源' },
    ],
  },
  {
    key: 'principia', title: 'プリンキピア', aliases: ['自然哲学の数学的諸原理'], kind: 'work', category: '物理学', importance: 3, wp: '自然哲学の数学的諸原理',
    summary: 'ニュートンの主著。',
    statements: [
      { text: '[[アイザック・ニュートン]]が1687年に出版した。' },
      { text: '運動の法則と[[万有引力]]について述べている。' },
    ],
  },
  {
    key: 'copernicus', title: 'ニコラウス・コペルニクス', aliases: ['コペルニクス'], kind: 'person', category: '天文学', importance: 4, wp: 'ニコラウス・コペルニクス',
    summary: 'ポーランド出身の天文学者。',
    statements: [
      { text: '[[地動説]]を唱えた。' },
      T('主著『天球回転論』は、彼が亡くなった1543年に出版された。'),
    ],
  },
  {
    key: 'armstrong', title: 'ニール・アームストロング', kind: 'person', category: '天文学', importance: 3, wp: 'ニール・アームストロング',
    summary: 'アメリカの宇宙飛行士。',
    statements: [
      { text: '[[アポロ11号]]の船長として、人類で初めて[[月]]面に降り立った。' },
      T('「これは一人の人間にとっては小さな一歩だが、人類にとっては偉大な飛躍である」という言葉で知られる。'),
    ],
  },
  {
    key: 'blackhole', title: 'ブラックホール', kind: 'concept', category: '天文学', importance: 4, wp: 'ブラックホール',
    summary: '光さえ抜け出せないほど重力が強い天体。',
    statements: [
      { text: '重力が非常に強く、[[光]]さえも抜け出せない天体である。' },
      { text: '一般[[相対性理論]]から、その存在が予言された。' },
      T('2019年、ブラックホールの姿（影）が初めて撮影された。'),
    ],
  },
  {
    key: 'hawking', title: 'スティーヴン・ホーキング', aliases: ['ホーキング'], kind: 'person', category: '物理学', importance: 3, wp: 'スティーヴン・ホーキング',
    summary: 'イギリスの理論物理学者。',
    statements: [
      { text: '[[ブラックホール]]の研究で知られる。' },
      { text: 'ブラックホールが粒子を放出するという「ホーキング放射」を理論的に示した。' },
      T('筋萎縮性側索硬化症（ALS）を患いながら研究を続けた。'),
    ],
  },
  {
    key: 'schrodinger-cat', title: 'シュレーディンガーの猫', kind: 'concept', category: '物理学', importance: 3, wp: 'シュレーディンガーの猫',
    summary: '量子力学の解釈の問題を示す思考実験。',
    statements: [
      { text: '物理学者エルヴィン・シュレーディンガーが1935年に示した思考実験である。' },
      { text: '[[量子力学]]の解釈の問題を示すために考えられた。' },
    ],
  },
  {
    key: 'periodic', title: '周期表', aliases: ['元素周期表'], kind: 'concept', category: '化学', importance: 4, wp: '周期表',
    summary: '元素を性質の周期性に従って並べた表。',
    statements: [
      { text: '元素を原子番号の順に並べ、性質の似たものが同じ列に来るようにした表である。' },
      { text: '[[ドミトリ・メンデレーエフ]]が1869年に発表した。' },
      { text: '最初に置かれる元素は[[水素]]である。' },
    ],
  },
  {
    key: 'mendeleev', title: 'ドミトリ・メンデレーエフ', aliases: ['メンデレーエフ'], kind: 'person', category: '化学', importance: 3, wp: 'ドミトリ・メンデレーエフ',
    summary: 'ロシアの化学者。',
    statements: [
      { text: '[[周期表]]を作った。' },
      T('当時まだ見つかっていなかった元素の存在と性質を予言した。'),
      { text: '元素「メンデレビウム」は、彼の名前にちなむ。', topic: '語源' },
    ],
  },
  {
    key: 'edison', title: 'トーマス・エジソン', aliases: ['エジソン'], kind: 'person', category: '技術', importance: 4, wp: 'トーマス・エジソン',
    summary: 'アメリカの発明家。',
    statements: [
      { text: '蓄音機の発明や、白熱電球の改良などで知られる。' },
      T('直流を推したエジソンと、交流を推した[[ニコラ・テスラ]]らの争いは「電流戦争」と呼ばれる。'),
    ],
  },
  {
    key: 'tesla', title: 'ニコラ・テスラ', kind: 'person', category: '技術', importance: 3, wp: 'ニコラ・テスラ',
    summary: '交流電気の発展に貢献した発明家。',
    statements: [
      { text: '交流の電力システムの発展に貢献した。' },
      { text: '磁束密度の単位「テスラ」は、彼の名前に由来する。', topic: '語源' },
      T('電気自動車メーカー「テスラ」の社名も、彼にちなんでいる。'),
    ],
  },
  {
    key: 'hooke', title: 'ロバート・フック', kind: 'person', category: '物理学', importance: 3, wp: 'ロバート・フック',
    summary: 'イングランドの自然哲学者。',
    statements: [
      { text: '顕微鏡による観察をまとめた『ミクログラフィア』を著した。' },
      { text: 'ばねの伸びと力の関係を表す「フックの法則」で知られる。' },
      { text: '[[細胞]]（cell）という名前を付けた。', sources: ['wp-cell'] },
    ],
  },
  {
    key: 'enigma', title: 'エニグマ', kind: 'other', category: '技術', importance: 3, wp: 'エニグマ (暗号機)',
    summary: 'ドイツ軍が使った暗号機。',
    statements: [
      { text: '第二次世界大戦でドイツ軍が使った暗号機である。' },
      { text: '[[アラン・チューリング]]らが解読に取り組んだ。' },
    ],
  },
  {
    key: 'turing-test', title: 'チューリング・テスト', kind: 'concept', category: '技術', importance: 3, wp: 'チューリング・テスト',
    summary: '機械が人間のように考えられるかを判定するテスト。',
    statements: [
      { text: '[[アラン・チューリング]]が1950年に提案した。' },
      O('今のAIの時代になっても、「知能とは何か」を問い続ける問いである。'),
    ],
  },
  {
    key: 'dartmouth', title: 'ダートマス会議', kind: 'event', category: '技術', importance: 2, wp: 'ダートマス会議',
    summary: '1956年に開かれた人工知能の研究会議。',
    statements: [
      { text: '1956年に開かれ、[[人工知能]]が研究分野として確立するきっかけとなった。' },
      { text: '会議の提案書で「人工知能（artificial intelligence）」という言葉が使われた。', topic: '語源' },
    ],
  },
  {
    key: 'arpanet', title: 'ARPANET', aliases: ['アーパネット'], kind: 'other', category: '技術', importance: 2, wp: 'ARPANET',
    summary: 'アメリカで作られた初期のコンピュータネットワーク。',
    statements: [
      { text: 'アメリカ国防総省の研究機関の支援で作られたコンピュータネットワークである。' },
      { text: '[[インターネット]]の起源とされる。' },
    ],
  },
  {
    key: 'www', title: 'World Wide Web', aliases: ['WWW', 'ウェブ'], kind: 'concept', category: '技術', importance: 3, wp: 'World Wide Web',
    summary: 'インターネット上で文書をリンクでつなぐ仕組み。',
    statements: [
      { text: '[[ティム・バーナーズ＝リー]]が1989年に提案した。' },
      O('ページからページへリンクでたどる仕組みは、この宇宙の「寄り道」と同じ考え方である。'),
    ],
  },
  {
    key: 'berners-lee', title: 'ティム・バーナーズ＝リー', kind: 'person', category: '技術', importance: 3, wp: 'ティム・バーナーズ＝リー',
    summary: 'イギリスの計算機科学者。',
    statements: [
      { text: '[[World Wide Web]]を考案した。' },
      { text: '欧州原子核研究機構（CERN）で働いていたときに考案した。' },
    ],
  },
  {
    key: 'alfred-nobel', title: 'アルフレッド・ノーベル', kind: 'person', category: '化学', importance: 3, wp: 'アルフレッド・ノーベル',
    summary: 'スウェーデンの化学者・発明家。',
    statements: [
      { text: 'ダイナマイトを発明した。' },
      { text: '遺言によって[[ノーベル賞]]が作られた。' },
    ],
  },

  // ---------------- 生物学 ----------------
  {
    key: 'origin-species', title: '種の起源', kind: 'work', category: '生物学', importance: 3, wp: '種の起源',
    summary: 'ダーウィンが進化論を論じた本。',
    statements: [
      { text: '[[チャールズ・ダーウィン]]が1859年に出版した。' },
      { text: '[[自然選択]]による[[進化]]を論じた。' },
    ],
  },
  {
    key: 'beagle', title: 'ビーグル号', kind: 'other', category: '生物学', importance: 2, wp: 'ビーグル (帆船)',
    summary: 'ダーウィンが乗った測量船。',
    statements: [{ text: '[[チャールズ・ダーウィン]]が乗船して世界を航海した、イギリス海軍の測量船である。' }],
  },
  {
    key: 'wallace', title: 'アルフレッド・ラッセル・ウォレス', aliases: ['ウォレス'], kind: 'person', category: '生物学', importance: 2, wp: 'アルフレッド・ラッセル・ウォレス',
    summary: 'イギリスの博物学者。',
    statements: [
      { text: '[[チャールズ・ダーウィン]]とは独立に、[[自然選択]]の考えにたどり着いた。' },
    ],
  },
  {
    key: 'watson', title: 'ジェームズ・ワトソン', kind: 'person', category: '生物学', importance: 2, wp: 'ジェームズ・ワトソン',
    summary: 'アメリカの分子生物学者。',
    statements: [
      { text: '[[フランシス・クリック]]とともに、[[DNA]]の二重らせん構造を提唱した。' },
      { text: '1962年に[[ノーベル賞]]（生理学・医学賞）を受賞した。' },
    ],
  },
  {
    key: 'crick', title: 'フランシス・クリック', kind: 'person', category: '生物学', importance: 2, wp: 'フランシス・クリック',
    summary: 'イギリスの分子生物学者。',
    statements: [{ text: '[[ジェームズ・ワトソン]]とともに、[[DNA]]の二重らせん構造を提唱した。' }],
  },
  {
    key: 'mendel-law', title: 'メンデルの法則', kind: 'concept', category: '生物学', importance: 3, wp: 'メンデルの法則',
    summary: '遺伝の基本的な法則。',
    statements: [
      { text: '[[グレゴール・ヨハン・メンデル]]が発見した遺伝の法則である。' },
      { text: '優性（顕性）の法則・分離の法則・独立の法則からなる。' },
    ],
  },

  // ---------------- 数学 ----------------
  {
    key: 'elements', title: '原論', aliases: ['ユークリッド原論'], kind: 'work', category: '数学', importance: 3, wp: 'ユークリッド原論',
    summary: 'エウクレイデスがまとめた数学書。',
    statements: [
      { text: '[[エウクレイデス]]がまとめた数学書である。' },
      { text: '[[三平方の定理]]の証明も含まれている。' },
    ],
  },

  // ---------------- 芸術・音楽 ----------------
  {
    key: 'last-supper', title: '最後の晩餐', kind: 'work', category: '芸術', importance: 3, wp: '最後の晩餐 (レオナルド・ダ・ヴィンチ)',
    summary: 'レオナルド・ダ・ヴィンチの壁画。',
    statements: [
      { text: '[[レオナルド・ダ・ヴィンチ]]が、ミラノの修道院の食堂の壁に描いた。' },
      T('新しい技法を試したため、完成後まもなく傷み始めた。'),
    ],
  },
  {
    key: 'athena', title: 'アテーナー', aliases: ['アテナ'], kind: 'person', category: '神話', importance: 3, wp: 'アテーナー',
    summary: 'ギリシア神話の知恵と戦いの女神。',
    statements: [
      { text: 'ギリシア神話の知恵と戦いの女神である。' },
      { text: '[[アテナイ]]の守護神で、[[パルテノン神殿]]に祀られた。' },
    ],
  },
  {
    key: 'hermes', title: 'ヘルメス', aliases: ['ヘルメース'], kind: 'person', category: '神話', importance: 2, wp: 'ヘルメース',
    summary: 'ギリシア神話の神々の伝令。',
    statements: [
      { text: 'ギリシア神話の神で、神々の伝令役とされる。' },
      { text: 'ローマ神話の[[メルクリウス]]と同一視される。' },
    ],
  },
  {
    key: 'sunflowers', title: 'ひまわり', aliases: ['ひまわり (絵画)'], kind: 'work', category: '芸術', importance: 2, wp: 'ひまわり (絵画)',
    summary: 'ゴッホが描いた、花瓶に挿したひまわりの連作。',
    statements: [
      { text: '[[フィンセント・ファン・ゴッホ]]が描いた、花瓶に挿したひまわりの連作である。' },
      T('1987年、そのうちの1点を日本の保険会社が当時の史上最高額で落札した。'),
    ],
  },
  {
    key: 'japonisme', title: 'ジャポニスム', kind: 'concept', category: '芸術', importance: 3, wp: 'ジャポニスム',
    summary: '19世紀後半のヨーロッパで流行した日本趣味。',
    statements: [
      { text: '19世紀後半のヨーロッパで流行した、日本の美術や文化への関心である。' },
      { text: '[[浮世絵]]が大きな影響を与えた。' },
    ],
  },
  {
    key: 'fugaku', title: '富嶽三十六景', aliases: ['冨嶽三十六景'], kind: 'work', category: '芸術', importance: 3, wp: '富嶽三十六景',
    summary: '葛飾北斎による富士山の浮世絵の連作。',
    statements: [
      { text: '[[葛飾北斎]]による、富士山を描いた浮世絵の連作である。' },
      { text: '「神奈川沖浪裏」はその代表作である。' },
      T('評判がよかったため10図が追加され、実際には全46図ある。'),
    ],
  },
  {
    key: 'monet', title: 'クロード・モネ', aliases: ['モネ'], kind: 'person', category: '芸術', importance: 4, wp: 'クロード・モネ',
    summary: 'フランスの画家。印象派を代表する一人。',
    statements: [
      { text: '[[印象派]]を代表する画家の一人である。' },
      { text: '作品『印象・日の出』は、「印象派」という名前の由来となった。', sources: ['wp-impressionism'] },
      T('晩年は、自宅の庭の睡蓮を繰り返し描いた。'),
    ],
  },
  {
    key: 'michelangelo', title: 'ミケランジェロ', kind: 'person', category: '芸術', importance: 4, wp: 'ミケランジェロ・ブオナローティ',
    summary: 'ルネサンス期のイタリアの彫刻家・画家・建築家。',
    statements: [
      { text: '[[ルネサンス]]期のイタリアの彫刻家・画家・建築家である。' },
      { text: 'システィーナ礼拝堂の天井画を描いた。' },
      { text: '彫刻「ダヴィデ像」で知られる。' },
    ],
  },
  {
    key: 'baroque', title: 'バロック音楽', kind: 'concept', category: '音楽', importance: 3, wp: 'バロック音楽',
    summary: '17世紀初めから18世紀半ばのヨーロッパの音楽。',
    statements: [
      { text: '[[ヨハン・ゼバスティアン・バッハ]]は、代表的な作曲家の一人である。' },
      { text: '「バロック」は、「ゆがんだ真珠」を意味するポルトガル語に由来するとされる。', topic: '語源' },
    ],
  },
  {
    key: 'schiller', title: 'フリードリヒ・フォン・シラー', aliases: ['シラー'], kind: 'person', category: '言語', importance: 2, wp: 'フリードリヒ・フォン・シラー',
    summary: 'ドイツの詩人・劇作家。',
    statements: [
      { text: 'ドイツの詩人・劇作家である。' },
      { text: '詩「歓喜に寄す」は、[[ルートヴィヒ・ヴァン・ベートーヴェン]]の交響曲第9番に用いられた。' },
    ],
  },
  {
    key: 'shakespeare', title: 'ウィリアム・シェイクスピア', aliases: ['シェイクスピア'], kind: 'person', category: '言語', importance: 4, wp: 'ウィリアム・シェイクスピア',
    summary: 'イングランドの劇作家・詩人。',
    statements: [
      { text: '『[[ハムレット]]』などの作品で知られる。' },
      T('多くの英単語や言い回しを作った、あるいは広めたといわれる。'),
    ],
  },
  {
    key: 'hamlet', title: 'ハムレット', kind: 'work', category: '言語', importance: 3, wp: 'ハムレット',
    summary: 'シェイクスピアの悲劇。',
    statements: [
      { text: '[[ウィリアム・シェイクスピア]]の悲劇である。' },
      { text: '「生きるべきか死ぬべきか、それが問題だ」という台詞で知られる。' },
    ],
  },

  // ---------------- 言語・文学 ----------------
  {
    key: 'italian', title: 'イタリア語', kind: 'concept', category: '言語', importance: 2, wp: 'イタリア語',
    summary: 'イタリアなどで話される言語。',
    statements: [
      { text: '[[ラテン語]]から生まれた[[ロマンス諸語]]の一つである。' },
      T('ピアノ・フォルテなど、多くの音楽用語はイタリア語である。'),
    ],
  },
  {
    key: 'french', title: 'フランス語', kind: 'concept', category: '言語', importance: 3, wp: 'フランス語',
    summary: 'フランスなどで話される言語。',
    statements: [
      { text: '[[ラテン語]]から生まれた[[ロマンス諸語]]の一つである。' },
      { text: '国際連合の公用語の一つである。' },
    ],
  },
  {
    key: 'greek-alphabet', title: 'ギリシア文字', kind: 'concept', category: '言語', importance: 3, wp: 'ギリシア文字',
    summary: 'ギリシア語を書き表すための文字。',
    statements: [
      { text: 'ギリシア語を書き表すための文字である。' },
      { text: '[[アルファベット]]という言葉は、最初の2文字「アルファ」と「ベータ」に由来する。', sources: ['wp-alphabet'] },
      { text: '数学の[[円周率]]を表す「π」も、ギリシア文字である。', sources: ['wp-pi'] },
    ],
  },
  {
    key: 'katakana', title: '片仮名', aliases: ['カタカナ'], kind: 'concept', category: '言語', importance: 3, wp: '片仮名',
    summary: '日本語を書き表す文字の一つ。',
    statements: [
      { text: '[[漢字]]の一部を取って作られた。' },
      { text: '現在は、主に外来語などを書き表すのに使われる。' },
    ],
  },
  {
    key: 'iroha', title: 'いろは歌', kind: 'work', category: '言語', importance: 2, wp: 'いろは歌',
    summary: 'すべての仮名を1回ずつ使った歌。',
    statements: [
      { text: 'すべての仮名を1回ずつ使って作られた歌である。' },
      { text: '「色は匂へど 散りぬるを」で始まる。' },
      T('かつては仮名の順番（いろは順）としても使われた。'),
    ],
  },
  {
    key: 'murasaki-diary', title: '紫式部日記', kind: 'work', category: '言語', importance: 2, wp: '紫式部日記',
    summary: '紫式部が書いた日記。',
    statements: [
      { text: '[[紫式部]]が書いた日記である。' },
      T('[[清少納言]]を批判する記述があることで知られる。'),
    ],
  },
  {
    key: 'sei-shonagon', title: '清少納言', kind: 'person', category: '言語', importance: 3, wp: '清少納言',
    summary: '平安時代中期の作家・歌人。',
    statements: [
      { text: '『[[枕草子]]』の作者である。' },
      T('[[紫式部]]とは仕えた主人が異なり、ライバルとして語られることが多い。'),
    ],
  },
  {
    key: 'makura', title: '枕草子', kind: 'work', category: '言語', importance: 3, wp: '枕草子',
    summary: '清少納言が書いた随筆。',
    statements: [
      { text: '[[清少納言]]が書いた随筆である。' },
      { text: '「春はあけぼの」で始まる。' },
    ],
  },
  {
    key: 'manyoshu', title: '万葉集', kind: 'work', category: '言語', importance: 3, wp: '万葉集',
    summary: '現存する日本最古の和歌集。',
    statements: [
      { text: '現存する日本最古の和歌集である。' },
      T('元号「令和」は、万葉集の一節から取られた。'),
    ],
  },

  // ---------------- 経済学・心理学 ----------------
  {
    key: 'wealth', title: '国富論', aliases: ['諸国民の富'], kind: 'work', category: '経済学', importance: 3, wp: '国富論',
    summary: 'アダム・スミスの主著。',
    statements: [
      { text: '[[アダム・スミス]]が1776年に出版した。' },
      { text: '「[[見えざる手]]」という言葉が出てくる。' },
    ],
  },
  {
    key: 'psychoanalysis', title: '精神分析学', aliases: ['精神分析'], kind: 'concept', category: '心理学', importance: 3, wp: '精神分析学',
    summary: 'フロイトが創始した心の理論と治療法。',
    statements: [
      { text: '[[ジークムント・フロイト]]が創始した。' },
      { text: '[[無意識]]の働きを重視する。' },
    ],
  },
];

export const STARTER_RELATIONS_2: RelationSpec[] = [
  { from: 'confucius', to: 'socrates', type: 'similarity', explanation: '弟子の記録を通じて思想が伝わった', kind: 'opinion' },
  { from: 'edison', to: 'tesla', type: 'opposition', explanation: '直流と交流をめぐる「電流戦争」', sources: ['wp-edison'] },
  { from: 'caesar', to: 'gregorian', type: 'historical', explanation: 'ユリウス暦が改良されてグレゴリオ暦になった', sources: ['wp-gregorian'] },
  { from: 'rosetta', to: 'hieroglyph', type: 'causal', explanation: 'ロゼッタ・ストーンがヒエログリフ解読の手がかりになった', sources: ['wp-hieroglyph'] },
  { from: 'hawking', to: 'blackhole', type: 'application', explanation: 'ブラックホールの理論を発展させた', sources: ['wp-hawking'] },
  { from: 'murasaki', to: 'sei-shonagon', type: 'opposition', explanation: 'ライバルとして語られる', kind: 'opinion' },
  { from: 'athena', to: 'athens', type: 'historical', explanation: '女神の名が都市の名の由来になった', sources: ['wp-athens'] },
  { from: 'hermes', to: 'mercurius', type: 'similarity', explanation: 'ギリシア神話とローマ神話で同一視される', sources: ['wp-hermes'] },
  { from: 'www', to: 'wikipedia', type: 'application', explanation: 'リンクで文書をつなぐ仕組みの上に作られた', kind: 'opinion' },
  { from: 'japonisme', to: 'monet', type: 'causal', explanation: '日本の美術がモネに影響を与えた', sources: ['wp-monet'] },
];
