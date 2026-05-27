'use client';

import MisePOSv5 from '@design/pos/MisePOSv5';
import './mobile.css';

export function MisePOSv5Wrapper() {
  return (
    <div className="pos-root">
      <MisePOSv5 />
    </div>
  );
}
