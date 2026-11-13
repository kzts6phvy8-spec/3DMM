import type { CosmosData, KnowledgeNode, Relation } from './types';

const t = '2026-01-01T00:00:00.000Z';

function node(id: string, title: string, description: string, category: string, tags: string[], position: [number, number, number], importance: number): KnowledgeNode {
  return { id, title, description, category, tags, sourceUrl: '', createdAt: t, updatedAt: t, position, importance };
}

/** 初回起動時だけ表示するサンプル知識（5個） */
export function createSampleData(): CosmosData {
  const nodes: KnowledgeNode[] = [
    node('s-socrates', 'ソクラテス', '古代ギリシャ・アテナイの哲学者。著作を残さず、対話によって哲学した。', '哲学', ['人物', '古代ギリシャ'], [0, 0, 0], 5),
    node('s-ignorance', '無知の知', '自分が知らないということを自覚していること。ソクラテスの思想の核。', '哲学', ['概念'], [3, 1.5, -1], 3),
    node('s-dialectic', '問答法', '問いと答えを重ねて相手の思い込みを明らかにし、真理に近づく方法。', '哲学', ['方法'], [-2.5, 2, 1.5], 3),
    node('s-plato', 'プラトン', 'ソクラテスの弟子。師の対話を著作として残し、イデア論を説いた。', '哲学', ['人物', '古代ギリシャ'], [-3, -1.5, -2], 4),
    node('s-greek', '古代ギリシャ哲学', '紀元前6世紀頃からの、自然や人間を理性で探究した思想の流れ。', '歴史', ['時代'], [1.5, -3, 2], 4),
  ];
  const rel = (id: string, s: string, tg: string, relationType: Relation['relationType'], explanation: string): Relation => ({
    id, sourceNodeId: s, targetNodeId: tg, relationType, explanation, createdAt: t,
  });
  const relations: Relation[] = [
    rel('r1', 's-socrates', 's-ignorance', 'application', 'ソクラテスが説いた考え方'),
    rel('r2', 's-socrates', 's-dialectic', 'application', 'ソクラテスが用いた対話の方法'),
    rel('r3', 's-socrates', 's-plato', 'historical', '師弟関係'),
    rel('r4', 's-socrates', 's-greek', 'partWhole', '古代ギリシャ哲学を代表する人物'),
  ];
  return { nodes, relations };
}
