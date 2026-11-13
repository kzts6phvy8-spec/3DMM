// 2つの星をつなぐときに、関係の種類と理由を入力するフォーム
import { useState, type FormEvent } from 'react';
import { useCosmos } from '../store/useCosmos';
import { RELATION_TYPES, type RelationType } from '../types';
import { RELATION_COLORS } from '../lib/util';
import { displayName } from '../lib/knowledge';

export function RelationForm() {
  const pending = useCosmos((s) => s.pendingConnection);
  const nodes = useCosmos((s) => s.nodes);
  const { addRelation, cancelConnection } = useCosmos.getState();
  const [type, setType] = useState<RelationType>('similarity');
  const [explanation, setExplanation] = useState('');
  const [explanationKind, setExplanationKind] = useState<'fact' | 'opinion'>('fact');

  if (!pending) return null;
  const source = nodes.find((n) => n.id === pending.sourceId);
  const target = nodes.find((n) => n.id === pending.targetId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    addRelation(pending.sourceId, pending.targetId, type, explanation.trim(), explanationKind);
  };

  return (
    <div className="modal-backdrop" onClick={cancelConnection}>
      <form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>つながりを作る</h2>
        <p className="pair">
          <strong>{source && displayName(source)}</strong> → <strong>{target && displayName(target)}</strong>
        </p>
        <div className="field">
          <span>関係の種類</span>
          <div className="chips wrap">
            {(Object.keys(RELATION_TYPES) as RelationType[]).map((k) => (
              <button
                type="button"
                key={k}
                className={k === type ? 'chip active' : 'chip'}
                style={k === type ? { borderColor: RELATION_COLORS[k], color: RELATION_COLORS[k] } : undefined}
                onClick={() => setType(k)}
              >
                {RELATION_TYPES[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>理由の区分</span>
          <div className="chips">
            <button type="button" className={explanationKind === 'fact' ? 'chip active' : 'chip'} onClick={() => setExplanationKind('fact')}>事実</button>
            <button type="button" className={explanationKind === 'opinion' ? 'chip active' : 'chip'} onClick={() => setExplanationKind('opinion')}>意見（自分の発見）</button>
          </div>
        </div>
        <label>
          つながる理由
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} placeholder="例：師弟関係" />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={cancelConnection}>戻る</button>
          <button type="submit" className="primary">つなぐ</button>
        </div>
      </form>
    </div>
  );
}
