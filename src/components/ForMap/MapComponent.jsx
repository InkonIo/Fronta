// components/ForMap/MapComponent.jsx
import React, { useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMapEvents } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import * as L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
// Исправленный импорт для стилей Markercluster
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
  isEditingMode // isEditingMode теперь используется для логики поведения EditControl
}) {
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(13); // Состояние для отслеживания текущего зума карты

  // Хук для отслеживания событий карты, включая изменение масштаба
  const MapEventsHandler = () => {
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
      <MapEventsHandler /> {/* Добавляем обработчик событий карты */}

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
      {/* Этот FeatureGroup должен содержать только слои, напрямую управляемые EditControl для редактирования. */}
      {/* EditControl отображается только если isEditingMode активен, чтобы не мешать рисованию */}
      {isEditingMode && (
        <FeatureGroup ref={editableFGRef}>
          {editableFGRef.current && ( // Условный рендеринг EditControl, когда ref доступен
            <EditControl
              position="topright"
              onEdited={onPolygonEdited}
              draw={{
                polygon: false,
                rectangle: false,
                polyline: false,
                circle: false,
                marker: false,
                circlemarker: false
              }}
              edit={{
                featureGroup: editableFGRef.current,
                remove: false, // Отключаем кнопку удаления
                edit: false,   // Отключаем кнопку редактирования
              }}
            />
          )}
        </FeatureGroup>
      )}

      {/* НОВЫЙ КОМПОНЕНТ: Отвечает за отображение всех полигонов.
          Он должен быть вне FeatureGroup для editableFGRef, чтобы избежать конфликтов. */}
      <PolygonAndMarkerLayer
        polygons={polygons}
        zoom={zoom}
        calculateArea={calculateArea}
        formatArea={formatArea}
        selectedPolygon={selectedPolygon}
      />
    </MapContainer>
  );
}
