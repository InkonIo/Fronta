// components/ForMap/MapComponent.jsx
import React, { useRef, useState, useCallback } from 'react'; // Добавлены useState, useCallback
import { MapContainer, TileLayer, FeatureGroup, useMapEvents } from 'react-leaflet'; // Добавлен useMapEvents
import { EditControl } from 'react-leaflet-draw';
import * as L from 'leaflet'; 
import { WMSTileLayer } from 'react-leaflet';
import 'leaflet-draw/dist/leaflet.draw.css'; 

import DrawingHandler from './DrawingHandler'; // Компонент для ручного рисования
import PolygonAndMarkerLayer from './PolygonAndMarkerLayer'; // НОВЫЙ компонент для отображения полигонов и маркеров

// Исправляем иконки по умолчанию для Leaflet Draw
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function MapComponent({ 
  polygons, 
  onPolygonComplete, 
  onPolygonEdited, 
  setIsDrawing, 
  isDrawing, 
  editableFGRef, // Ссылка на FeatureGroup для управления редактируемыми слоями
  selectedPolygon, // Добавлен для передачи в PolygonAndMarkerLayer
  isEditingMode // Добавлен для передачи в PolygonAndMarkerLayer
}) {
  const mapRef = useRef(null); // Ссылка на экземпляр карты Leaflet
  const [zoom, setZoom] = useState(13); // Состояние для отслеживания текущего зума карты

  // Хук для отслеживания событий карты, включая изменение масштаба
  const MapEventsHandler = () => {
    useMapEvents({
      zoomend: (e) => {
        setZoom(e.target.getZoom());
      },
    });
    return null; // Этот компонент ничего не рендерит
  };

  // Определение calculateArea непосредственно внутри MapComponent
  const calculateArea = useCallback((coordinates) => {
    if (!coordinates || coordinates.length < 3) return 0; 
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const R = 6371000; // Радиус Земли в метрах (среднее значение)
    let area = 0;
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; 
      const lat1 = toRadians(coordinates[i][0]);
      const lat2 = toRadians(coordinates[j][0]);
      const deltaLon = toRadians(coordinates[j][1] - coordinates[i][1]);

      area += (lat2 - lat1) * (toRadians(coordinates[i][1]) + toRadians(coordinates[j][1]));
    }
    return Math.abs(area) * (R * R) / 2;
  }, []);

  // Определение formatArea непосредственно внутри MapComponent
  const formatArea = useCallback((areaInSqMeters) => {
    if (areaInSqMeters < 10000) { // Меньше 1 гектара
      return `${areaInSqMeters.toFixed(2)} м²`;
    } else {
      return `${(areaInSqMeters / 10000).toFixed(2)} га`;
    }
  }, []);

  // Эта функция передается в DrawingHandler для завершения рисования вручную.
  // Она вызывает onPolygonComplete, который обновит состояние полигонов в родительском компоненте.
  const stopAndSaveDrawingFromMap = useCallback((currentPath) => {
    if (currentPath && currentPath.length >= 3) {
      onPolygonComplete(currentPath); // Добавляем новый полигон в центральное состояние
    }
    setIsDrawing(false); // Выключаем режим рисования
    // Очищаем текущий путь в DrawingHandler через глобальный метод (если он есть)
    if (window.clearCurrentPath) window.clearCurrentPath(); 
  }, [onPolygonComplete, setIsDrawing]);

  return (
    <MapContainer
      center={[43.2567, 76.9286]} // Центр карты (Алматы)
      zoom={13} // Начальный уровень масштабирования
      minZoom={9} // Установлен минимальный уровень зума (для предотвращения ошибки "exceeds the limit")
      maxZoom={16} // Установлен максимальный уровень зума (для предотвращения излишней пикселизации)
      style={{ height: '100%', flex: 1 }} // Занимает всю доступную высоту и растягивается
      ref={mapRef} // Привязываем ссылку к MapContainer
      whenCreated={(mapInstance) => {
        mapRef.current = mapInstance; // Сохраняем экземпляр карты
        setZoom(mapInstance.getZoom()); // Устанавливаем начальный зум
      }}
    >
      <MapEventsHandler /> {/* Добавляем обработчик событий карты */}

      {/* Тайловый слой карты Sentinel Hub */}
      <WMSTileLayer
  url="https://services.sentinel-hub.com/ogc/wms/2648bff2-b5c7-4b05-80cf-8cc8b31363cd"
  layers="TRUEYEP"
  format="image/png"
  transparent={true}
  version="1.3.0"
  attribution="&copy; Copernicus Sentinel data"
  time="latest"
  tileSize={512} // увеличим тайл до 512px — улучшает качество
  maxZoom={18}
  minZoom={8}
  params={{
    maxcc: 20, // максимум облачности в %
    showlogo: false, // отключим логотип Sentinel
  }}
/>


      {/* Обработчик рисования нового полигона */}
      <DrawingHandler
        onPolygonComplete={onPolygonComplete} // Колбэк для завершения рисования
        onStopAndSave={stopAndSaveDrawingFromMap} // Колбэк для ручной остановки и сохранения
        isDrawing={isDrawing} // Текущее состояние режима рисования
        setIsDrawing={setIsDrawing} // Функция для изменения состояния режима рисования
      />

      {/* FeatureGroup для управления слоями, которые могут быть отредактированы с помощью EditControl */}
      <FeatureGroup ref={editableFGRef}>
        {/* Компонент EditControl из react-leaflet-draw для редактирования полигонов */}
        {editableFGRef.current && ( // Условный рендеринг EditControl, когда ref доступен
          <EditControl
            position="topright" // Расположение панели инструментов редактирования на карте
            onEdited={onPolygonEdited} // Колбэк, вызываемый после завершения редактирования
            // Отключаем инструменты рисования, чтобы они не отображались на карте
            draw={{
              polygon: false,       // Отключаем инструмент рисования полигона
              rectangle: false,
              polyline: false,
              circle: false,
              marker: false,
              circlemarker: false
            }}
            // Настройки редактирования: указываем, какой FeatureGroup он будет управлять
            edit={{
              featureGroup: editableFGRef.current,
              remove: false,        // Отключаем инструмент удаления полигонов
              edit: false,          // Отключаем инструмент редактирования вершин в тулбаре
            }}
          />
        )}

        {/* Отображаем все существующие полигоны и их маркеры через новый компонент */}
        <PolygonAndMarkerLayer
          polygons={polygons}
          zoom={zoom} // Передаем текущий зум
          calculateArea={calculateArea} // Передаем функцию расчета площади
          formatArea={formatArea} // Передаем функцию форматирования площади
          isDrawing={isDrawing}
          isEditingMode={isEditingMode}
          selectedPolygon={selectedPolygon}
        />
      </FeatureGroup>
    </MapContainer>
  );
}
