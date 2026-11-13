// 知識の登録・編集フォーム
import { useMemo, useState, type FormEvent } from 'react';
import { useCosmos, type NodeInput } from '../store/useCosmos';
import { spawnPosition } from '../lib/sceneApi';

export function NodeForm({ editId, onClose }: { editId: string | null; onClose: () => void }) {
  const nodes = useCosmos((s) => s.nodes);
  const { addNode, updateNode, focusOn } = useCosmos.getState();
  const editing = editId ? nodes.find((n) => n.id === editId) : undefined;

  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '');
  const [sourceUrl, setSourceUrl] = useState(editing?.sourceUrl ?? '');
  const [importance, setImportance] = useState(editing?.importance ?? 3);

  const categories = useMemo(() => [...new Set(nodes.map((n) => n.category).filter(Boolean))], [nodes]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const input: NodeInput = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      tags: tags.split(/[,、，]/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
      sourceUrl: sourceUrl.trim(),
      importance,
    };
    if (editing) {
      updateNode(editing.id, input);
    } else {
      const node = addNode(input, spawnPosition());
      focusOn(node.id);
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>{editing ? '知識を編集' : '知識を追加'}</h2>
        <label>
          名称<span className="req">必須</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：ソクラテス" autoFocus required />
        </label>
        <label>
          説明・メモ
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label>
          カテゴリー
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="category-list" placeholder="例：哲学" />
          <datalist id="category-list">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label>
          タグ（カンマ区切り）
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="例：人物, 古代" />
        </label>
        <label>
          出典URL
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url" inputMode="url" placeholder="https://" />
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
        <div className="modal-actions">
          <button type="button" onClick={onClose}>キャンセル</button>
          <button type="submit" className="primary" disabled={!title.trim()}>{editing ? '保存' : '追加'}</button>
        </div>
      </form>
    </div>
  );
}
