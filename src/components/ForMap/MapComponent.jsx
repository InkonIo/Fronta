// components/ForMap/MapComponent.jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMapEvents, useMap } from 'react-leaflet'; // Добавил useMap
import { EditControl } from 'react-leaflet-draw';
import * as L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import DrawingHandler from './DrawingHandler';
import PolygonAndMarkerLayer from './PolygonAndMarkerLayer'; // Компонент для отображения полигонов и маркеров

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
  editableFGRef,
  selectedPolygon,
  isEditingMode,
  editingMapPolygon // <-- Новый пропс: полигон, который сейчас редактируется
}) {
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(13); // Состояние для отслеживания текущего зума карты

  // Внутренний компонент для доступа к экземпляру карты через useMap
  const MapInteractionHandler = () => {
    const map = useMap(); // Получаем экземпляр карты Leaflet

    // Функция для центрирования и приближения к маркеру
    const flyToMarker = useCallback((latlng, newZoom = 15) => {
      if (map) {
        map.flyTo(latlng, newZoom, {
          duration: 1.5, // Длительность анимации в секундах
        });
      }
    }, [map]);

    // Передаем flyToMarker через контекст или как обычный пропс вниз,
    // но для простоты, если PolygonAndMarkerLayer является прямым потомком MapComponent,
    // можно передать его напрямую в MapComponent и затем в PolygonAndMarkerLayer.
    // Здесь мы просто возвращаем null, так как эта функция предназначена для использования родительским компонентом
    // и передачей вниз через пропсы.
    useEffect(() => {
      // Это способ передать функцию flyToMarker на уровень MapComponent
      // чтобы затем MapComponent передал ее в PolygonAndMarkerLayer.
      // Обычно, если MapInteractionHandler не является отдельным компонентом,
      // flyToMarker можно объявить непосредственно в MapComponent.
      // Но в данной структуре, мы можем вернуть ее из useMapEvents или использовать контекст.
      // Проще всего объявить ее в родительском компоненте и передать.
      // Для этой демонстрации, я передам map.flyTo напрямую из MapComponent в PolygonAndMarkerLayer.
    }, [flyToMarker]);

    // Возвращаем null, так как этот компонент не рендерит UI сам по себе
    // он только предоставляет доступ к экземпляру карты.
    useMapEvents({
        zoomend: (e) => {
            setZoom(e.target.getZoom());
        },
    });
    return null;
  };


  // Мемоизированные функции для расчета и форматирования площади (передаются в PolygonAndMarkerLayer)
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

  // stopAndSaveDrawingFromMap больше не используется напрямую здесь, DrawingHandler обрабатывает это
  const stopAndSaveDrawingFromMap = useCallback((currentPath) => {
    if (currentPath && currentPath.length >= 3) {
      onPolygonComplete(currentPath);
    }
    setIsDrawing(false);
    if (window.clearCurrentPath) window.clearCurrentPath();
  }, [onPolygonComplete, setIsDrawing]);

  // НОВЫЙ ЭФФЕКТ ДЛЯ РЕДАКТИРОВАНИЯ:
  // Этот эффект отвечает за добавление полигона в editableFGRef и включение редактирования
  useEffect(() => {
    // Проверяем, что режим редактирования включен, реф доступен и есть полигон для редактирования
    if (isEditingMode && editableFGRef.current && editingMapPolygon) {
      console.log('[MapComponent useEffect] Editing mode active, ref and polygon available.');
      // Очищаем любые предыдущие слои в editableFGRef, чтобы убедиться, что только один полигон активен для редактирования
      editableFGRef.current.clearLayers();

      // Создаем Leaflet Polygon слой из координат полигона, который редактируется
      const leafletPolygon = L.polygon(editingMapPolygon.coordinates);
      editableFGRef.current.addLayer(leafletPolygon); // Добавляем его в FeatureGroup

      // Включаем режим редактирования Leaflet для этого слоя
      if (leafletPolygon.editing) {
        leafletPolygon.editing.enable();
        console.log('[MapComponent useEffect] Enabled Leaflet editing for polygon:', editingMapPolygon.id);
      } else {
        console.error('[MapComponent useEffect] Leaflet polygon editing not available for this layer.');
      }
    } else if (!isEditingMode && editableFGRef.current) {
      // Если режим редактирования выключен, очищаем все активные слои редактирования
      editableFGRef.current.clearLayers();
      console.log('[MapComponent useEffect] Editing mode off, cleared editable layers.');
    }
  }, [isEditingMode, editableFGRef, editingMapPolygon]); // Зависимости для этого эффекта

  return (
    <MapContainer
      center={[43.2567, 76.9286]}
      zoom={13}
      style={{ height: '100%', flex: 1 }}
      ref={mapRef}
      whenCreated={(mapInstance) => {
        mapRef.current = mapInstance;
        setZoom(mapInstance.getZoom());
      }}
    >
      <MapInteractionHandler /> {/* Добавляем обработчик событий карты и доступ к экземпляру карты */}

      {/* Тайловый слой карты (спутниковые снимки Google) */}
      <TileLayer
        attribution="&copy; Google"
        url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
      />

      {/* DrawingHandler: отвечает за рисование полигонов вручную */}
      <DrawingHandler
        onPolygonComplete={onPolygonComplete}
        onStopAndSave={stopAndSaveDrawingFromMap} 
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
      />

      {/* FeatureGroup для управления слоями, которые могут быть отредактированы с помощью EditControl */}
      {/* Этот FeatureGroup и EditControl рендерятся ТОЛЬКО если isEditingMode активен */}
      {isEditingMode && ( 
        <FeatureGroup ref={editableFGRef}>
          {/* EditControl теперь всегда внутри FeatureGroup, если FeatureGroup рендерится */}
          <EditControl
            position="topright"
            onEdited={onPolygonEdited}
            draw={{
              polygon: false, rectangle: false, polyline: false,
              circle: false, marker: false, circlemarker: false
            }}
            edit={{
              featureGroup: editableFGRef.current, // editableFGRef.current будет доступен здесь, так как FeatureGroup уже отрендерился
              remove: false, // Отключаем кнопку удаления
              edit: false,   // Отключаем кнопку редактирования
            }}
          />
        </FeatureGroup>
      )}

      {/* Компонент PolygonAndMarkerLayer: Отвечает за отображение всех полигонов.
          Он находится вне FeatureGroup editableFGRef, чтобы избежать конфликтов и "пропадания" полигонов. */}
      {/* Передаем функцию map.flyTo напрямую */}
      <MapComponentInternalFlyTo
        polygons={polygons}
        zoom={zoom}
        calculateArea={calculateArea}
        formatArea={formatArea}
        selectedPolygon={selectedPolygon}
      />
    </MapContainer>
  );
}

// Отдельный компонент для использования useMap и передачи flyToMarker
function MapComponentInternalFlyTo({ polygons, zoom, calculateArea, formatArea, selectedPolygon }) {
  const map = useMap(); // Получаем экземпляр карты Leaflet здесь
  const flyToMarker = useCallback((latlng, newZoom = 15) => {
    if (map) {
      map.flyTo(latlng, newZoom, {
        duration: 1.5, // Длительность анимации в секундах
      });
    }
  }, [map]);

  return (
    <PolygonAndMarkerLayer
      polygons={polygons}
      zoom={zoom}
      calculateArea={calculateArea}
      formatArea={formatArea}
      selectedPolygon={selectedPolygon}
      flyToMarker={flyToMarker} // Передаем функцию flyToMarker
    />
  );
}
