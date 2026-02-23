import { ReactNode } from 'react';
import Titlebar from './Titlebar';
import Sidebar from './Sidebar';

interface Props {
  children: ReactNode;
  patch?: string;
}

export default function Layout({ children, patch }: Props) {
  return (
    <div className="h-screen flex flex-col bg-league-blue-darkest overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar patch={patch} />
        <main className="flex-1 overflow-y-auto p-6 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
