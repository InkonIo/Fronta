// components/ForMap/PolygonDrawMap.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import MapComponent from './MapComponent'; // Импортируем компонент карты
import MapSidebar from './MapSidebar';     // Импортируем компонент боковой панели
import * as L from 'leaflet';              // Импортируем библиотеку Leaflet для работы с геометрией
import './Map.css';                        // CSS-файл для специфичных стилей карты (если нужен)

// >>> ВАЖНО: УСТАНОВИТЕ ВАШ БАЗОВЫЙ URL БЭКЕНДА ЗДЕСЬ! <<<
// Он должен быть ТОЛЬКО корнем вашего домена/приложения, без '/api' или '/polygons'.
// Например: 'http://localhost:8080' для локальной разработки, или
// 'https://newback-production-aa83.up.railway.app' для вашего Railway App.
const BASE_API_URL = 'http://localhost:8080'; 

export default function PolygonDrawMap({ handleLogout }) {
  const [polygons, setPolygons] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [crops, setCrops] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [cropsError, setCropsError] = useState(null);
  const [editingPolygon, setEditingPolygon] = useState(null);
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
          cmlimit: '100',
          cmtype: 'page',
          origin: '*',
        })
      );

      if (!response.ok) {
        throw new Error('Ошибка загрузки данных');
      }

      const data = await response.json();
      if (data.query && data.query.categorymembers) {
        const vegetableNames = data.query.categorymembers
          .map((item) => item.title)
          .filter(
            (title) =>
              !title.includes(':') &&
              !title.includes('Категория') &&
              !title.includes('Список') &&
              !title.includes('Template') &&
              title.length < 50
          )
          .sort();
        setCrops(vegetableNames);
      } else {
        const fallbackCrops = ['Томаты', 'Огурцы', 'Морковь', 'Свёкла', 'Лук', 'Чеснок', 'Картофель', 'Капуста', 'Перец', 'Баклажаны', 'Кабачки', 'Тыква', 'Редис', 'Петрушка', 'Укроп', 'Салат', 'Шпинат', 'Брокколи', 'Цветная капуста', 'Брюссельская капуста'];
        setCrops(fallbackCrops);
      }
    } catch (error) {
      console.error('Ошибка при загрузке культур:', error);
      setCropsError('Не удалось загрузить список культур. Используются резервные данные.');
      const fallbackCrops = ['Томаты', 'Огурцы', 'Морковь', 'Свёкла', 'Лук', 'Чеснок', 'Картофель', 'Капуста', 'Перец', 'Баклажаны', 'Кабачки', 'Тыква', 'Редис', 'Петрушка', 'Укроп', 'Салат', 'Шпинат', 'Брокколи', 'Цветная капуста', 'Брюссельская капуста'];
      setCrops(fallbackCrops);
    }
    setLoadingCrops(false);
  };

  useEffect(() => {
    fetchCropsFromAPI();
  }, []);

  // --- Функция сохранения полигона в БД ---
  const savePolygonToDatabase = useCallback(async (polygonData, name) => {
    if (!name) {
      alert('Ошибка сохранения: название полигона не может быть пустым.');
      console.error('Ошибка сохранения: название полигона не может быть пустым.');
      return;
    }

    const geoJsonCoordinates = [polygonData.coordinates.map(coord => [coord[1], coord[0]])];
    const geoJson = {
        type: "Polygon",
        coordinates: geoJsonCoordinates
    };
    const geoJsonString = JSON.stringify(geoJson);

    const token = localStorage.getItem('token'); 
    if (!token) {
      alert('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    try {
      // Используем полный путь к эндпоинту, объединяя BASE_API_URL и '/api/polygons'
      const response = await fetch(`${BASE_API_URL}/api/polygons`, { 
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: name,
          geoJson: geoJsonString 
          // Если вы хотите сохранять культуру, раскомментируйте ниже,
          // но сначала добавьте 'crop' в PolygonRequestDto и PolygonArea на бэкенде.
          // crop: polygonData.crop // Пример: polygonData.crop
        }),
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorText = await response.text(); // Читаем как текст, а не JSON
          if (errorText.length > 0) {
            errorMessage = errorText; // Используем текст ошибки, если он есть
          }
        } catch (parseError) {
          console.warn("Could not parse error response as text:", parseError);
          errorMessage = `Server responded with status ${response.status} but no readable error message.`;
        }
        throw new Error(`Ошибка сохранения полигона: ${response.status} - ${errorMessage}`);
      }

      // Если ответ 200 OK, но не JSON, просто читаем как текст
      const resultText = await response.text();
      alert(`Полигон "${name}" успешно сохранен в БД! Ответ сервера: ${resultText}`);
      console.log('Полигон успешно сохранен:', resultText);
    } catch (error) {
      alert(`Не удалось сохранить полигон: ${error.message}`);
      console.error('Ошибка при сохранении полигона:', error);
    }
  }, []);

  // --- Коллбэки для управления полигонами ---

  // Начать режим рисования
  const startDrawing = () => {
    console.log('startDrawing: Entering drawing mode');
    setIsDrawing(true);
    setSelectedPolygon(null);
    setIsEditingMode(false);
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
      id: Date.now(), 
      coordinates: coordinates,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      crop: null, 
      name: `Новый полигон ${Date.now()}` // Генерируем имя по умолчанию
    };
    setPolygons((prev) => [...prev, newPolygon]); 
    setIsDrawing(false); 

    // Автоматическое сохранение нового полигона в БД с именем по умолчанию
    savePolygonToDatabase(newPolygon, newPolygon.name);

  }, [savePolygonToDatabase]);

  // Удалить полигон по ID
  const deletePolygon = (id) => {
    console.log('deletePolygon: Deleting polygon with ID', id);
    setPolygons((prev) => prev.filter((p) => p.id !== id));
    setSelectedPolygon(null); 
    if (editingPolygon && editingPolygon.id === id) {
      console.log('deletePolygon: Deleting currently edited polygon, exiting editing mode.');
      setIsEditingMode(false);
      setEditingPolygon(null);
      editableFGRef.current?.clearLayers();
    }
    // TODO: Добавить вызов API для удаления полигона из БД
  };

  // Очистить все полигоны
  const clearAll = () => {
    console.log('clearAll: Clearing all polygons and modes.');
    setPolygons([]);
    setSelectedPolygon(null);
    setIsDrawing(false);
    setIsEditingMode(false);
    setEditingPolygon(null);
    editableFGRef.current?.clearLayers();
    // TODO: Добавить вызов API для удаления всех полигонов из БД (если такой эндпоинт есть)
  };

  // Очистить все назначенные культуры со всех полигонов
  const clearAllCrops = () => {
    console.log('clearAllCrops: Clearing all assigned crops.');
    setPolygons((prev) => prev.map((p) => ({ ...p, crop: null })));
    // TODO: Если культура сохраняется в БД, обновить ее там.
  };

  // Обновить культуру для конкретного полигона
  const updatePolygonCrop = (polygonId, crop) => {
    console.log(`updatePolygonCrop: Updating polygon ${polygonId} with crop ${crop}.`);
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) => (p.id === polygonId ? { ...p, crop } : p));
      // Если полигон выбран и мы меняем культуру, можно обновить его имя тоже,
      // или просто сохранить. Но помните, что это создаст новую запись на бэкенде.
      const updatedPoly = updatedPolys.find(p => p.id === polygonId);
      if (updatedPoly) {
          //savePolygonToDatabase(updatedPoly, updatedPoly.name); // Создаст новую запись!
      }
      return updatedPolys;
    });
  };

  // НОВАЯ ФУНКЦИЯ: Обновление имени полигона
  const updatePolygonName = useCallback((polygonId, newName) => {
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, name: newName } : p
      );
      const updatedPoly = updatedPolys.find(p => p.id === polygonId);
      if (updatedPoly) {
        // ВНИМАНИЕ: Текущий бэкенд не поддерживает обновление.
        // Этот вызов savePolygonToDatabase создаст НОВУЮ запись в БД с новым именем.
        // Для обновления необходимо, чтобы ваш бэкенд имел PUT/PATCH эндпоинт.
        savePolygonToDatabase(updatedPoly, newName); 
      }
      return updatedPolys;
    });
  }, [savePolygonToDatabase]);

  // --- Функции для расчета и форматирования площади ---
  const calculateArea = (coordinates) => {
    if (coordinates.length < 3) return 0; 
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const R = 6371000; 
    let area = 0;
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; 
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
    if (area < 10000) return `${area.toFixed(1)} м²`; 
    if (area < 1000000) return `${(area / 10000).toFixed(1)} га`; 
    return `${(area / 1000000).toFixed(1)} км²`; 
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
          if (editingPolygon) {
            const geoJson = layer.toGeoJSON();
            const updatedCoords = geoJson.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            const updatedPoly = { ...editingPolygon, coordinates: updatedCoords };
            savePolygonToDatabase(updatedPoly, updatedPoly.name || `Полигон ${updatedPoly.id}`);
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

            savePolygonToDatabase(updatedPolygon, updatedPolygon.name || `Полигон ${updatedPolygon.id}`);
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
  const showMyPolygons = useCallback(async () => {
    alert('Кнопка "Мои полигоны" нажата. Здесь будет логика загрузки и отображения ваших сохраненных полигонов из БД.');
    
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    try {
        const response = await fetch(`${BASE_API_URL}/api/polygons/my`, { // Используем BASE_API_URL
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            let errorMessage = response.statusText;
            try {
              const errorText = await response.text(); // Читаем как текст
              if (errorText.length > 0) {
                errorMessage = errorText;
              }
            } catch (parseError) {
              console.warn("Could not parse error response as text:", parseError);
            }
            throw new Error(`Ошибка загрузки полигонов: ${response.status} - ${errorMessage}`);
        }

        const data = await response.json(); // Ожидаем JSON, т.к. список полигонов
        console.log('Мои полигоны загружены:', data);
        alert('Мои полигоны загружены (смотрите консоль). В реальном приложении их нужно будет отобразить на карте.');
        // Здесь вы можете добавить логику для отрисовки полученных полигонов на карте
        // setPolygons(data.map(item => ({
        //   id: item.id, // Если бэкенд возвращает ID
        //   coordinates: JSON.parse(item.geoJson).coordinates[0].map(coord => [coord[1], coord[0]]),
        //   color: `hsl(${Math.random() * 360}, 70%, 50%)`, // Или цвет из БД, если он там есть
        //   crop: item.cropName || null, // Если в БД есть поле для культуры
        //   name: item.name // Имя полигона из БД
        // })));

    } catch (error) {
        alert(`Не удалось загрузить мои полигоны: ${error.message}`);
        console.error('Ошибка при загрузке моих полигонов:', error);
    }
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      <MapComponent
        polygons={polygons}
        onPolygonComplete={onPolygonComplete}
        onPolygonEdited={onPolygonEdited}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        editableFGRef={editableFGRef}
      />

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
        stopAndSaveDrawing={onPolygonComplete}
        handleStopAndSaveEdit={handleStopAndSaveEdit}
        isDrawing={isDrawing}
        isEditingMode={isEditingMode}
        clearAll={clearAll}
        handleLogout={handleLogout}
        showMyPolygons={showMyPolygons}
        updatePolygonName={updatePolygonName}
      />

      {(isDrawing || isEditingMode) && (
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
