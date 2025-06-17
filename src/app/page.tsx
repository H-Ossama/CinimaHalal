import React from 'react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { Sidebar } from '../components/layout/Sidebar';

const HomePage = () => {
  return (
    <div>
      <Header />
      <main className="flex">
        <Sidebar />
        <div className="flex-1 p-4">
          <h1 className="text-2xl font-bold">Welcome to Clean Stream</h1>
          <p className="mt-2">Your go-to platform for streaming movies and series with enhanced filtering options.</p>
          {/* Additional homepage content can be added here */}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;