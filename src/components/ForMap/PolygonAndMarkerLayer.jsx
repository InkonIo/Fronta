// components/ForMap/PolygonAndMarkerLayer.jsx
import React from 'react';
import { Polygon, Marker, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import * as L from 'leaflet';

// Вспомогательная функция для извлечения базового названия культуры из комбинированной строки
const extractCropBase = (combinedString) => {
  if (!combinedString) return '';
  const lastParenIndex = combinedString.lastIndexOf('(');
  if (lastParenIndex !== -1 && combinedString.endsWith(')')) {
    return combinedString.substring(0, lastParenIndex).trim();
  }
  return combinedString.trim();
};

export default function PolygonAndMarkerLayer({ polygons, zoom, calculateArea, formatArea, isDrawing, isEditingMode, selectedPolygon }) {
  return (
    <>
      {/* Отображаем все существующие полигоны */}
      {polygons.map((polygon) => {
        if (!polygon.coordinates || polygon.coordinates.length < 3) {
          console.warn(`Полигон ${polygon.id} имеет некорректные координаты и не будет отображен.`);
          return null;
        }

        return (
          <Polygon
            key={polygon.id}
            positions={polygon.coordinates} // Координаты полигона
            color={polygon.color || 'blue'} // Цвет обводки полигона
            fillColor={polygon.color || 'blue'} // Цвет заливки
            fillOpacity={0.4} // Прозрачность заливки
            weight={2} // Толщина обводки
            opacity={0.8} // Прозрачность обводки
            onClick={() => {
              if (!isDrawing && !isEditingMode) { 
                // setSelectedPolygon(polygon.id); // Если хотите выбирать полигон при клике на него
              }
            }}
          >
            {/* Тултип для отображения информации при наведении на сам полигон */}
            <Tooltip direction="center" offset={[0, 0]} opacity={0.9} permanent={false}>
              <div style={{ fontWeight: 'bold' }}>{polygon.name || 'Полигон'}</div>
              {polygon.crop && <div>Культура: {polygon.crop}</div>}
              <div>Площадь: {formatArea(calculateArea(polygon.coordinates))}</div>
            </Tooltip>
          </Polygon>
        );
      })}

      {/* Кластеризация маркеров */}
      <MarkerClusterGroup chunkedLoading>
        {polygons.map((polygon) => {
          if (!polygon.coordinates || polygon.coordinates.length < 3) return null;

          const latLngs = polygon.coordinates.map(c => L.latLng(c[0], c[1]));
          const bounds = L.latLngBounds(latLngs);
          const center = bounds.isValid() ? bounds.getCenter() : null;

          if (!center) return null;

          // Логика для динамического отображения маркера в зависимости от зума
          let iconHtml = '';
          let iconSize = [24, 24]; // Базовый размер
          let iconAnchor = [12, 12]; // Базовая привязка
          let backgroundColor = 'rgba(255,255,255,0.8)'; 

          // Кластеризация MarkerClusterGroup будет обрабатывать "компановку" маркеров
          // При низком зуме она покажет число полигонов в кластере, при высоком - индивидуальные маркеры.
          if (zoom < 9) { // Очень низкий зум: небольшая иконка
              iconHtml = '🌍'; 
              iconSize = [30, 30];
              iconAnchor = [15, 15];
          } else if (zoom >= 9 && zoom < 13) { // Средний зум: более четкий пин
              iconHtml = '📍'; 
              iconSize = [24, 24];
              iconAnchor = [12, 12];
          } else { // Высокий зум: небольшой, возможно, более детализированный эмодзи
              iconHtml = '✨'; 
              iconSize = [20, 20];
              iconAnchor = [10, 10];
          }

          const customIcon = L.divIcon({
            className: 'custom-polygon-marker', 
            html: `<div style="text-align: center; font-size: ${iconSize[0] * 0.7}px; background-color: ${backgroundColor}; border-radius: 50%; width: ${iconSize[0]}px; height: ${iconSize[1]}px; display: flex; justify-content: center; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">${iconHtml}</div>`,
            iconSize: iconSize,
            iconAnchor: iconAnchor,
          });

          return (
            <Marker position={center} icon={customIcon} key={`marker-${polygon.id}`}>
              {/* Тултип, который появляется при наведении на маркер */}
              <Tooltip>
                  <div><strong>{polygon.name || 'Полигон'}</strong></div>
                  {polygon.crop && <div>Культура: {polygon.crop}</div>}
                  <div>Площадь: {formatArea(calculateArea(polygon.coordinates))}</div>
              </Tooltip>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </>
  );
}
