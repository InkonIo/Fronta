// components/ForMap/PolygonDrawMap.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import MapComponent from './MapComponent'; // Импортируем компонент карты
import MapSidebar from './MapSidebar';     // Импортируем компонент боковой панели
import ToastNotification from './ToastNotification'; // Импортируем новый компонент тоста
import ConfirmDialog from './ConfirmDialog'; // Новый компонент диалога подтверждения
import * as L from 'leaflet';              // Импортируем библиотеку Leaflet для работы с геометрией
import './Map.css';                        // CSS-файл для специфичных стилей карты (если нужен)

// >>> ВАЖНО: УСТАНОВИТЕ ВАШ БАЗОВЫЙ URL БЭКЕНДА ЗДЕСЬ! <<<
// Он должен быть ТОЛЬКО корнем вашего домена/приложения, без '/api' или '/polygons'.
// Например: 'http://localhost:8080' для локальной разработки, или
// 'https://newback-production-aa83.up.railway.app' для вашего Railway App.
const BASE_API_URL = 'http://localhost:8080'; 

// --- Вспомогательная функция для безопасного парсинга тела ответа ---
async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (e) {
      console.error("Failed to parse JSON, falling back to text:", e); // Используем console.error для реальных ошибок
      return await response.text();
    }
  } else {
    return await response.text();
  }
}

