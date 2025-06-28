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
  // Состояния для индикаторов загрузки/сохранения на БЭКЕНДЕ
  const [isSavingPolygon, setIsSavingPolygon] = useState(false);
  const [isFetchingPolygons, setIsFetchingPolygons] = useState(false);
  // Состояние для диалога подтверждения очистки
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Состояние для слоя Sentinel Hub (по умолчанию True Color)
  const [sentinelLayerId, setSentinelLayerId] = useState('1_TRUE_COLOR');


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
  const savePolygonToDatabase = useCallback(async (polygonData, isUpdate = false) => {
    const { id, name, coordinates, crop } = polygonData;

    if (!name || name.trim() === '') {
      showToast('Ошибка сохранения: название полигона не может быть пустым.', 'error');
      console.error('Ошибка сохранения: название полигона не может быть пустым.');
      return;
    }

    // Создаем объект GeoJSON Geometry
    const geoJsonGeometry = {
        type: "Polygon",
        coordinates: [coordinates.map(coord => [coord[1], coord[0]])] // Leaflet [lat, lng] to GeoJSON [lng, lat]
    };

    // В payload теперь name, crop и geoJson будут отдельными полями.
    // geoJson будет содержать ТОЛЬКО строку GeoJSON Geometry.
    const payload = {
      name: name.trim(),
      crop: crop || null,
      geoJson: JSON.stringify(geoJsonGeometry) // <-- Отправляем СТРОКУ GeoJSON Geometry
    };

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    setIsSavingPolygon(true);
    try {
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate ? `${BASE_API_URL}/api/polygons/${id}` : `${BASE_API_URL}/api/polygons`;

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload), // JSON.stringify преобразует весь payload
      });

      const responseBody = await parseResponseBody(response);

      if (!response.ok) {
        let errorMessage = response.statusText;
        if (typeof responseBody === 'object' && responseBody !== null && responseBody.message) {
          errorMessage = responseBody.message;
        } else if (typeof responseBody === 'string' && responseBody.length > 0) {
          errorMessage = responseBody;
        }
        showToast(`Ошибка ${isUpdate ? 'обновления' : 'сохранения'} полигона на сервере: ${errorMessage}`, 'error');
        throw new Error(`Ошибка ${isUpdate ? 'обновления' : 'сохранения'} полигона на сервере: ${response.status} - ${errorMessage}`);
      }

      showToast(`Полигон "${name}" успешно ${isUpdate ? 'обновлен' : 'сохранен'} на сервере!`, 'success');
      console.log(`Полигон успешно ${isUpdate ? 'обновлен' : 'сохранен'} на сервере:`, responseBody);

      if (!isUpdate) {
        // ID от сервера должен быть в responseBody, если бэкенд его возвращает
        const actualPolygonId = (typeof responseBody === 'object' && responseBody !== null && responseBody.id)
                                ? responseBody.id
                                : (typeof responseBody === 'string' ? responseBody : id); // Fallback если responseBody - это просто ID строка

        // Обновляем локальное состояние с реальным ID от сервера.
        // Это вызовет эффект сохранения в localStorage.
        setPolygons(prev => prev.map(p => p.id === id ? { ...p, id: String(actualPolygonId) } : p));
      } else {
        // Если это обновление, локальное состояние уже должно быть обновлено
        // через updatePolygonName/updatePolygonCrop/handleStopAndSaveEdit
        // Здесь мы просто подтверждаем, что polygonData актуальна.
        setPolygons(prev => prev.map(p => p.id === id ? { ...polygonData } : p));
      }

    } catch (error) {
      showToast(`Не удалось ${isUpdate ? 'обновить' : 'сохранить'} полигон на сервере: ${error.message}`, 'error');
      console.error(`Ошибка при ${isUpdate ? 'обновлении' : 'сохранении'} полигона на сервере:`, error);
    } finally {
      setIsSavingPolygon(false);
    }
  }, [showToast]);

  // --- Эффект для сохранения полигонов в localStorage при КАЖДОМ изменении `polygons` ---
  // Этот эффект срабатывает КАЖДЫЙ РАЗ, когда массив `polygons` меняется.
  useEffect(() => {
    try {
      localStorage.setItem('savedPolygons', JSON.stringify(polygons));
      // console.log('Полигоны сохранены локально в localStorage.'); // Для отладки
    } catch (error) {
      console.error("Ошибка при сохранении полигонов в localStorage:", error);
      showToast('Ошибка сохранения полигонов на локальное устройство.', 'error');
    }
  }, [polygons]); // Зависимость от polygons

  // --- Коллбэки для управления полигонами ---

  // Начать режим рисования
  const startDrawing = () => {
    console.log('startDrawing: Entering drawing mode');
    setIsDrawing(true);
    setSelectedPolygon(null);
    setIsEditingMode(false);
    setEditingMapPolygon(null);
    editableFGRef.current?.clearLayers(); // Очищаем временный слой редактирования
    showToast('Режим рисования активирован. Кликайте для добавления точек.', 'info');
  };

  // Остановить режим рисования (без сохранения)
  const stopDrawing = () => {
    console.log('stopDrawing: Exiting drawing mode');
    setIsDrawing(false);
    if (window.clearCurrentPath) {
      window.clearCurrentPath();
    }
    showToast('Режим рисования остановлен.', 'info');
  };

  // Коллбэк, вызываемый EditControl при завершении рисования (двойной клик)
  const onPolygonComplete = useCallback((coordinates) => {
    console.log('onPolygonComplete: New polygon completed', coordinates);
    let finalCoordinates = [...coordinates];
    // Проверяем, замкнут ли контур. Если нет, добавляем первую точку в конец.
    if (finalCoordinates.length > 0 &&
        (finalCoordinates[0][0] !== finalCoordinates[finalCoordinates.length - 1][0] ||
         finalCoordinates[0][1] !== finalCoordinates[finalCoordinates.length - 1][1])) {
      finalCoordinates.push(finalCoordinates[0]);
      console.log('onPolygonComplete: Polygon ring closed by adding first point to end.');
    }

    const newPolygon = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Временный ID
      coordinates: finalCoordinates, // Используем замкнутые координаты
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      crop: null,
      name: `Новый полигон ${new Date().toLocaleString()}`
    };

    // Сразу добавляем в локальное состояние (и это вызовет сохранение в localStorage через useEffect)
    setPolygons((prev) => [...prev, newPolygon]);

    setIsDrawing(false); // Make sure drawing mode is off
    setSelectedPolygon(newPolygon.id);
    showToast('Полигон нарисован и сохранен локально! Отправка на сервер...', 'info');

    // Автоматическое сохранение нового полигона в БД с именем по умолчанию
    savePolygonToDatabase(newPolygon);
  }, [savePolygonToDatabase, showToast]);

  // Удалить полигон по ID из локального состояния и БД
  const deletePolygon = useCallback(async (id) => {
    console.log('deletePolygon: Attempting to delete polygon with ID', id);
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    // Удаляем сначала из локального состояния для мгновенного отклика (вызовет сохранение в localStorage)
    setPolygons((prev) => prev.filter((p) => p.id !== id));
    setSelectedPolygon(null);
    if (editingMapPolygon && editingMapPolygon.id === id) {
      setIsEditingMode(false);
      setEditingMapPolygon(null);
    }
    showToast('Полигон удален локально. Отправка запроса на сервер...', 'info');

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
        showToast(`Ошибка удаления полигона с сервера: ${errorMessage}`, 'error');
        throw new Error(`Ошибка удаления полигона с сервера: ${response.status} - ${errorMessage}`);
      }

      showToast('Полигон успешно удален с сервера!', 'success');
      console.log(`Polygon with ID ${id} successfully deleted from DB.`);

    } catch (error) {
      showToast(`Не удалось удалить полигон с сервера: ${error.message}`, 'error');
      console.error('Ошибка при удалении полигона из БД:', error);
      // Если удаление с сервера не удалось, рассмотрите возможность вернуть полигон в UI
      // или предложить опцию "повторить синхронизацию"
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

  // Подтверждение очистки всех полигонов (из локального состояния и из БД)
  const handleClearAllConfirmed = useCallback(async () => {
    setShowClearAllConfirm(false);
    showToast('Начинаю очистку всех полигонов...', 'info');

    // Очищаем локальное состояние и localStorage для мгновенного отклика
    setPolygons([]);
    localStorage.removeItem('savedPolygons');

    setSelectedPolygon(null);
    setIsDrawing(false);
    setIsEditingMode(false);
    setEditingMapPolygon(null);
    editableFGRef.current?.clearLayers(); // Очищаем временный слой редактирования
    showToast('Все полигоны удалены локально. Отправка запроса на сервер...', 'info');

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    setIsSavingPolygon(true);
    try {
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
            showToast(`Ошибка очистки всех полигонов с сервера: ${errorMessage}`, 'error');
            throw new Error(`Ошибка очистки всех полигонов с сервера: ${response.status} - ${errorMessage}`);
        }

        showToast('Все полигоны успешно удалены с сервера!', 'success');
        console.log('All polygons successfully cleared from DB.');

    } catch (error) {
        showToast(`Не удалось очистить все полигоны с сервера: ${error.message}`, 'error');
        console.error('Ошибка при очистке всех полигонов из БД:', error);
    } finally {
      setIsSavingPolygon(false);
    }
  }, [showToast]);

  // Очистить все полигоны (теперь вызывает подтверждение)
  const clearAll = useCallback(() => {
    if (polygons.length === 0) {
      showToast('На карте нет полигонов для удаления.', 'info');
      return;
    }
    confirmClearAll();
  }, [polygons.length, confirmClearAll, showToast]);

  // Очистить все назначенные культуры со всех полигонов (только на фронтенде)
  const clearAllCrops = useCallback(() => {
    console.log('clearAllCrops: Clearing all assigned crops.');
    // Обновляем локальное состояние (вызовет сохранение в localStorage).
    setPolygons((prev) => prev.map((p) => ({ ...p, crop: null })));
    showToast('Все культуры удалены с полигонов. Синхронизируйте с сервером вручную, если необходимо.', 'info');
    // Если нужно синхронизировать это с БД, потребуется отправить PUT-запросы для каждого полигоны
    // или добавить отдельный эндпоинт на бэкенде для массовой очистки культур.
  }, [showToast]);

  // Обновить культуру для конкретного полигона (в локальном состоянии и затем в БД)
  const updatePolygonCrop = useCallback((polygonId, newCombinedCrop) => {
    console.log(`updatePolygonCrop: Updating polygon ${polygonId} with crop ${newCombinedCrop}.`);
    // Обновляем локальное состояние (вызовет сохранение в localStorage)
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) => (p.id === polygonId ? { ...p, crop: newCombinedCrop } : p));
      return updatedPolys;
    });
    // Сохранение в БД будет вызвано onBlur в MapSidebar
  }, []);

  // Обновление имени полигона (в локальном состоянии и затем в БД)
  const updatePolygonName = useCallback((polygonId, newName) => {
    console.log(`updatePolygonName: Updating polygon ${polygonId} with name ${newName}.`);
    // Обновляем локальное состояние (вызовет сохранение в localStorage)
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, name: newName } : p
      );
      return updatedPolys;
    });
    // Сохранение в БД будет вызвано onBlur в MapSidebar
  }, []);

  // --- Логика редактирования полигона с помощью react-leaflet-draw ---

  // Функция для начала редактирования выбранного полигона
  const handleEditPolygon = useCallback((polygonId) => {
    console.log(`[handleEditPolygon] Attempting to edit polygon with ID: ${polygonId}`);
    // Сбросить флаги сохранения/загрузки на всякий случай
    setIsSavingPolygon(false);
    setIsFetchingPolygons(false);

    // Очищаем режим рисования, если он активен
    if (isDrawing) {
      console.log('[handleEditPolygon] Exiting drawing mode.');
      setIsDrawing(false);
      if (window.clearCurrentPath) window.clearCurrentPath(); // Очищаем незавершенное рисование
    }

    // Если уже был активен режим редактирования (например, нажали на другой полигон),
    // очищаем предыдущие слои, которыми управлял EditControl.
    if (editableFGRef.current) {
        editableFGRef.current.clearLayers();
    }

    const polygonToEdit = polygons.find((p) => p.id === polygonId);
    if (!polygonToEdit) {
      console.error('[handleEditPolygon] Polygon for editing not found in state.');
      showToast('Полигон для редактирования не найден.', 'error');
      return;
    }

    // Устанавливаем состояния, которые вызовут рендеринг MapComponent
    // и активацию эффекта редактирования в нем
    setIsEditingMode(true);
    setEditingMapPolygon(polygonToEdit); // Передаем полигон для редактирования в MapComponent
    setSelectedPolygon(polygonToEdit.id);
    showToast(`Начато редактирование формы полигона "${polygonToEdit.name || polygonToEdit.id}".`, 'info');
    console.log('[handleEditPolygon] isEditingMode set to TRUE. isSavingPolygon and isFetchingPolygons set to FALSE.');
  }, [polygons, isDrawing, showToast]);

  // Функция для программной остановки и сохранения редактирования (как формы, так и карты)
  const handleStopAndSaveEdit = useCallback(() => {
    console.log('handleStopAndSaveEdit: Attempting to stop and save.');
    // Если мы в режиме рисования, завершаем рисование (и очищаем DrawingHandler)
    if (isDrawing) {
      if (window.clearCurrentPath) window.clearCurrentPath();
      stopDrawing();
      showToast('Рисование остановлено.', 'info');
    }
    // Если мы в режиме редактирования формы/карты, сохраняем изменения.
    else if (isEditingMode && editableFGRef.current) {
      editableFGRef.current.eachLayer(layer => {
        if (layer.editing && layer.editing.enabled()) {
          console.log('handleStopAndSaveEdit: Disabling editing for active layer.');
          layer.editing.disable();

          if (editingMapPolygon) {
              const geoJson = layer.toGeoJSON();
              const updatedCoords = geoJson.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);

              const currentPolygonInState = polygons.find(p => p.id === editingMapPolygon.id);
              if (currentPolygonInState) {
                  const updatedPoly = {
                      ...currentPolygonInState,
                      coordinates: updatedCoords,
                  };
                  // Обновляем локальное состояние напрямую (вызовет сохранение в localStorage)
                  setPolygons(prev => prev.map(p => p.id === updatedPoly.id ? updatedPoly : p));
                  showToast('Форма полигона обновлена и сохранена локально! Отправка на сервер...', 'info');
                  savePolygonToDatabase(updatedPoly, true);
              }
          }
        }
      });
      console.log('handleStopAndSaveEdit: Forcing state reset for editing mode.');
      setIsEditingMode(false);
      setEditingMapPolygon(null);
      editableFGRef.current?.clearLayers();
      showToast('Редактирование завершено и сохранено.', 'success');
    } else {
      showToast('Нет активных режимов для сохранения.', 'info');
    }
  }, [isDrawing, stopDrawing, isEditingMode, editingMapPolygon, polygons, savePolygonToDatabase, showToast]);


  // Коллбэк, вызываемый EditControl после завершения редактирования формы полигона
  const onPolygonEdited = useCallback(async (e) => {
    console.log('onPolygonEdited: Event received from EditControl. Layers:', e.layers);
    if (isEditingMode) {
      setIsEditingMode(false);
      setEditingMapPolygon(null);
      showToast('Редактирование формы на карте завершено.', 'info');
    }
  }, [isEditingMode, editingMapPolygon, showToast]);


  // Функция для загрузки "Моих полигонов" с сервера
  const showMyPolygons = useCallback(async () => {
    showToast('Загрузка ваших полигонов с сервера...', 'info');

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      return;
    }

    setIsFetchingPolygons(true);
    try {
        const response = await fetch(`${BASE_API_URL}/api/polygons/my`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await parseResponseBody(response);

        if (!response.ok) {
            let errorMessage = response.statusText;
            if (typeof data === 'object' && data !== null && data.message) {
              errorMessage = data.message;
            } else if (typeof data === 'string' && data.length > 0) {
              errorMessage = data;
            }
            showToast(`Ошибка загрузки полигонов с сервера: ${errorMessage}`, 'error');
            throw new Error(`Ошибка загрузки полигонов с сервера: ${response.status} - ${errorMessage}`);
        }

        console.log('Мои полигоны загружены с сервера:', data);

        if (data && Array.isArray(data)) {
          const loadedPolygons = data.map(item => {
            let coordinates = [];
            let name = item.name || `Загруженный полигон ${item.id || String(Date.now())}`;
            let crop = item.crop || null;

            try {
              const parsedGeoJson = JSON.parse(item.geoJson);
              let geometryData = parsedGeoJson;

              if (parsedGeoJson.type === "Feature" && parsedGeoJson.geometry) {
                geometryData = parsedGeoJson.geometry;
              }

              if (geometryData && geometryData.type === "Polygon" && geometryData.coordinates && geometryData.coordinates[0]) {
                coordinates = geometryData.coordinates[0].map(coord => [coord[1], coord[0]]); // [lng, lat] to [lat, lng]
              } else {
                console.warn('Invalid GeoJSON Geometry structure for item:', item);
              }
            } catch (e) {
              console.error('Failed to parse geoJson for item:', item, e);
            }

            return {
              id: String(item.id),
              coordinates: coordinates,
              color: `hsl(${Math.random() * 360}, 70%, 50%)`,
              crop: crop,
              name: name
            };
          }).filter(p => p.coordinates.length >= 3);

          setPolygons(loadedPolygons); // Обновляем основное состояние полигонов (вызовет сохранение в localStorage)
          showToast(`Загружено ${loadedPolygons.length} ваших полигонов с сервера.`, 'success');

          setIsDrawing(false);
          setIsEditingMode(false);
          setEditingMapPolygon(null);
          editableFGRef.current?.clearLayers();
          setSelectedPolygon(null);
        } else {
          showToast('Сервер вернул некорректный формат данных для полигонов.', 'error');
          console.error('Сервер вернул некорректный формат данных:', data);
        }

    } catch (error) {
        showToast(`Не удалось загрузить мои полигоны с сервера: ${error.message}`, 'error');
        console.error('Ошибка при загрузке моих полигонов с сервера:', error);
    } finally {
      setIsFetchingPolygons(false);
    }
  }, [showToast]);

  // Эффект для инициализации полигонов: сначала из localStorage, затем из API
  useEffect(() => {
    let loadedFromLocalStorage = false;
    try {
      const storedPolygons = localStorage.getItem('savedPolygons');
      console.log('localStorage raw content for savedPolygons:', storedPolygons); // НОВЫЙ ЛОГ
      if (storedPolygons !== null && storedPolygons !== '[]') { // Проверяем, что не null и не пустой массив
        const parsedPolygons = JSON.parse(storedPolygons);
        console.log('Parsed polygons from localStorage:', parsedPolygons); // НОВЫЙ ЛОГ

        // Дополнительная валидация, чтобы убедиться, что данные выглядят как массив полигонов
        if (Array.isArray(parsedPolygons) && parsedPolygons.every(p => p && p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 3)) {
          setPolygons(parsedPolygons);
          showToast('Полигоны загружены с локального устройства.', 'success');
          loadedFromLocalStorage = true;
          console.log('Polygons successfully loaded from localStorage into state.'); // НОВЫЙ ЛОГ
        } else {
          console.warn('Invalid polygons data format in localStorage. Clearing and attempting to load from server.', parsedPolygons);
          localStorage.removeItem('savedPolygons'); // Очищаем поврежденные или некорректные данные
        }
      } else {
        console.log('localStorage для полигонов пуст или отсутствует. Загружаю с сервера.'); // НОВЫЙ ЛОГ
      }
    } catch (error) {
      console.error("Критическая ошибка парсинга полигонов из localStorage. Очищаю и пытаюсь загрузить с сервера:", error); // НОВЫЙ ЛОГ
      showToast('Критическая ошибка загрузки полигонов с локального устройства, пытаюсь загрузить с сервера.', 'error');
      localStorage.removeItem('savedPolygons'); // Очищаем данные, вызвавшие ошибку
    }

    // Если не удалось загрузить из localStorage, или localStorage был пуст/некорректен, загружаем с сервера
    if (!loadedFromLocalStorage) {
      console.log('Attempting to load polygons from server as localStorage was empty or invalid.'); // НОВЫЙ ЛОГ
      showMyPolygons();
    }
  }, [showToast, showMyPolygons]); // showMyPolygons в зависимостях, чтобы гарантировать его актуальность

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      <MapComponent
        polygons={polygons}
        onPolygonComplete={onPolygonComplete}
        onPolygonEdited={onPolygonEdited}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        editableFGRef={editableFGRef}
        selectedPolygon={selectedPolygon}
        isEditingMode={isEditingMode}
        editingMapPolygon={editingMapPolygon}
        sentinelLayerId={sentinelLayerId}
        baseApiUrl={BASE_API_URL}
        calculateArea={calculateArea} // Передаем calculateArea
        formatArea={formatArea}     // Передаем formatArea
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
        calculateArea={calculateArea}
        formatArea={formatArea}
        updatePolygonCrop={updatePolygonCrop}
        updatePolygonName={updatePolygonName}
        startDrawing={startDrawing}
        stopDrawing={stopDrawing}
        handleStopAndSaveEdit={handleStopAndSaveEdit}
        isDrawing={isDrawing}
        isEditingMode={isEditingMode}
        clearAll={clearAll}
        handleLogout={handleLogout}
        showMyPolygons={showMyPolygons}
        isSavingPolygon={isSavingPolygon}
        isFetchingPolygons={isFetchingPolygons}
        showToast={showToast}
        showCropsSection={true}
        savePolygonToDatabase={savePolygonToDatabase}
        baseApiUrl={BASE_API_URL}
        sentinelLayerId={sentinelLayerId}
        setSentinelLayerId={setSentinelLayerId}
      />

      <ToastNotification
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
      />
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
