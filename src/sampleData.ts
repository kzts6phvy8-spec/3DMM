import type { CosmosData } from './types';
import { buildDataset } from './data/buildDataset';

/**
 * 初回起動時のサンプル（5個）。
 * AIが用意した内容なので、状態は最高でも「出典あり」。確認済みにはしていない。
 */
export function createSampleData(): CosmosData {
  return buildDataset({
    origin: 'starter',
    createdAt: '2026-01-01T00:00:00.000Z',
    sources: [
      { key: 'wp-socrates', type: 'web', title: 'Wikipedia：ソクラテス', url: 'https://ja.wikipedia.org/wiki/ソクラテス' },
      { key: 'wp-plato', type: 'web', title: 'Wikipedia：プラトン', url: 'https://ja.wikipedia.org/wiki/プラトン' },
      { key: 'wp-ignorance', type: 'web', title: 'Wikipedia：無知の知', url: 'https://ja.wikipedia.org/wiki/無知の知' },
      { key: 'wp-dialectic', type: 'web', title: 'Wikipedia：問答法', url: 'https://ja.wikipedia.org/wiki/問答法' },
    ],
    stars: [
      {
        key: 'socrates', title: 'ソクラテス', aliases: ['Socrates'], kind: 'person', category: '哲学',
        tags: ['古代ギリシャ'], summary: '古代ギリシャ・アテナイの哲学者。', importance: 5, position: [0, 0, 0],
        statements: [
          { text: '古代ギリシャの[[アテナイ]]で活動した哲学者である。', sources: ['wp-socrates'] },
          { text: '自身は著作を残さず、その思想は主に弟子の[[プラトン]]の著作を通じて伝わっている。', sources: ['wp-socrates'] },
          { text: '紀元前399年に裁判で死刑判決を受け、刑死した。', topic: '歴史', sources: ['wp-socrates'] },
          { text: '[[無知の知]]は、現代の[[科学的懐疑]]の態度に通じるところがある。', kind: 'opinion' },
        ],
      },
      {
        key: 'ignorance', title: '無知の知', kind: 'concept', category: '哲学',
        summary: '自分が知らないということを自覚していること。', importance: 3, position: [3, 1.5, -1],
        statements: [
          { text: '[[ソクラテス]]の思想を表す言葉として知られる。', sources: ['wp-ignorance'] },
          { text: '[[デルポイの神託]]をめぐる逸話と結びつけて語られる。', topic: '由来', sources: ['wp-ignorance'] },
        ],
      },
      {
        key: 'dialectic', title: '問答法', kind: 'concept', category: '哲学',
        summary: '問いと答えを重ねて相手の考えを吟味する方法。', importance: 3, position: [-2.5, 2, 1.5],
        statements: [
          { text: '[[ソクラテス]]が対話の中で用いた方法として知られる。', sources: ['wp-dialectic'] },
        ],
      },
      {
        key: 'plato', title: 'プラトン', aliases: ['Plato'], kind: 'person', category: '哲学',
        tags: ['古代ギリシャ'], summary: 'ソクラテスの弟子で、古代ギリシャの哲学者。', importance: 4, position: [-3, -1.5, -2],
        statements: [
          { text: '[[ソクラテス]]の弟子である。', sources: ['wp-plato'] },
          { text: '[[イデア論]]を説いた。', sources: ['wp-plato'] },
          { text: '[[アテナイ]]に学園[[アカデメイア]]を開いた。', sources: ['wp-plato'] },
        ],
      },
      {
        key: 'greek', title: '古代ギリシャ哲学', aliases: ['古代ギリシア哲学'], kind: 'concept', category: '歴史',
        summary: '古代ギリシャで展開された哲学の総称。', importance: 4, position: [1.5, -3, 2],
        statements: [
          { text: '[[ソクラテス]]、[[プラトン]]、[[アリストテレス]]らが代表的な哲学者として挙げられる。' },
        ],
      },
    ],
    relations: [
      { from: 'socrates', to: 'plato', type: 'historical', explanation: '師弟関係', sources: ['wp-plato'] },
    ],
  });
}
