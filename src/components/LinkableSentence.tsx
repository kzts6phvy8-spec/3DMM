// Wikipediaの候補の文を表示し、ほかの記事になっている言葉（点線）を押すと「星にする印」を付けられる。
import { segmentByTerms } from '../lib/wikipedia';

export function LinkableSentence({
  text,
  terms,
  blockers,
  marked,
  onToggle,
}: {
  text: string;
  terms: string[];
  blockers: string[];
  marked: Set<string>;
  onToggle: (term: string) => void;
}) {
  return (
    <span>
      {segmentByTerms(text, terms, blockers).map((s, i) =>
        s.term ? (
          <button
            key={i}
            type="button"
            className={`term${marked.has(s.term) ? ' is-marked' : ''}`}
            aria-pressed={marked.has(s.term)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle(s.term!);
            }}
          >
            {s.text}
            {marked.has(s.term) && <span className="term-star" aria-hidden>✦</span>}
          </button>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}
