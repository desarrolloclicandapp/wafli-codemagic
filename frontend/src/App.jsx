import React from 'react';

const { WaFliApp, RuntimeErrorBoundary } = window;

export function App() {
  return (
    <RuntimeErrorBoundary>
      <div className="phone">
        <WaFliApp initialScreen="landing" />
      </div>
    </RuntimeErrorBoundary>
  );
}