export default function PolygonDrawMap({ handleLogout }) {
  const [polygons, setPolygons] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState(null); // ID выбранного полигона
  const [crops, setCrops] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [cropsError, setCropsError] = useState(null);
  const [editingMapPolygon, setEditingMapPolygon] = useState(null); // Полигон, который редактируется на карте (для react-leaflet-draw)
  const editableFGRef = useRef();

  // Состояние для тост-уведомлений
  const [toast, setToast] = useState({ message: '', type: '', visible: false });
  // Состояния для индикаторов загрузки/сохранения
  const [isSavingPolygon, setIsSavingPolygon] = useState(false);
  const [isFetchingPolygons, setIsFetchingPolygons] = useState(false);
  // Состояние для диалога подтверждения очистки
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);


  // Функция для отображения тост-уведомлений
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, visible: true });
    const timer = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 5000); // Сообщение исчезнет через 5 секунд
    return () => clearTimeout(timer); // Очистка таймера
  }, []);

  // --- Функции для расчета и форматирования площади ---
  const calculateArea = useCallback((coordinates) => {
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
  }, []);

  const formatArea = useCallback((area) => {
    if (area < 10000) return `${area.toFixed(1)} м²`; 
    if (area < 1000000) return `${(area / 10000).toFixed(1)} га`; 
    return `${(area / 1000000).toFixed(1)} км²`; 
  }, []);

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
        showToast('Не удалось загрузить список культур, используются резервные данные.', 'warning');
      }
    } catch (error) {
      console.error('Ошибка при загрузке культур:', error);
      setCropsError('Не удалось загрузить список культур. Используются резервные данные.');
      const fallbackCrops = ['Томаты', 'Огурцы', 'Морковь', 'Свёкла', 'Лук', 'Чеснок', 'Картофель', 'Капуста', 'Перец', 'Баклажаны', 'Кабачки', 'Тыква', 'Редис', 'Петрушка', 'Укроп', 'Салат', 'Шпинат', 'Брокколи', 'Цветная капуста', 'Брюссельская капуста'];
      setCrops(fallbackCrops);
      showToast(`Ошибка при загрузке культур: ${error.message}`, 'error');
    } finally {
      setLoadingCrops(false);
    }
  };

  useEffect(() => {
    fetchCropsFromAPI();
  }, [showToast]);


  // --- Функция сохранения/обновления полигона в БД ---
  // Теперь принимает полный объект PolygonData (включая name и crop),
  // и сама формирует geoJson для отправки.
  const savePolygonToDatabase = useCallback(async (polygonData, isUpdate = false) => {
    const { id, name, coordinates, crop } = polygonData;

    if (!name || name.trim() === '') {
      showToast('Ошибка сохранения: название полигона не может быть пустым.', 'error');
      console.error('Ошибка сохранения: название полигона не может быть пустым.');
      return;
    }

    // Создаем GeoJSON объект, включая свойства name и crop
    const geoJsonGeometry = {
        type: "Polygon",
        coordinates: [coordinates.map(coord => [coord[1], coord[0]])] // Leaflet [lat, lng] to GeoJSON [lng, lat]
    };

    const geoJsonWithProperties = {
        type: "Feature", // GeoJSON Feature, чтобы включить 'properties'
        geometry: geoJsonGeometry,
        properties: {
            name: name,
            crop: crop || null // Сохраняем культуру/комментарий здесь
        }
    };
    const geoJsonString = JSON.stringify(geoJsonWithProperties);

    const token = localStorage.getItem('token'); 
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    setIsSavingPolygon(true); // Начало сохранения
    try {
      const method = isUpdate ? 'PUT' : 'POST';
      // URL для PUT запроса включает ID полигона, для POST - нет
      const url = isUpdate ? `${BASE_API_URL}/api/polygons/${id}` : `${BASE_API_URL}/api/polygons`;

      const response = await fetch(url, { 
        method: method, 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ // Теперь отправляем только id (если update) и geoJson
          id: isUpdate ? id : undefined, // ID нужен только для PUT
          geoJson: geoJsonString
        }),
      });

      const responseBody = await parseResponseBody(response); // Читаем тело ответа ОДИН РАЗ

      if (!response.ok) {
        let errorMessage = response.statusText;
        if (typeof responseBody === 'object' && responseBody !== null && responseBody.message) {
          errorMessage = responseBody.message;
        } else if (typeof responseBody === 'string' && responseBody.length > 0) {
          errorMessage = responseBody;
        }
        showToast(`Ошибка ${isUpdate ? 'обновления' : 'сохранения'} полигона: ${errorMessage}`, 'error');
        throw new Error(`Ошибка ${isUpdate ? 'обновления' : 'сохранения'} полигона: ${response.status} - ${errorMessage}`);
      }

      showToast(`Полигон "${name}" успешно ${isUpdate ? 'обновлен' : 'сохранен'}!`, 'success');
      console.log(`Полигон успешно ${isUpdate ? 'обновлен' : 'сохранен'}:`, responseBody);

      // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ДЛЯ ОБНОВЛЕНИЯ СОСТОЯНИЯ ---
      if (!isUpdate) { // Если это новый полигон
        // Бэкенд должен вернуть полный объект нового полигона с его постоянным ID
        // Предполагается, что responseBody - это объект с { id: "actual-id", geoJson: "..." }
        // Если responseBody - это просто ID, то нужен более сложный парсинг
        const actualPolygonId = (typeof responseBody === 'object' && responseBody !== null && responseBody.id) 
                                ? responseBody.id 
                                : (typeof responseBody === 'string' ? responseBody : id); // Fallback для временного ID
        
        setPolygons(prev => prev.map(p => p.id === id ? { ...p, id: String(actualPolygonId) } : p));
      } else { // Если это обновление существующего полигона
        setPolygons(prev => prev.map(p => p.id === id ? { ...polygonData } : p)); // Обновляем данные полигона
      }

    } catch (error) {
      showToast(`Не удалось ${isUpdate ? 'обновить' : 'сохранить'} полигон: ${error.message}`, 'error');
      console.error(`Ошибка при ${isUpdate ? 'обновлении' : 'сохранении'} полигона:`, error);
    } finally {
      setIsSavingPolygon(false); // Завершение сохранения
    }
  }, [showToast]);

  // --- Коллбэки для управления полигонами ---

  // Начать режим рисования
  const startDrawing = () => {
    console.log('startDrawing: Entering drawing mode');
    setIsDrawing(true);
    setSelectedPolygon(null); // Сброс выбранного полигона
    setIsEditingMode(false);
    setEditingMapPolygon(null); // Сбросить редактируемый полигон на карте
    editableFGRef.current?.clearLayers(); 
    showToast('Режим рисования активирован. Кликайте для добавления точек.', 'info');
  };

  // Остановить режим рисования (без сохранения)
  const stopDrawing = () => {
    console.log('stopDrawing: Exiting drawing mode');
    setIsDrawing(false);
    showToast('Режим рисования остановлен.', 'info');
  };

  // Коллбэк, вызываемый DrawingHandler при завершении рисования (двойной клик или ручное сохранение)
  const onPolygonComplete = useCallback((coordinates) => {
    console.log('onPolygonComplete: New polygon completed', coordinates);
    const newPolygon = {
      // Генерируем временный ID как строку, чтобы он был консистентным с UUID из бэкенда
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Более уникальный temp ID
      coordinates: coordinates,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`, // Случайный цвет
      crop: null, 
      name: `Новый полигон ${new Date().toLocaleString()}` // Генерируем имя по умолчанию
    };
    
    // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Сразу добавляем в локальное состояние ---
    setPolygons((prev) => [...prev, newPolygon]); 
    
    setIsDrawing(false); 
    setSelectedPolygon(newPolygon.id); // Выбираем только что нарисованный полигон
    showToast('Полигон нарисован! Теперь можно его отредактировать в списке.', 'success');

    // Автоматическое сохранение нового полигона в БД с именем по умолчанию
    savePolygonToDatabase(newPolygon); // Передаем полный объект
  }, [savePolygonToDatabase, showToast]);

  // Удалить полигон по ID ИЗ БАЗЫ ДАННЫХ
  const deletePolygon = useCallback(async (id) => {
    console.log('deletePolygon: Attempting to delete polygon with ID', id);
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    try {
      const response = await fetch(`${BASE_API_URL}/api/polygons/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const responseBody = await parseResponseBody(response);

      if (!response.ok) {
        let errorMessage = response.statusText;
        if (typeof responseBody === 'object' && responseBody !== null && responseBody.message) {
          errorMessage = responseBody.message;
        } else if (typeof responseBody === 'string' && responseBody.length > 0) {
          errorMessage = responseBody;
        }
        showToast(`Ошибка удаления полигона: ${errorMessage}`, 'error');
        throw new Error(`Ошибка удаления полигона: ${response.status} - ${errorMessage}`);
      }

      // Если успешно удалено из БД, удаляем и из локального состояния
      setPolygons((prev) => prev.filter((p) => p.id !== id));
      setSelectedPolygon(null); 
      if (editingMapPolygon && editingMapPolygon.id === id) {
        setIsEditingMode(false);
        setEditingMapPolygon(null);
        // editableFGRef.current?.clearLayers(); // НЕ ОЧИЩАЕМ здесь, чтобы не влияло на другие полигоны
      }
      showToast('Полигон успешно удален.', 'success');
      console.log(`Polygon with ID ${id} successfully deleted from DB.`);

    } catch (error) {
      showToast(`Не удалось удалить полигон: ${error.message}`, 'error');
      console.error('Ошибка при удалении полигона из БД:', error);
    }
  }, [editingMapPolygon, showToast]); 

  // Запуск диалога подтверждения очистки всех полигонов
  const confirmClearAll = useCallback(() => {
    setShowClearAllConfirm(true);
  }, []);

  // Отмена очистки всех полигонов
  const cancelClearAll = useCallback(() => {
    setShowClearAllConfirm(false);
    showToast('Очистка всех полигонов отменена.', 'info');
  }, [showToast]);

  // Подтверждение очистки всех полигонов (и из БД)
  const handleClearAllConfirmed = useCallback(async () => {
    setShowClearAllConfirm(false); // Закрыть диалог сразу
    showToast('Начинаю очистку всех полигонов...', 'info');

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    setIsSavingPolygon(true); // Используем этот флаг для индикации процесса удаления
    try {
        // Здесь мы будем вызывать новый эндпоинт на бэкенде для массового удаления
        // Предполагается, что у вас есть такой эндпоинт, например, DELETE /api/polygons/clear-all
        const response = await fetch(`${BASE_API_URL}/api/polygons/clear-all`, { 
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const responseBody = await parseResponseBody(response);

        if (!response.ok) {
            let errorMessage = response.statusText;
            if (typeof responseBody === 'object' && responseBody !== null && responseBody.message) {
              errorMessage = responseBody.message;
            } else if (typeof responseBody === 'string' && responseBody.length > 0) {
              errorMessage = responseBody;
            }
            showToast(`Ошибка очистки всех полигонов: ${errorMessage}`, 'error');
            throw new Error(`Ошибка очистки всех полигонов: ${response.status} - ${errorMessage}`);
        }

        // Если успешно удалено из БД, очищаем и локальное состояние
        setPolygons([]);
        setSelectedPolygon(null);
        setIsDrawing(false);
        setIsEditingMode(false);
        setEditingMapPolygon(null);
        editableFGRef.current?.clearLayers(); // Очищаем слой редактирования, если он был активен
        showToast('Все полигоны успешно удалены!', 'success');
        console.log('All polygons successfully cleared from DB.');

    } catch (error) {
        showToast(`Не удалось очистить все полигоны: ${error.message}`, 'error');
        console.error('Ошибка при очистке всех полигонов из БД:', error);
    } finally {
      setIsSavingPolygon(false); // Завершение процесса
    }
  }, [showToast]);

  // Очистить все полигоны (теперь вызывает подтверждение)
  const clearAll = useCallback(() => {
    if (polygons.length === 0) {
      showToast('На карте нет полигонов для удаления.', 'info');
      return;
    }
    confirmClearAll(); // Запускаем диалог подтверждения
  }, [polygons.length, confirmClearAll, showToast]);


  // Очистить все назначенные культуры со всех полигонов (только на фронтенде)
  // Эта функция теперь, возможно, не нужна, так как культура редактируется инлайн
  const clearAllCrops = () => {
    console.log('clearAllCrops: Clearing all assigned crops.');
    setPolygons((prev) => prev.map((p) => ({ ...p, crop: null })));
    showToast('Все культуры удалены с полигонов на карте.', 'info');
    // Если нужно обновить в БД, нужно будет перебрать полигоны и отправить PUT запросы
    // Это не должно быть здесь, если культуры сохраняются инлайн
  };

  // Обновить культуру для конкретного полигона
  // Теперь принимает комбинированную строку 'crop'
  const updatePolygonCrop = useCallback((polygonId, newCombinedCrop) => {
    console.log(`updatePolygonCrop: Updating polygon ${polygonId} with crop ${newCombinedCrop}.`);
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) => (p.id === polygonId ? { ...p, crop: newCombinedCrop } : p));
      return updatedPolys; // Обновляем локальное состояние немедленно
    });
    // На самом деле сохранение в БД будет вызвана через onBlur в MapSidebar
  }, []);

  // Обновление имени полигона и сохранение в БД
  const updatePolygonName = useCallback((polygonId, newName) => {
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, name: newName } : p
      );
      return updatedPolys; // Обновляем локальное состояние немедленно
    });
    // На самом деле сохранение в БД будет вызвана через onBlur в MapSidebar
  }, []);

  // --- Логика редактирования полигона с помощью react-leaflet-draw ---

  // Функция для начала редактирования выбранного полигона
  const handleEditPolygon = useCallback((polygonId) => {
    console.log(`[handleEditPolygon] Attempting to edit polygon with ID: ${polygonId}`);
    // Сбросить флаги сохранения/загрузки на всякий случай
    setIsSavingPolygon(false);
    setIsFetchingPolygons(false);

    // Clear drawing mode if active
    if (isDrawing) {
      console.log('[handleEditPolygon] Exiting drawing mode.');
      setIsDrawing(false);
    }
    // Disable previous map editing if active
    if (isEditingMode && editableFGRef.current) {
      console.log('[handleEditPolygon] Disabling previous editing layers.');
      editableFGRef.current.eachLayer(layer => {
        if (layer.editing && layer.editing.enabled()) {
          layer.editing.disable();
        }
      });
    }

    const polygonToEdit = polygons.find((p) => p.id === polygonId);
    if (!polygonToEdit) {
      console.error('[handleEditPolygon] Polygon not found for editing.');
      showToast('Полигон для редактирования не найден.', 'error');
      return;
    }

    if (editableFGRef.current) {
      editableFGRef.current.clearLayers(); 
      // При создании Leaflet Polygon, используем только координаты, свойства добавляются позже
      const leafletPolygon = L.polygon(polygonToEdit.coordinates);
      editableFGRef.current.addLayer(leafletPolygon);

      // Убедимся, что слой можно редактировать
      if (leafletPolygon.editing) {
        console.log('[handleEditPolygon] Enabling Leaflet editing for polygon.');
        leafletPolygon.editing.enable();
        // Set editing mode for the sidebar to react
        setIsEditingMode(true); // <--- This is the crucial line for the save button
        setEditingMapPolygon(polygonToEdit); // Store which polygon is being edited on map
        setSelectedPolygon(polygonToEdit.id); // Highlight in sidebar
        showToast(`Начато редактирование формы полигона "${polygonToEdit.name || polygonToEdit.id}".`, 'info');
        console.log('[handleEditPolygon] isEditingMode set to TRUE. isSavingPolygon and isFetchingPolygons set to FALSE.');
      } else {
        console.error('[handleEditPolygon] Leaflet polygon editing not available for this layer.');
        showToast('Ошибка: Инструменты редактирования карты недоступны.', 'error');
      }
    } else {
      console.error('[handleEditPolygon] editableFGRef.current is not available.');
      showToast('Ошибка: Ссылка на слой редактирования недоступна.', 'error');
    }
  }, [polygons, isDrawing, isEditingMode, showToast]);

  // Функция для программной остановки и сохранения редактирования (как формы, так и карты)
  const handleStopAndSaveEdit = useCallback(() => {
    console.log('handleStopAndSaveEdit: Attempting to stop and save.');
    // Если мы в режиме рисования, завершаем рисование
    if (isDrawing) {
      if (window.getCurrentPath) { // DrawingHandler предоставляет этот глобальный метод
        const currentPath = window.getCurrentPath();
        if (currentPath && currentPath.length >= 3) {
          // DrawingHandler уже вызвал onPolygonComplete при dblclick,
          // поэтому здесь мы просто очищаем и выходим из режима рисования
          if (window.clearCurrentPath) window.clearCurrentPath(); // Очищаем временный путь в DrawingHandler
        } else {
          showToast('Нарисуйте хотя бы 3 точки для полигона.', 'warning');
          if (window.clearCurrentPath) window.clearCurrentPath(); // Очищаем и останавливаем
        }
      } else {
        stopDrawing(); // Fallback остановка рисования, если глобальные методы не доступны
      }
    } 
    // Если мы в режиме редактирования формы/карты, сохраняем изменения.
    else if (isEditingMode && editableFGRef.current) {
      // Итерируем по слоям в editableFGRef. current (там должен быть только один редактируемый полигон)
      editableFGRef.current.eachLayer(layer => {
        if (layer.editing && layer.editing.enabled()) {
          console.log('handleStopAndSaveEdit: Disabling editing for active layer.');
          layer.editing.disable(); // Отключаем редактирование Leaflet-слоя
          
          // --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ДЛЯ СОХРАНЕНИЯ ОТРЕДАКТИРОВАННОЙ ФОРМЫ ---
          if (editingMapPolygon) { // Убедимся, что есть полигон, который мы редактировали
              const geoJson = layer.toGeoJSON(); // Получаем GeoJSON из отредактированного слоя
              const updatedCoords = geoJson.geometry.coordinates[0].map(coord => [coord[1], coord[0]]); // [lng, lat] to [lat, lng]
              
              // Находим актуальный полигон в текущем состоянии, чтобы взять имя и культуру
              const currentPolygonInState = polygons.find(p => p.id === editingMapPolygon.id);
              if (currentPolygonInState) {
                  const updatedPoly = { 
                      ...currentPolygonInState, // Берем name и crop из текущего состояния
                      coordinates: updatedCoords,
                  };
                  // Обновляем локальное состояние напрямую перед отправкой на бэкенд
                  setPolygons(prev => prev.map(p => p.id === updatedPoly.id ? updatedPoly : p));
                  savePolygonToDatabase(updatedPoly, true); // Сохраняем обновленный полигон в БД
              }
          }
        }
      });
      console.log('handleStopAndSaveEdit: Forcing state reset for editing mode.');
      setIsEditingMode(false);
      setEditingMapPolygon(null); // Сбросить редактируемый полигон на карте
      // editableFGRef.current?.clearLayers(); // УДАЛЕНО: Это приводило к исчезновению
      showToast('Редактирование завершено и сохранено (если были изменения формы).', 'success');
    } else {
      // Если ни рисование, ни редактирование не активны, но кнопка нажата
      showToast('Нет активных режимов для сохранения.', 'info');
    }
  }, [isDrawing, onPolygonComplete, stopDrawing, isEditingMode, editingMapPolygon, polygons, savePolygonToDatabase, showToast]);


  // Коллбэк, вызываемый EditControl после завершения редактирования формы полигона
  // Этот коллбэк может не вызываться, если изменения сохраняются через handleStopAndSaveEdit
  const onPolygonEdited = useCallback(async (e) => {
    // В текущей архитектуре, handleStopAndSaveEdit является основным триггером сохранения.
    // Этот onPolygonEdited будет использоваться для очистки UI, если пользователь завершит
    // редактирование прямо на карте (например, нажав Esc или кликнув вне полигона).
    console.log('onPolygonEdited: Event received from EditControl. Layers:', e.layers);
    
    // Если редактирование завершено через UI EditControl (например, кнопка Save/Cancel)
    if (isEditingMode) {
      // Здесь не сохраняем, т.к. savePolygonToDatabase вызывается из handleStopAndSaveEdit.
      // Если изменения были сделаны, они уже попали в state через handleStopAndSaveEdit.
      setIsEditingMode(false);
      setEditingMapPolygon(null);
      // editableFGRef.current?.clearLayers(); // УДАЛЕНО: Это приводило к исчезновению
      showToast('Редактирование формы на карте завершено.', 'info');
    }

  }, [isEditingMode, editingMapPolygon, showToast]);


  // Функция для отображения "Моих полигонов"
  // Эту функцию можно вызывать один раз при загрузке страницы,
  // чтобы полигоны всегда отображались.
  const showMyPolygons = useCallback(async () => {
    showToast('Загрузка ваших полигонов...', 'info');
    
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    setIsFetchingPolygons(true); // Начало загрузки полигонов
    try {
        const response = await fetch(`${BASE_API_URL}/api/polygons/my`, { 
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await parseResponseBody(response); // Читаем тело ответа ОДИН РАЗ

        if (!response.ok) {
            let errorMessage = response.statusText;
            if (typeof data === 'object' && data !== null && data.message) {
              errorMessage = data.message;
            } else if (typeof data === 'string' && data.length > 0) {
              errorMessage = data;
            }
            showToast(`Ошибка загрузки полигонов: ${errorMessage}`, 'error');
            throw new Error(`Ошибка загрузки полигонов: ${response.status} - ${errorMessage}`);
        }

        console.log('Мои полигоны загружены:', data);
        
        if (data && Array.isArray(data)) {
          const loadedPolygons = data.map(item => {
            let coordinates = [];
            let name = `Загруженный полигон ${item.id || String(Date.now())}`;
            let crop = null;
            try {
              // Parse geoJson string to GeoJSON Feature object
              const geoJsonObj = JSON.parse(item.geoJson);
              if (geoJsonObj && geoJsonObj.geometry && geoJsonObj.geometry.type === "Polygon" && geoJsonObj.geometry.coordinates && geoJsonObj.geometry.coordinates[0]) {
                coordinates = geoJsonObj.geometry.coordinates[0].map(coord => [coord[1], coord[0]]); // [lng, lat] to [lng, lat]
                // Извлекаем name и crop из properties, если они есть
                if (geoJsonObj.properties) {
                  if (geoJsonObj.properties.name) name = geoJsonObj.properties.name;
                  if (geoJsonObj.properties.crop) crop = geoJsonObj.properties.crop;
                }
              } else {
                console.warn('Invalid GeoJSON Feature or Geometry structure for item:', item);
              }
            } catch (e) {
              console.error('Failed to parse geoJson for item:', item, e);
            }

            return {
              id: String(item.id), // Убеждаемся, что ID всегда строка для консистентности
              coordinates: coordinates,
              color: `hsl(${Math.random() * 360}, 70%, 50%)`, // Случайный цвет, если не из БД
              crop: crop, // Культура/комментарий из GeoJSON properties
              name: name // Имя из GeoJSON properties
            };
          }).filter(p => p.coordinates.length >= 3); // Отфильтровываем некорректные полигоны

          setPolygons(loadedPolygons);
          showToast(`Загружено ${loadedPolygons.length} ваших полигонов.`, 'success');
          // Отключаем все режимы
          setIsDrawing(false);
          setIsEditingMode(false);
          setEditingMapPolygon(null);
          editableFGRef.current?.clearLayers(); // Очищаем слой редактирования, если он был активен
          setSelectedPolygon(null); // Сбрасываем выбранный полигон
        } else {
          showToast('Сервер вернул некорректный формат данных для полигонов.', 'error');
          console.error('Сервер вернул некорректный формат данных:', data);
        }

    } catch (error) {
        showToast(`Не удалось загрузить мои полигоны: ${error.message}`, 'error');
        console.error('Ошибка при загрузке моих полигонов:', error);
    } finally {
      setIsFetchingPolygons(false); // Завершение загрузки полигонов
    }
  }, [showToast]);

  // Загружаем полигоны при первой загрузке компонента
  useEffect(() => {
    showMyPolygons();
  }, [showMyPolygons]);


  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      <MapComponent
        polygons={polygons}
        onPolygonComplete={onPolygonComplete}
        onPolygonEdited={onPolygonEdited}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        editableFGRef={editableFGRef}
        selectedPolygon={selectedPolygon} // Передаем selectedPolygon в MapComponent для выделения
        isEditingMode={isEditingMode} // Передаем isEditingMode
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
        calculateArea={calculateArea} // Передаем calculateArea
        formatArea={formatArea}     // Передаем formatArea
        updatePolygonCrop={updatePolygonCrop}
        startDrawing={startDrawing}
        stopDrawing={stopDrawing}
        handleStopAndSaveEdit={handleStopAndSaveEdit}
        isDrawing={isDrawing}
        isEditingMode={isEditingMode}
        clearAll={clearAll} // Теперь clearAll вызывает подтверждение
        handleLogout={handleLogout}
        // showMyPolygons={showMyPolygons} // УДАЛЕНО: Кнопка объединена
        updatePolygonName={updatePolygonName} // Передаем функцию для обновления имени
        isSavingPolygon={isSavingPolygon} 
        isFetchingPolygons={isFetchingPolygons} 
        // Добавлена защитная проверка на `polygons` перед доступом к `.length`
        showCropsSection={(polygons && polygons.length > 0) || isDrawing || isEditingMode || selectedPolygon} 
        savePolygonToDatabase={savePolygonToDatabase} // Передаем для onBlur сохранения
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
                <p>
                  Кликайте на карту, чтобы добавлять точки.
                  Двойной клик для завершения рисования полигона.
                </p>
                <p>
                  Нажмите "Остановить и сохранить" в боковой панели,
                  чтобы завершить и сохранить текущий полигон.
                </p>
              </>
            )}
            {isEditingMode && (
              <>
                <p>
                  Перемещайте вершины полигона, чтобы изменить его форму.
                  Нажмите "Остановить и сохранить" в боковой панели, чтобы применить изменения.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <ToastNotification 
        message={toast.message} 
        type={toast.type} 
        visible={toast.visible} 
      />

      {/* Диалог подтверждения очистки всех полигонов */}
      {showClearAllConfirm && (
        <ConfirmDialog
          message="Вы уверены, что хотите удалить ВСЕ полигоны? Это действие необратимо."
          onConfirm={handleClearAllConfirmed}
          onCancel={cancelClearAll}
          isProcessing={isSavingPolygon} // Используем isSavingPolygon как индикатор процесса
        />
      )}
    </div>
  );
}
