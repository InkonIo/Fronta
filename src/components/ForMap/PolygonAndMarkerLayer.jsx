// components/ForMap/PolygonAndMarkerLayer.jsx
import React from 'react';
import { Polygon, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export default function PolygonAndMarkerLayer({ polygons, calculateArea, formatArea, selectedPolygon }) {
  // Marker icon for the center of polygons
  const polygonCenterIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png', // Default marker
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
  });

  return (
    <>
      {polygons.map((polygon) => {
        const isSelected = selectedPolygon === polygon.id;
        
        // Leaflet polygon options
        const polygonOptions = {
          color: isSelected ? '#ff0000' : polygon.color, // Красный, если выделен
          fillColor: isSelected ? '#ffaaaa' : polygon.color,
          fillOpacity: 0.5,
          weight: isSelected ? 4 : 2, // Толще граница, если выделен
          opacity: 1,
          lineJoin: 'round',
          // zIndex для Path слоев внутри одной панели.
          // Если вы хотите, чтобы выделенный полигон был ПОВЕРХ других, 
          // можете попробовать назначить ему более высокий zIndex.
          // Но это более надежно, если они находятся в одном "pane".
          // Если другие слои (например, от react-leaflet-draw) перекрывают, 
          // возможно, потребуется настройка panefor L.map.
        };

        // Calculate centroid for the marker (simple average for now)
        let center = [0, 0];
        if (polygon.coordinates.length > 0) {
          const latSum = polygon.coordinates.reduce((sum, coord) => sum + coord[0], 0);
          const lngSum = polygon.coordinates.reduce((sum, coord) => sum + coord[1], 0);
          center = [latSum / polygon.coordinates.length, lngSum / polygon.coordinates.length];
        }

        return (
          <Polygon key={polygon.id} positions={polygon.coordinates} pathOptions={polygonOptions}>
            {/* Optional marker at polygon center */}
            {center[0] !== 0 || center[1] !== 0 ? (
              <Marker position={center} icon={polygonCenterIcon}>
                <Popup>
                  <div>
                    <strong>Название:</strong> {polygon.name || 'Без названия'} <br/>
                    <strong>Культура:</strong> {polygon.crop || 'Не указана'} <br/>
                    <strong>Площадь:</strong> {formatArea(calculateArea(polygon.coordinates))}
                  </div>
                </Popup>
              </Marker>
            ) : null}
          </Polygon>
        );
      })}
    </>
  );
}
