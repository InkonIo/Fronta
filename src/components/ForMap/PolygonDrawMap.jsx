// components/ForMap/PolygonDrawMap.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import MapComponent from './MapComponent'; // Импортируем компонент карты
import MapSidebar from './MapSidebar';     // Импортируем компонент боковой панели
import * as L from 'leaflet';              // Импортируем библиотеку Leaflet для работы с геометрией
import './Map.css';                        // CSS-файл для специфичных стилей карты (если нужен)

// PolygonDrawMap теперь принимает handleLogout как проп из App.js
export default function PolygonDrawMap({ handleLogout }) {
  // Состояние для хранения всех нарисованных полигонов
  const [polygons, setPolygons] = useState([]);
  // Состояние для отслеживания, находится ли пользователь в режиме рисования
  const [isDrawing, setIsDrawing] = useState(false);
  // Состояние для отслеживания, находится ли пользователь в режиме редактирования
  const [isEditingMode, setIsEditingMode] = useState(false);
  // Состояние для хранения ID выбранного полигона (для выделения в сайдбаре и на карте)
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  // Состояние для хранения списка культур, полученных из API
  const [crops, setCrops] = useState([]);
  // Состояние для отслеживания загрузки списка культур
  const [loadingCrops, setLoadingCrops] = useState(false);
  // Состояние для хранения ошибок при загрузке культур
  const [cropsError, setCropsError] = useState(null);

  // Состояние для хранения полигона, который в данный момент редактируется (через EditControl)
  const [editingPolygon, setEditingPolygon] = useState(null);
  // Ссылка на FeatureGroup, который используется EditControl для редактируемых слоев
  const editableFGRef = useRef();

  // --- Функция для загрузки списка культур из API (Wikipedia) ---
  const fetchCropsFromAPI = async () => {
    setLoadingCrops(true);
    setCropsError(null);
    try {
      const response = await fetch(
        'https://ru.wikipedia.org/w/api.php?' +
        new URLSearchParams({
          action: 'query',
          format: 'json',
          list: 'categorymembers',
          cmtitle: 'Категория:Овощи', // Категория "Овощи" на Русской Википедии
          cmlimit: '100', // Максимальное количество результатов
          cmtype: 'page', // Только страницы (не подкатегории, файлы и т.д.)
          origin: '*', // Для обхода CORS
        })
      );

      if (!response.ok) {
        throw new Error('Ошибка загрузки данных');
      }

      const data = await response.json();
      if (data.query && data.query.categorymembers) {
        // Извлекаем названия овощей и фильтруем ненужные элементы
        const vegetableNames = data.query.categorymembers
          .map((item) => item.title)
          .filter(
            (title) =>
              !title.includes(':') &&        // Исключаем системные страницы
              !title.includes('Категория') && // Исключаем саму категорию
              !title.includes('Список') &&   // Исключаем страницы-списки
              !title.includes('Template') && // Исключаем шаблоны
              title.length < 50              // Ограничиваем длину названия
          )
          .sort(); // Сортируем по алфавиту
        setCrops(vegetableNames);
      } else {
        // Если API не вернул данные, используем резервный список
        const fallbackCrops = ['Томаты', 'Огурцы', 'Морковь', 'Свёкла', 'Лук', 'Чеснок', 'Картофель', 'Капуста', 'Перец', 'Баклажаны', 'Кабачки', 'Тыква', 'Редис', 'Петрушка', 'Укроп', 'Салат', 'Шпинат', 'Брокколи', 'Цветная капуста', 'Брюссельская капуста', 'и не только',];
        setCrops(fallbackCrops);
      }
    } catch (error) {
      console.error('Ошибка при загрузке культур:', error);
      setCropsError('Не удалось загрузить список культур. Используются резервные данные.');
      // В случае ошибки также используем резервный список
      const fallbackCrops = ['Томаты', 'Огурцы', 'Морковь', 'Свёкла', 'Лук', 'Чеснок', 'Картофель', 'Капуста', 'Перец', 'Баклажаны', 'Кабачки', 'Тыква', 'Редис', 'Петрушка', 'Укроп', 'Салат', 'Шпинат', 'Брокколи', 'Цветная капуста', 'Брюссельская капуста',];
      setCrops(fallbackCrops);
    }
    setLoadingCrops(false);
  };

  // Загружаем список культур при первом рендере компонента
  useEffect(() => {
    fetchCropsFromAPI();
  }, []);

  // --- Функция сохранения полигона в БД ---
  const savePolygonToDatabase = useCallback(async (polygonData) => {
    const polygonName = prompt('Введите название для полигона (для сохранения в БД):', `Полигон ${polygonData.id}`);
    if (!polygonName) {
      console.log('Сохранение отменено: название полигона не введено.');
      return;
    }

    // Создаем GeoJSON объект из координат Leaflet
    const leafletPolygon = L.polygon(polygonData.coordinates);
    const geoJson = leafletPolygon.toGeoJSON();

    // Преобразуем GeoJSON объект в строку
    const geoJsonString = JSON.stringify(geoJson);

    // Получаем токен аутентификации (пример: из localStorage)
    const token = localStorage.getItem('token'); 
    if (!token) {
      alert('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    try {
      const response = await fetch('/api/polygons', { // Эндпоинт из вашего бэкенд-контроллера
        method: 'POST', // Используем POST, как указано в вашем контроллере
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Передаем токен аутентификации
        },
        body: JSON.stringify({
          name: polygonName,
          geoJson: geoJsonString // Передаем GeoJSON как строку
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Ошибка сохранения полигона: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      alert(`Полигон "${polygonName}" успешно сохранен в БД!`);
      console.log('Полигон успешно сохранен:', result);
      // Если бэкенд возвращает ID, можно обновить локальное состояние полигона,
      // но так как POST создает новый UUID, просто подтвердим сохранение.
    } catch (error) {
      alert(`Не удалось сохранить полигон: ${error.message}`);
      console.error('Ошибка при сохранении полигона:', error);
    }
  }, []); // Пустые зависимости, так как savePolygonToDatabase не зависит от изменяемых состояний

  // --- Коллбэки для управления полигонами ---

  // Начать режим рисования
  const startDrawing = () => {
    console.log('startDrawing: Entering drawing mode');
    setIsDrawing(true);
    setSelectedPolygon(null); // Сбрасываем выбор полигона при начале рисования
    setIsEditingMode(false); // Убедимся, что режим редактирования выключен
    editableFGRef.current?.clearLayers(); 
  };

  // Остановить режим рисования (без сохранения)
  const stopDrawing = () => {
    console.log('stopDrawing: Exiting drawing mode');
    setIsDrawing(false);
  };

  // Коллбэк, вызываемый DrawingHandler при завершении рисования (двойной клик или ручное сохранение)
  const onPolygonComplete = useCallback((coordinates) => {
    console.log('onPolygonComplete: New polygon completed', coordinates);
    const newPolygon = {
      id: Date.now(), // Уникальный ID для нового полигона
      coordinates: coordinates,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`, // Случайный цвет для нового полигона
      crop: null, // Изначально культура не выбрана
    };
    setPolygons((prev) => [...prev, newPolygon]); // Добавляем новый полигон в список
    setIsDrawing(false); // Выключаем режим рисования после завершения

    // Автоматическое сохранение нового полигона в БД
    savePolygonToDatabase(newPolygon);

  }, [savePolygonToDatabase]); // Добавляем savePolygonToDatabase в зависимости

  // Удалить полигон по ID
  const deletePolygon = (id) => {
    console.log('deletePolygon: Deleting polygon with ID', id);
    setPolygons((prev) => prev.filter((p) => p.id !== id));
    setSelectedPolygon(null); // Сбрасываем выбор, если удален выбранный полигон
    if (editingPolygon && editingPolygon.id === id) {
      console.log('deletePolygon: Deleting currently edited polygon, exiting editing mode.');
      setIsEditingMode(false);
      setEditingPolygon(null);
      editableFGRef.current?.clearLayers();
    }
  };

  // Очистить все полигоны
  const clearAll = () => {
    console.log('clearAll: Clearing all polygons and modes.');
    setPolygons([]);
    setSelectedPolygon(null);
    setIsDrawing(false);
    setIsEditingMode(false); // Сбрасываем режим редактирования
    setEditingPolygon(null);
    editableFGRef.current?.clearLayers(); // Очищаем editable слои
  };

  // Очистить все назначенные культуры со всех полигонов
  const clearAllCrops = () => {
    console.log('clearAllCrops: Clearing all assigned crops.');
    setPolygons((prev) => prev.map((p) => ({ ...p, crop: null })));
  };

  // Обновить культуру для конкретного полигона
  const updatePolygonCrop = (polygonId, crop) => {
    console.log(`updatePolygonCrop: Updating polygon ${polygonId} with crop ${crop}.`);
    setPolygons((prev) =>
      prev.map((p) => (p.id === polygonId ? { ...p, crop } : p))
    );
  };

  // --- Функции для расчета и форматирования площади ---
  const calculateArea = (coordinates) => {
    if (coordinates.length < 3) return 0; // Полигон должен иметь минимум 3 точки
    
    // Перевод градусов в радианы
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const R = 6371000; // Средний радиус Земли в метрах

    let area = 0;
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; // Следующая точка (замыкаем круг)
      const lat1 = toRadians(coordinates[i][0]);
      const lat2 = toRadians(coordinates[j][0]);
      const deltaLon = toRadians(coordinates[j][1] - coordinates[i][1]);

      const E =
        2 *
        Math.asin(
          Math.sqrt(
            Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.pow(Math.sin(deltaLon / 2), 2)
          )
        );
      area += E * R * R;
    }
    return Math.abs(area) / 2;
  };

  const formatArea = (area) => {
    if (area < 10000) return `${area.toFixed(1)} м²`; // До 10 000 м² показываем в м²
    if (area < 1000000) return `${(area / 10000).toFixed(1)} га`; // От 10 000 м² до 1 000 000 м² (1 км²) в гектарах
    return `${(area / 1000000).toFixed(1)} км²`; // Свыше 1 км² в км²
  };

  // --- Логика редактирования полигона с помощью react-leaflet-draw ---

  // Функция для начала редактирования выбранного полигона
  const handleEditPolygon = useCallback((polygonId) => {
    console.log('handleEditPolygon: Attempting to edit polygon with ID', polygonId);
    if (isDrawing) {
      console.log('handleEditPolygon: Exiting drawing mode before editing.');
      setIsDrawing(false);
    }
    if (isEditingMode) {
      console.log('handleEditPolygon: Exiting previous editing mode before new editing.');
      editableFGRef.current?.eachLayer(layer => {
        if (layer.editing && layer.editing.enabled()) {
          layer.editing.disable();
        }
      });
    }

    const polygonToEdit = polygons.find((p) => p.id === polygonId);
    if (!polygonToEdit) {
      console.log('handleEditPolygon: Polygon not found.');
      return;
    }

    if (editableFGRef.current) {
      editableFGRef.current.clearLayers(); 
      const leafletPolygon = L.polygon(polygonToEdit.coordinates);
      editableFGRef.current.addLayer(leafletPolygon);

      if (leafletPolygon.editing) {
        leafletPolygon.editing.enable();
        setIsEditingMode(true);
        setEditingPolygon(polygonToEdit);
        console.log('handleEditPolygon: Editing mode ENABLED. isEditingMode set to true.');
      } else {
        console.warn('handleEditPolygon: Leaflet polygon editing not available.');
      }
    } else {
      console.warn('handleEditPolygon: editableFGRef.current is not available.');
    }
  }, [polygons, isDrawing, isEditingMode]);

  // Функция для программной остановки и сохранения редактирования
  const handleStopAndSaveEdit = useCallback(() => {
    console.log('handleStopAndSaveEdit: Attempting to stop and save editing.');
    if (editableFGRef.current) {
      editableFGRef.current.eachLayer(layer => {
        if (layer.editing && layer.editing.enabled()) {
          console.log('handleStopAndSaveEdit: Disabling editing for active layer.');
          layer.editing.disable();
          // Принудительное сохранение после отключения редактирования
          // Важно: на бэкенде это создаст новую запись, так как нет PUT эндпоинта
          if (editingPolygon) {
            const geoJson = layer.toGeoJSON();
            const updatedCoords = geoJson.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            const updatedPoly = { ...editingPolygon, coordinates: updatedCoords };
            savePolygonToDatabase(updatedPoly);
          }
        }
      });
      console.log('handleStopAndSaveEdit: Forcing state reset for editing mode.');
      setIsEditingMode(false);
      setEditingPolygon(null);
      editableFGRef.current?.clearLayers();
    } else {
      console.warn('handleStopAndSaveEdit: editableFGRef.current is not available. Manually resetting editing state.');
      if (isEditingMode) {
        setIsEditingMode(false);
        setEditingPolygon(null);
      }
    }
  }, [isEditingMode, editingPolygon, savePolygonToDatabase]);


  // Коллбэк, вызываемый EditControl после завершения редактирования полигона
  const onPolygonEdited = useCallback(async (e) => {
    console.log('onPolygonEdited: Event received from EditControl. Layers:', e.layers);
    const editedLayers = e.layers; 
    
    if (editedLayers && editedLayers.getLayers().length > 0) {
        editedLayers.eachLayer(async (layer) => {
            const geoJson = layer.toGeoJSON();
            const updatedCoords = geoJson.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);

            const updatedPolygon = {
                ...editingPolygon,
                coordinates: updatedCoords,
                geoJson: geoJson,
                updatedAt: new Date().toISOString(),
            };

            setPolygons((prev) => {
                const newPolygons = prev.map(p => p.id === updatedPolygon.id ? updatedPolygon : p);
                console.log('onPolygonEdited: Polygons state updated.', newPolygons);
                return newPolygons;
            });

            // Автоматическое сохранение отредактированного полигона в БД
            // Важно: на бэкенде это создаст новую запись, так как нет PUT эндпоинта
            savePolygonToDatabase(updatedPolygon);
        });
    } else {
        console.log('onPolygonEdited: No layers were actually edited or found in the event.');
    }

    console.log('onPolygonEdited: Exiting editing mode. isEditingMode set to false.');
    setIsEditingMode(false); 
    setEditingPolygon(null); 
    editableFGRef.current?.clearLayers(); 

  }, [editingPolygon, setPolygons, savePolygonToDatabase]);


  // Функция для отображения "Моих полигонов" (пока заглушка)
  const showMyPolygons = useCallback(() => {
    alert('Кнопка "Мои полигоны" нажата. Здесь будет логика загрузки и отображения ваших сохраненных полигонов из БД.');
    // В будущем здесь будет запрос к вашему бэкенду на получение списка полигонов пользователя:
    // fetch('/api/polygons/my', { headers: { 'Authorization': `Bearer ${token}` } })
    // ... и затем отображение их в модальном окне или новой секции.
  }, []);


  console.log('PolygonDrawMap rendering. isDrawing:', isDrawing, 'isEditingMode:', isEditingMode);


  return (
    // Контейнер для карты и её собственного сайдбара
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      {/* Компонент карты */}
      <MapComponent
        polygons={polygons}
        onPolygonComplete={onPolygonComplete}
        onPolygonEdited={onPolygonEdited}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        editableFGRef={editableFGRef}
      />

      {/* Компонент боковой панели карты */}
      <MapSidebar
        polygons={polygons}
        selectedPolygon={selectedPolygon}
        setSelectedPolygon={setSelectedPolygon}
        deletePolygon={deletePolygon}
        handleEditPolygon={handleEditPolygon}
        crops={crops}
        loadingCrops={loadingCrops}
        cropsError={cropsError}
        fetchCropsFromAPI={fetchCropsFromAPI}
        clearAllCrops={clearAllCrops}
        updatePolygonCrop={updatePolygonCrop}
        calculateArea={calculateArea}
        formatArea={formatArea}
        startDrawing={startDrawing}
        stopDrawing={stopDrawing}
        stopAndSaveDrawing={onPolygonComplete} // Для рисования
        handleStopAndSaveEdit={handleStopAndSaveEdit} // Для редактирования
        isDrawing={isDrawing}
        isEditingMode={isEditingMode} // Передаем новое состояние
        clearAll={clearAll} // Передаем функцию очистки всех полигонов
        handleLogout={handleLogout} // Передаем функцию выхода
        showMyPolygons={showMyPolygons} // НОВЫЙ ПРОП: Передаем функцию для "Моих полигонов"
      />

      {/* Информационный блок о режиме рисования (отображается только когда isDrawing=true) */}
      {(isDrawing || isEditingMode) && ( // Теперь отображается и в режиме редактирования
        <div
          style={{
            position: 'absolute',
            bottom: '15px',
            left: '15px',
            backgroundColor: 'rgba(0,0,0,0.85)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            fontSize: '14px',
            zIndex: 1000,
            maxWidth: '320px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#4CAF50' }}>
            📍 Режим {isDrawing ? 'рисования' : 'редактирования'} активен
          </div>
          <div style={{ lineHeight: '1.4' }}>
            {isDrawing && (
              <>
                <div>• Кликайте для добавления точек</div>
                <div>• Двойной клик для автозавершения</div>
                <div>• "Остановить и сохранить" для ручного завершения</div>
                <div>• Минимум 3 точки для полигона</div>
              </>
            )}
            {isEditingMode && (
              <>
                <div>• Перетаскивайте вершины для изменения формы</div>
                <div>• Нажмите "Остановить и сохранить" для сохранения</div>
                <div>• Выберите другой полигон, чтобы завершить редактирование</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
