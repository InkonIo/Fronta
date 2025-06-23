// components/ForMap/AppLayout.jsx
import React from 'react';
import './AppLayout.css'; // Будет обновлен, чтобы быть минимальным

// AppLayout теперь просто оборачивает дочерние элементы
export default function AppLayout({ children }) {
  // Логика навигации и состояния меню перенесена в MapSidebar.jsx
  // Этот компонент теперь служит только контейнером для PolygonDrawMap.
  return (
    <div className="app-layout-container">
      <div className="app-layout-content">
        {children} {/* Здесь будет отображаться PolygonDrawMap */}
      </div>
    </div>
  );
}
