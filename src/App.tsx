import './styles.css';
import { AccountsPanel } from './AccountsPanel';
import { NodeStatusButton } from './NodeStatusButton';

export function App() {
  return (
    <main className="app-shell">
      <NodeStatusButton />
      <section className="home-content" aria-label="Qortium Home">
        <h1>Qortium Home</h1>
        <AccountsPanel />
      </section>
    </main>
  );
}
