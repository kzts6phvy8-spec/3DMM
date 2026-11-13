// 文の中で「星にできる言葉」を決める：Wikipediaで別の記事になっている言葉＋宇宙にある星の名前
import { useMemo } from 'react';
import { useCosmos } from '../store/useCosmos';

export function useTermsFor(sentences: string[], wikiLinks: string[], selfId: string): { terms: string[]; blockers: string[] } {
  const nodes = useCosmos((s) => s.nodes);
  return useMemo(() => {
    const self = nodes.find((n) => n.id === selfId);
    const selfNames = new Set(self ? [self.title, ...self.aliases] : []);
    const candidates = new Set<string>(wikiLinks);
    for (const n of nodes) for (const name of [n.title, ...n.aliases]) candidates.add(name);
    const joined = sentences.join('\n');
    // 実際に文の中に出てくる言葉だけにする（自分自身の名前は除く）
    return {
      terms: [...candidates].filter((t) => t.length >= 2 && !selfNames.has(t) && joined.includes(t)),
      blockers: [...selfNames],
    };
  }, [sentences, wikiLinks, nodes, selfId]);
}
