// components/ForMap/MapSidebar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './MapSidebar.css'; // Импортируем новый CSS для MapSidebar

export default function MapSidebar({
  polygons,               // Массив всех полигонов
  selectedPolygon,        // ID выбранного полигона (для выделения)
  setSelectedPolygon,     // Функция для установки выбранного полигона
  deletePolygon,          // Функция для удаления полигона
  handleEditPolygon,      // Функция для начала редактирования полигона
  crops,                  // Список доступных культур
  loadingCrops,           // Состояние загрузки списка культур
  cropsError,             // Ошибка при загрузке культур
  fetchCropsFromAPI,      // Функция для повторной загрузки культур
  clearAllCrops,          // Функция для очистки всех культур с полигонов
  updatePolygonCrop,      // Функция для обновления культуры полигона
  calculateArea,          // Функция для расчета площади полигона
  formatArea,             // Функция для форматирования площади
  startDrawing,           // Функция для начала режима рисования
  stopDrawing,            // Функция для остановки режима рисования
  stopAndSaveDrawing,     // Функция для остановки и сохранения (ручное завершение рисования)
  handleStopAndSaveEdit,  // Новая функция для остановки и сохранения редактирования
  isDrawing,              // Текущее состояние режима рисования
  isEditingMode,          // Новое состояние: активен ли режим редактирования
  clearAll,               // Функция для очистки всех полигонов
  handleLogout,           // Функция выхода из системы, переданная из App.js
  showMyPolygons          // НОВЫЙ ПРОП: Функция для показа "Моих полигонов"
}) {
  // Логирование для отслеживания состояния в MapSidebar
  console.log('MapSidebar rendering. isDrawing:', isDrawing, 'isEditingMode:', isEditingMode);

  // Состояние для управления выпадающим меню (бургер-меню)
  const [isBurgerMenuOpen, setIsBurgerMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('map'); // Активная секция внутри этого меню

  const navigate = useNavigate();
  const location = useLocation();

  // Обновляем активный раздел в зависимости от текущего URL
  useEffect(() => {
    // В этом контексте AppLayout рендерится ТОЛЬКО на /dashboard.
    // Поэтому активная секция для MapSidebar всегда будет 'map' или другие,
    // если пользователь выбирает их из этого меню.
    if (location.pathname === '/') setActiveSection('home');
    else if (location.pathname === '/dashboard') setActiveSection('map');
    else if (location.pathname === '/chat') setActiveSection('ai-chat');
    else if (location.pathname === '/earthdata') setActiveSection('soil-data');
    else setActiveSection('');
  }, [location.pathname]);

  // Функция для навигации из бургер-меню
  const handleNavigate = (path, section) => {
    setIsBurgerMenuOpen(false); // Закрываем меню после выбора
    setActiveSection(section);
    navigate(path);
  };

  // Переключение состояния бургер-меню
  const toggleBurgerMenu = () => {
    setIsBurgerMenuOpen(prev => !prev);
  };

  // Стили для основной боковой панели MapSidebar
  const sidebarStyle = {
    width: '30%',
    minWidth: '300px', // Минимальная ширина для удобства
    height: '100vh',
    overflowY: 'auto',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderLeft: '1px solid #dee2e6',
    fontFamily: 'Arial, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px', // Отступ между секциями
    position: 'relative', // Важно для позиционирования выпадающего меню
  };

  // Базовые стили для кнопок управления
  const buttonStyle = {
    padding: '8px 12px',
    margin: '5px 0', // Отступы сверху/снизу
    borderRadius: '5px',
    border: '1px solid #ccc',
    cursor: 'pointer',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'background-color 0.2s ease, transform 0.1s ease',
  };

  // Определяем, должна ли кнопка "Остановить и сохранить" быть активной
  const isSaveButtonActive = isDrawing || isEditingMode;

  return (
    <div style={sidebarStyle}>
      {/* Кнопка бургер-меню внутри MapSidebar */}
      <button className="burger-menu-icon" onClick={toggleBurgerMenu} aria-label="Открыть/закрыть меню">
        {isBurgerMenuOpen ? '✕' : '☰'} {/* Меняем иконку */}
      </button>

      {/* Выпадающее меню */}
      {isBurgerMenuOpen && (
        <div className="map-sidebar-dropdown-menu"> {/* Уникальный класс для этого меню */}
          {/* Ссылки навигации */}
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleNavigate('/', 'home'); }}
            className={`map-menu-item ${activeSection === 'home' ? 'active' : ''}`}
          >
            🏠 Главная
          </a>
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleNavigate('/dashboard', 'map'); }}
            className={`map-menu-item ${activeSection === 'map' ? 'active' : ''}`}
          >
            🗺️ Карта
          </a>
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleNavigate('/chat', 'ai-chat'); }}
            className={`map-menu-item ${activeSection === 'ai-chat' ? 'active' : ''}`}
          >
            🤖 ИИ-чат
          </a>
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleNavigate('/earthdata', 'soil-data'); }}
            className={`map-menu-item ${activeSection === 'soil-data' ? 'active' : ''}`}
          >
            🌱 Данные почвы
          </a>
          
          {/* Кнопка "Выйти" в этом меню */}
          <button onClick={handleLogout} className="map-menu-item map-logout">
            🚪 Выйти
          </button>
        </div>
      )}


      {/* Остальное содержимое MapSidebar остается без изменений */}
      <h2 style={{ color: '#333', marginBottom: '10px' }}>Управление картой</h2>
      <hr style={{ border: 'none', height: '1px', background: '#ccc', margin: '0' }} />

      {/* Секция кнопок для рисования/удаления */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={startDrawing}
          disabled={isDrawing || isEditingMode}
          style={{ ...buttonStyle, 
            backgroundColor: (isDrawing || isEditingMode) ? '#b3e0ff' : '#4CAF50', 
            color: 'white' 
          }}
        >
          {isDrawing ? '✏️ Рисую...' : '✏️ Начать рисование'}
        </button>

        <button
          onClick={() => {
            console.log('Stop and Save clicked. isDrawing:', isDrawing, 'isEditingMode:', isEditingMode);
            if (isDrawing) {
              if (window.getCurrentPath) {
                const currentPath = window.getCurrentPath();
                stopAndSaveDrawing(currentPath); 
                if (window.clearCurrentPath) window.clearCurrentPath(); 
              } else {
                stopDrawing();
              }
            } else if (isEditingMode) {
              handleStopAndSaveEdit();
            }
          }}
          disabled={!isSaveButtonActive}
          style={{ ...buttonStyle, 
            backgroundColor: isSaveButtonActive ? '#ff9800' : '#f0f0f0', 
            color: isSaveButtonActive ? 'white' : '#666' 
          }}
        >
          💾 Остановить и сохранить
        </button>

        <button
          onClick={clearAll}
          style={{ ...buttonStyle, backgroundColor: '#f44336', color: 'white' }}
        >
          🗑️ Очистить все полигоны
        </button>
      </div>

      {/* НОВАЯ КНОПКА: Мои полигоны */}
      <button
        onClick={showMyPolygons} // Вызов функции showMyPolygons
        style={{
          ...buttonStyle,
          backgroundColor: '#007bff', // Синий цвет
          color: 'white',
          marginTop: '15px', // Отступ сверху
        }}
      >
        📂 Мои полигоны
      </button>

      {/* Раздел со списком полигонов */}
      {polygons.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '18px' }}>
            📐 Полигоны ({polygons.length})
          </h3>
          <div style={{ maxHeight: '25vh', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '10px' }}>
            {polygons.map((polygon, idx) => (
              <div
                key={polygon.id}
                style={{
                  marginBottom: '12px',
                  padding: '10px',
                  backgroundColor: selectedPolygon === polygon.id ? '#e3f2fd' : '#fff',
                  border: selectedPolygon === polygon.id ? '2px solid #2196f3' : '1px solid #e0e0e0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
                onClick={() => setSelectedPolygon(polygon.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: '#333', fontSize: '14px' }}>
                    Полигон #{idx + 1}
                  </strong>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePolygon(polygon.id); }}
                      style={{ padding: '4px 8px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                    >
                      Удалить
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditPolygon(polygon.id); }}
                      disabled={isEditingMode || isDrawing}
                      style={{ 
                        padding: '4px 8px', 
                        backgroundColor: (isEditingMode || isDrawing) ? '#cccccc' : '#ffc107', 
                        color: (isEditingMode || isDrawing) ? '#666666' : '#000', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: (isEditingMode || isDrawing) ? 'not-allowed' : 'pointer', 
                        fontSize: '11px' 
                      }}
                    >
                      ✏️ Редактировать
                    </button>
                  </div>
                </div>
                <div 
                  style={{ 
                    fontSize: '12px', 
                    color: '#444', 
                    marginBottom: '8px' 
                  }}
                >
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Точек: {polygon.coordinates.length}</span>
                    <span>Площадь: {formatArea(calculateArea(polygon.coordinates))}</span>
                    <div style={{ width: '18px', height: '18px', backgroundColor: polygon.color, borderRadius: '4px', border: '1px solid #ddd' }}></div>
                  </div>
                </div>
                {polygon.crop && (
                  <div 
                    style={{ 
                      fontSize: '12px', 
                      color: '#2e7d32', 
                      fontWeight: 'bold', 
                      backgroundColor: '#e8f5e8', 
                      padding: '5px 8px', 
                      borderRadius: '4px', 
                      marginTop: '8px', 
                      opacity: 1, 
                      transition: 'opacity 0.2s ease', 
                      display: 'block' 
                    }}
                  >
                    🌾 {polygon.crop}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Раздел назначения культур */}
      <div style={{ 
        backgroundColor: '#fff', 
        border: '1px solid #dee2e6', 
        borderRadius: '8px', 
        overflow: 'hidden', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginTop: polygons.length > 0 ? '10px' : '0' 
      }}>
        <div style={{ backgroundColor: '#f8f9fa', padding: '12px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, color: '#333', fontSize: '16px' }}>
            🌾 Назначение культур
          </h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchCropsFromAPI}
              disabled={loadingCrops}
              style={{ padding: '6px 10px', backgroundColor: loadingCrops ? '#ccc' : '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: loadingCrops ? 'not-allowed' : 'pointer', fontSize: '11px' }}
            >
              {loadingCrops ? 'Загружаю...' : '🔄'}
            </button>
            <button
              onClick={clearAllCrops}
              style={{ padding: '6px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
            >
              🗑️
            </button>
          </div>
        </div>

        {cropsError && (
          <div style={{ padding: '8px 12px', backgroundColor: '#f8d7da', color: '#721c24', fontSize: '11px' }}>
            ⚠️ {cropsError}
          </div>
        )}

        <div style={{ padding: '12px', maxHeight: '25vh', overflowY: 'auto' }}>
          {polygons.map((polygon, idx) => (
            <div
              key={polygon.id}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px', backgroundColor: selectedPolygon === polygon.id ? '#e3f2fd' : '#f8f9fa', borderRadius: '4px', border: '1px solid #e0e0e0' }}
            >
              <div style={{ width: '14px', height: '14px', backgroundColor: polygon.color, borderRadius: '3px', flexShrink: 0 }}></div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '50px' }}>
                #{idx + 1}
              </div>
              <div style={{ fontSize: '10px', color: '#666', minWidth: '50px' }}>
                {formatArea(calculateArea(polygon.coordinates))}
              </div>
              <select
                value={polygon.crop || ''}
                onChange={(e) => updatePolygonCrop(polygon.id, e.target.value || null)}
                style={{ 
                  padding: '4px 8px', 
                  border: '1px solid #ced4da', 
                  borderRadius: '4px', 
                  backgroundColor: '#fff', 
                  fontSize: '11px', 
                  cursor: 'pointer', 
                  flex: 1, 
                  minWidth: '120px',
                  color: '#333'
                }}
              >
                <option value="">Выберите культуру</option>
                {crops.map((crop) => (
                  <option key={crop} value={crop} style={{ color: '#333' }}>
                    {crop}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Сводка */}
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef', fontSize: '11px' }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Сводка:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <div>Полигонов: {polygons.length}</div>
            <div>С культурами: {polygons.filter((p) => p.crop).length}</div>
            <div style={{ gridColumn: '1 / -1' }}>
              Общая площадь:{' '}
              {formatArea(polygons.reduce((total, p) => total + calculateArea(p.coordinates), 0))}
            </div>
          </div>
          {polygons.some((p) => p.crop) && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>По культурам:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(
                  polygons.filter((p) => p.crop).reduce((acc, p) => {
                    const area = calculateArea(p.coordinates);
                    acc[p.crop] = (acc[p.crop] || 0) + area;
                    return acc;
                  }, {})
                ).map(([crop, area]) => (
                  <div key={crop} style={{ padding: '2px 6px', backgroundColor: '#e8f5e8', borderRadius: '3px', fontSize: '10px', color: '#2e7d32' }}>
                    {crop}: {formatArea(area)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
