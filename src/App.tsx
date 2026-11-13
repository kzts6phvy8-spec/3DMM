import { useEffect, useState } from 'react';
import { useCosmos } from './store/useCosmos';
import { CosmosScene } from './components/CosmosScene';
import { NodeSheet } from './components/NodeSheet';
import { NodeForm } from './components/NodeForm';
import { RelationForm } from './components/RelationForm';
import { StatementForm } from './components/StatementForm';
import { LabelLayer } from './components/LabelLayer';
import { ErrorToast, ModeBanner, NodeList, SceneErrorBoundary, TopBar, UndoToast } from './components/Overlay';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function App() {
  const loaded = useCosmos((s) => s.loaded);
  const pending = useCosmos((s) => s.pendingConnection);
  const [form, setForm] = useState<{ editId: string | null } | null>(null);
  const [stForm, setStForm] = useState<{ starId: string; statementId: string | null } | null>(null);
  const [has3d] = useState(webglAvailable);

  useEffect(() => {
    useCosmos.getState().init();
  }, []);

  if (!loaded) return <div className="loading">宇宙を読み込み中…</div>;

  return (
    <div className="app">
      {has3d ? (
        <SceneErrorBoundary fallback={<NodeList />}>
          <CosmosScene />
          <LabelLayer />
        </SceneErrorBoundary>
      ) : (
        <NodeList />
      )}
      <TopBar onAdd={() => setForm({ editId: null })} />
      <ModeBanner />
      <NodeSheet onEdit={(id) => setForm({ editId: id })} onEditStatement={(starId, statementId) => setStForm({ starId, statementId })} />
      {form && <NodeForm key={form.editId ?? 'new'} editId={form.editId} onClose={() => setForm(null)} />}
      {stForm && (
        <StatementForm key={stForm.statementId ?? `new-${stForm.starId}`} starId={stForm.starId} statementId={stForm.statementId} onClose={() => setStForm(null)} />
      )}
      {pending && <RelationForm key={`${pending.sourceId}-${pending.targetId}`} />}
      <ErrorToast />
      <UndoToast />
    </div>
  );
}
