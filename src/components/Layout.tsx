import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Titlebar from './Titlebar';

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className="h-screen w-screen flex flex-col bg-league-blue-darkest overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
