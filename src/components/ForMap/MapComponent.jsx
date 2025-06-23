// components/ForMap/MapComponent.jsx
import React, { useRef } from 'react';
import { MapContainer, TileLayer, Polygon, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import * as L from 'leaflet'; // Импортируем библиотеку Leaflet для доступа к L.polygon и т.д.
import 'leaflet-draw/dist/leaflet.draw.css'; // Импортируем стили для инструментов рисования
import DrawingHandler from './DrawingHandler'; // Компонент, который будет обрабатывать интерактивное рисование

export default function MapComponent({ 
  polygons, 
  onPolygonComplete, 
  onPolygonEdited, 
  setIsDrawing, 
  isDrawing, 
  editableFGRef // Ссылка на FeatureGroup для управления редактируемыми слоями
}) {
  const mapRef = useRef(null); // Ссылка на экземпляр карты Leaflet

  // Эта функция передается в DrawingHandler для завершения рисования вручную.
  // Она вызывает onPolygonComplete, который обновит состояние полигонов в родительском компоненте.
  const stopAndSaveDrawingFromMap = (currentPath) => {
    if (currentPath && currentPath.length >= 3) {
      onPolygonComplete(currentPath); // Добавляем новый полигон в центральное состояние
    }
    setIsDrawing(false); // Выключаем режим рисования
    // Очищаем текущий путь в DrawingHandler через глобальный метод (если он есть)
    if (window.clearCurrentPath) window.clearCurrentPath(); 
  };

  return (
    <MapContainer
      center={[43.2567, 76.9286]} // Центр карты (Алматы)
      zoom={13} // Начальный уровень масштабирования
      style={{ height: '100%', flex: 1 }} // Занимает всю доступную высоту и растягивается
      ref={mapRef} // Привязываем ссылку к MapContainer
    >
      {/* Тайловый слой карты (спутниковые снимки Google) */}
      <TileLayer
        attribution="&copy; Google"
        url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
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
            // move: false,          // Можно отключить перемещение полигонов, если не нужно
            // resize: false,        // Можно отключить изменение размера
            // cut: false,           // Можно отключить инструмент "вырезать"
          }}
        />
        
        {/* Отображаем все существующие полигоны.
            Они не управляются напрямую EditControl, пока не выбраны для редактирования через handleEditPolygon. */}
        {polygons.map((p) => (
          <Polygon
            key={p.id}
            positions={p.coordinates} // Координаты полигона
            pathOptions={{
              color: p.color, // Цвет обводки полигона
              fillOpacity: 0.3, // Прозрачность заливки
              weight: 2, // Толщина обводки
            }}
          />
        ))}
      </FeatureGroup>
    </MapContainer>
  );
}
