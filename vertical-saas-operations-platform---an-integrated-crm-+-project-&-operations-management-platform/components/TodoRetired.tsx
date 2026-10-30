import React from 'react';
import { Link } from 'react-router-dom';

// Compatibility destination for saved CRM checklist bookmarks, not a task panel.
export const TodoRetired: React.FC = () => (
  <section className="forge-card p-6 space-y-4 max-w-xl">
    <h1 className="text-2xl font-black text-white">Use dedicated Todo</h1>
    <p className="forge-secondary">Standalone CRM Todo has been retired.</p>
    <p className="forge-secondary text-sm">
      Use the dedicated Todo app for your to-do list. Historical CRM records have not
      been deleted or transferred. CRM project and customer follow-ups remain separate.
    </p>
    <div className="flex flex-wrap gap-4 items-center">
      <a href="https://todo.forgehub.dev" className="forge-button-primary inline-block rounded-xl px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        Open dedicated Todo
      </a>
      <Link to="/" className="forge-secondary underline text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Back to dashboard</Link>
    </div>
  </section>
);
