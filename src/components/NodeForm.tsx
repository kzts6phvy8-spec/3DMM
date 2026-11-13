// 星（項目）の登録・編集フォーム
import { useMemo, useState, type FormEvent } from 'react';
import { useCosmos, type NodeInput } from '../store/useCosmos';
import { spawnPosition } from '../lib/sceneApi';
import { STAR_KINDS, type StarKind } from '../types';
import { displayName } from '../lib/knowledge';
import { normalize } from '../lib/search';

const splitList = (v: string) => v.split(/[,、，]/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean);

export function NodeForm({ editId, initialTitle, onClose }: { editId: string | null; initialTitle?: string; onClose: () => void }) {
  const nodes = useCosmos((s) => s.nodes);
  const { addNode, updateNode, focusOn, navigate, setExpanded } = useCosmos.getState();
  const editing = editId ? nodes.find((n) => n.id === editId) : undefined;
  const registering = editing?.status === 'unknown';

  const [title, setTitle] = useState(editing?.title ?? initialTitle ?? '');
  const [qualifier, setQualifier] = useState(editing?.qualifier ?? '');
  const [kind, setKind] = useState<StarKind>(editing?.kind ?? 'concept');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [summary, setSummary] = useState(editing?.summary ?? '');
  const [aliases, setAliases] = useState(editing?.aliases.join(', ') ?? '');
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '');
  const [importance, setImportance] = useState(editing && !registering ? editing.importance : 3);

  const categories = useMemo(() => [...new Set(nodes.map((n) => n.category).filter(Boolean))], [nodes]);

  // 同じ名前の星がすでにあれば知らせる（重複を防ぐ）
  const duplicate = useMemo(() => {
    const name = normalize(displayName({ title: title.trim(), qualifier: qualifier.trim() }));
    if (!title.trim()) return undefined;
    return nodes.find(
      (n) => n.id !== editId && (normalize(displayName(n)) === name || (!qualifier.trim() && n.aliases.some((a) => normalize(a) === name))),
    );
  }, [nodes, title, qualifier, editId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || duplicate) return;
    const input: NodeInput = {
      title: title.trim(),
      qualifier: qualifier.trim(),
      kind,
      category: category.trim(),
      summary: summary.trim(),
      aliases: splitList(aliases),
      tags: splitList(tags),
      importance,
    };
    if (editing) {
      updateNode(editing.id, input);
      if (registering) setExpanded(true);
    } else {
      const node = addNode(input, spawnPosition());
      focusOn(node.id);
      setExpanded(true);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>{registering ? 'まだ知らない星を登録' : editing ? '星を編集' : '星を追加'}</h2>
        <label>
          名前<span className="req">必須</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：ソクラテス" autoFocus={!editing} required />
        </label>
        <label>
          区別用の補足（同じ名前で別のものがあるとき）
          <input value={qualifier} onChange={(e) => setQualifier(e.target.value)} placeholder="例：惑星 → マーキュリー（惑星）" />
        </label>
        {duplicate && (
          <div className="form-warning">
            「{displayName(duplicate)}」はすでにあります{duplicate.status === 'unknown' ? '（まだ知らない星）' : ''}。
            <button
              type="button"
              className="small-btn"
              onClick={() => {
                onClose();
                navigate(duplicate.id);
              }}
            >
              その星を開く
            </button>
            <span className="muted small">別のものなら「区別用の補足」を入れてください。</span>
          </div>
        )}
        <div className="field">
          <span>種類</span>
          <div className="chips wrap">
            {(Object.keys(STAR_KINDS) as StarKind[]).map((k) => (
              <button type="button" key={k} className={k === kind ? 'chip active' : 'chip'} onClick={() => setKind(k)}>
                {STAR_KINDS[k]}
              </button>
            ))}
          </div>
        </div>
        <label>
          カテゴリー（分野）
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="category-list" placeholder="例：哲学" />
          <datalist id="category-list">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label>
          概要（一文の要約）
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="例：古代ギリシャ・アテナイの哲学者。" />
        </label>
        <label>
          別名（カンマ区切り）
          <input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="例：Socrates" />
        </label>
        <label>
          タグ（カンマ区切り）
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例：古代ギリシャ" />
        </label>
        <div className="field">
          <span>重要度（星の大きさ）</span>
          <div className="chips">
            {[1, 2, 3, 4, 5].map((v) => (
              <button type="button" key={v} className={v === importance ? 'chip active' : 'chip'} onClick={() => setImportance(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <p className="muted small">事実や意見は、保存した後に「記述を追加」から1文ずつ書きます。</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary" disabled={!title.trim() || !!duplicate}>
            {registering ? '登録' : editing ? '保存' : '追加'}
          </button>
        </div>
      </form>
    </div>
  );
}
