import { useState } from 'react';
import type { ReactNode } from 'react';
import { AppBar } from './AppBar';
import { Drawer } from './Drawer';
import { BarraQuodomInferior } from './BarraQuodomInferior';
import { MisQuodomsSidebar } from './MisQuodomsSidebar';
import './Layout.css';

export function Layout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div className="layout">
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="layout-main">
        <AppBar onOpenDrawer={() => setDrawerOpen(true)} />
        <main>{children}</main>
        <BarraQuodomInferior />
      </div>
      <MisQuodomsSidebar />
    </div>
  );
}
