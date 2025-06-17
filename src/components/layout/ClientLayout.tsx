'use client';

import React from 'react';
import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';
import { AuthProvider } from '../../context/AuthContext';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-4">{children}</main>
        </div>
        <Footer />
      </div>
    </AuthProvider>
  );
}
