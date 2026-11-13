import { useEffect, useState } from 'react';
import { useCosmos } from './store/useCosmos';
import { CosmosScene } from './components/CosmosScene';
import { NodeSheet } from './components/NodeSheet';
import { NodeForm } from './components/NodeForm';
import { RelationForm } from './components/RelationForm';
import { StatementForm } from './components/StatementForm';
import { LabelLayer } from './components/LabelLayer';
import { BottomNav, ErrorToast, ModeBanner, NodeList, SceneErrorBoundary, TopBar, UndoToast } from './components/Overlay';
import { ListPanel, MorePanel, SearchPanel } from './components/Panels';
import { ReportPanel } from './components/ReportPanel';
import { PuzzlePanel } from './components/PuzzlePanel';
import { LAYOUT } from './config/layout';
import { SelectionToStar } from './components/SelectionToStar';

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
  const [form, setForm] = useState<{ editId: string | null; title?: string } | null>(null);
  const panel = useCosmos((s) => s.panel);
  const [stForm, setStForm] = useState<{ starId: string; statementId: string | null } | null>(null);
  const [has3d] = useState(webglAvailable);

  useEffect(() => {
    useCosmos.getState().init();
  }, []);

  if (!loaded) return <div className="loading">宇宙を読み込み中…</div>;

  return (
    <div className={`app layout-${LAYOUT.toLowerCase()}`}>
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
      <BottomNav onAdd={() => setForm({ editId: null })} />
      <NodeSheet onEdit={(id) => setForm({ editId: id })} onEditStatement={(starId, statementId) => setStForm({ starId, statementId })} />
      {form && <NodeForm key={form.editId ?? `new-${form.title ?? ''}`} editId={form.editId} initialTitle={form.title} onClose={() => setForm(null)} />}
      {stForm && (
        <StatementForm key={stForm.statementId ?? `new-${stForm.starId}`} starId={stForm.starId} statementId={stForm.statementId} onClose={() => setStForm(null)} />
      )}
      {pending && <RelationForm key={`${pending.sourceId}-${pending.targetId}`} />}
      {panel === 'search' && (
        <SearchPanel
          onCreate={(title) => {
            useCosmos.getState().openPanel(null);
            setForm({ editId: null, title });
          }}
        />
      )}
      {panel === 'list' && <ListPanel />}
      {panel === 'more' && <MorePanel />}
      {panel === 'report' && <ReportPanel />}
      {panel === 'puzzle' && <PuzzlePanel />}
      <SelectionToStar />
      <ErrorToast />
      <UndoToast />
    </div>
  );
}
