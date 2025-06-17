import React from 'react';
import './globals.css';
import ClientLayout from '../components/layout/ClientLayout';

export const metadata = {
  title: 'CinemaHalal',
  description: 'Your go-to platform for streaming movies and series with enhanced filtering options',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}