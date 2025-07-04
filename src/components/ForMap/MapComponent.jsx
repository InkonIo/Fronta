// components/ForMap/MapComponent.jsx
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, FeatureGroup, Polygon, useMapEvents, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

import PolygonAndMarkerLayer from './PolygonAndMarkerLayer';

// Fix for default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// IMPORTANT: Replace with your actual Sentinel Hub Instance ID
const SENTINEL_HUB_INSTANCE_ID = 'f15c44d0-bbb8-4c66-b94e-6a8c7ab39349';

export default function MapComponent({
  polygons,
  onPolygonComplete,
  onPolygonEdited,
  isDrawing,
  setIsDrawing,
  editableFGRef,
  selectedPolygon,
  isEditingMode,
  editingMapPolygon,
  baseApiUrl,
  calculateArea,
  formatArea,
  // Пропсы для управления инфо-блоком из родительского PolygonDrawMap
  infoBoxVisible,
  setInfoBoxVisible,
  infoBoxLat,
  setInfoBoxLat,
  infoBoxLng,
  setInfoBoxLng,
  infoBoxNdvi,
  setInfoBoxNdvi,
  infoBoxLoading,
  setInfoBoxLoading,
  sentinelLayerId,
  setSentinelLayerId,
}) {
  const mapRef = useRef();
  const [sentinelLayer, setSentinelLayer] = useState(null);

  const [currentPath, setCurrentPath] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Опции для Sentinel Hub слоя (нужны здесь для рендера в JSX)
  const sentinelLayerOptions = useMemo(() => ([
    { id: '1_TRUE_COLOR', name: 'True Color (Естественные цвета)' },
    { id: '2_FALSE_COLOR', name: 'False Color (Ложные цвета)' },
    { id: '3_NDVI', name: 'NDVI (Индекс растительности)' },
  ]), []);

  useEffect(() => {
    window.clearCurrentPath = () => {
      setCurrentPath([]);
      setIsDrawing(false);
      setHoveredPoint(null);
    };
    return () => {
      window.clearCurrentPath = null;
    };
  }, [setIsDrawing]);

  const MapContentAndInteractions = ({
    isDrawing,
    currentPath,
    setCurrentPath,
    setHoveredPoint,
    onPolygonComplete,
    baseApiUrl,
    polygons,
    editableFGRef,
    selectedPolygon,
    isEditingMode,
    editingMapPolygon,
    onEdited,
    onDeleted,
    calculateArea,
    formatArea,
    // Пропсы для обновления родительских состояний
    setInfoBoxVisible,
    setInfoBoxLat,
    setInfoBoxLng,
    setInfoBoxNdvi,
    setInfoBoxLoading,
  }) => {
    const map = useMap();
    const editControlRefInternal = useRef();
    const fetchTimeout = useRef(null);

    const flyToMarker = useCallback((center, zoom) => {
      map.flyTo(center, zoom);
    }, [map]);

    useMapEvents({
  mousemove: (e) => {
    if (isDrawing && currentPath.length > 0) {
      setHoveredPoint([e.latlng.lat, e.latlng.lng]);
    }

    if (!isDrawing) {
      const { lat, lng } = e.latlng;
      setInfoBoxLat(lat.toFixed(5));
      setInfoBoxLng(lng.toFixed(5));
      setInfoBoxVisible(true);

      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
      fetchTimeout.current = setTimeout(async () => {
        setInfoBoxLoading(true);
        setInfoBoxNdvi('Загрузка...');
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${baseApiUrl}/api/v1/indices/ndvi`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ lat, lon: lng })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Ошибка: ${response.status}`);
          }

          const data = await response.json();
          setInfoBoxNdvi(data.ndvi !== null ? data.ndvi.toFixed(4) : 'Нет данных');
        } catch (error) {
          console.error('Error fetching NDVI:', error);
          setInfoBoxNdvi(`Ошибка: ${error.message.substring(0, 20)}...`);
        } finally {
          setInfoBoxLoading(false);
        }
      }, 300);
    }
  },

  click: (e) => {
    if (!isDrawing) return;
    const newPoint = [e.latlng.lat, e.latlng.lng];

    if (
      currentPath.length >= 3 &&
      isNearFirstPoint(newPoint, currentPath[0])
    ) {
      onPolygonComplete(currentPath);
      setCurrentPath([]);
      setIsDrawing(false);
      setHoveredPoint(null);
      return;
    }

    setCurrentPath((prev) => [...prev, newPoint]);
  },

  dblclick: (e) => {
    if (!isDrawing || currentPath.length < 3) return;
    onPolygonComplete(currentPath);
    setCurrentPath([]);
    setIsDrawing(false);
    setHoveredPoint(null);
  },

  mouseout: () => {
    setHoveredPoint(null);
    setInfoBoxVisible(false);
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
  }
});

    const displayDrawingPath = hoveredPoint && currentPath.length >= 1
      ? [...currentPath, hoveredPoint]
      : currentPath;

    return (
      <>
        <FeatureGroup ref={editableFGRef}>
          <EditControl
            ref={editControlRefInternal}
            position={null}
            onCreated={() => {}}
            onEdited={onEdited}
            onDeleted={onDeleted}
            draw={{
              polygon: false, rectangle: false, circle: false, marker: false, polyline: false, circlemarker: false,
            }}
            edit={{
              featureGroup: editableFGRef.current,
              edit: isEditingMode ? { selectedPathOptions: {} } : false,
              remove: false,
            }}
          />
          <PolygonAndMarkerLayer
            polygons={polygons.filter(p => !(isEditingMode && editingMapPolygon && editingMapPolygon.id === p.id))}
            calculateArea={calculateArea}
            formatArea={formatArea}
            selectedPolygon={selectedPolygon}
            flyToMarker={flyToMarker}
          />
        </FeatureGroup>

        {isDrawing && currentPath.length > 0 && (
          <Polygon
            positions={displayDrawingPath}
            pathOptions={{
              color: '#2196f3',
              fillOpacity: 0.2,
              dashArray: currentPath.length > 0 ? '5, 5' : null,
              weight: 2
            }}
          />
        )}
      </>
    );
  };

  useEffect(() => {
    const fg = editableFGRef.current;
    if (!fg) return;

    if (isEditingMode && editingMapPolygon) {
      fg.clearLayers();
      const leafletPolygon = L.polygon(editingMapPolygon.coordinates);
      fg.addLayer(leafletPolygon);
      if (leafletPolygon.editing) {
        leafletPolygon.editing.enable();
        if (leafletPolygon.editing._markers) {
            leafletPolygon.editing._markers.forEach(marker => marker.bringToFront());
        }
      }
    } else if (!isEditingMode && fg.getLayers().length > 0) {
        fg.eachLayer(layer => {
            if (layer.editing && layer.editing.enabled()) {
                layer.editing.disable();
            }
        });
        fg.clearLayers();
    }
  }, [isEditingMode, editingMapPolygon, editableFGRef]);

  const onEdited = useCallback((e) => {}, []);
  const onDeleted = useCallback((e) => {}, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !SENTINEL_HUB_INSTANCE_ID) return;

    if (sentinelLayer) {
      map.removeLayer(sentinelLayer);
    }

    const newSentinelLayer = L.tileLayer.wms(`https://services.sentinel-hub.com/ogc/wms/${SENTINEL_HUB_INSTANCE_ID}`, {
      layers: sentinelLayerId,
      format: 'image/png',
      transparent: true,
      maxcc: 20,
      attribution: null, // Убираем аттрибуцию Leaflet
      time: '2025-06-01/2025-06-24'
    }).addTo(map);
    setSentinelLayer(newSentinelLayer);

    return () => {
      if (map.hasLayer(newSentinelLayer)) {
        map.removeLayer(newSentinelLayer);
      }
    };
  }, [sentinelLayerId, SENTINEL_HUB_INSTANCE_ID]);


  return (
    <MapContainer
      center={[43.238949, 76.889709]}
      zoom={13}
      style={{ flexGrow: 1, height: '100vh', width: '100%' }}
      whenCreated={mapInstance => { mapRef.current = mapInstance; }}
    >
      <TileLayer
        attribution={null} // Убираем аттрибуцию Leaflet
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapContentAndInteractions
        isDrawing={isDrawing}
        currentPath={currentPath}
        setCurrentPath={setCurrentPath}
        setHoveredPoint={setHoveredPoint}
        onPolygonComplete={onPolygonComplete}
        setInfoBoxLat={setInfoBoxLat}
        setInfoBoxLng={setInfoBoxLng}
        setInfoBoxVisible={setInfoBoxVisible}
        baseApiUrl={baseApiUrl}
        setInfoBoxLoading={setInfoBoxLoading}
        setInfoBoxNdvi={setInfoBoxNdvi}
        polygons={polygons}
        editableFGRef={editableFGRef}
        selectedPolygon={selectedPolygon}
        isEditingMode={isEditingMode}
        editingMapPolygon={editingMapPolygon}
        onEdited={onEdited}
        onDeleted={onDeleted}
        calculateArea={calculateArea}
        formatArea={formatArea}
      />

      {/* Инфо-блок теперь рендерится внутри MapComponent, но позиционируется фиксировано */}
      {infoBoxVisible && (
        <div style={{
            position: 'fixed', // Фиксированное позиционирование относительно окна просмотра
            bottom: '16px',    // Отступ от низа
            left: '50%',       // По центру по горизонтали
            transform: 'translateX(-50%)', // Корректировка для точного центрирования
            zIndex: '9999999', // Очень высокий z-index, поверх всего
            pointerEvents: 'auto', // Позволяем взаимодействовать с элементами
            display: 'flex',   // Flexbox
            flexDirection: 'column', // Элементы друг под другом
            alignItems: 'center', // Центрирование содержимого
            // Отладочные стили можно временно включить для проверки
            // border: '5px solid red', 
            // backgroundColor: 'yellow',
            // width: '250px',
            // height: '180px',
            // boxSizing: 'border-box',
        }}>
                    <div
            className="flex flex-col items-center space-y-3
                      bg-white/10 rounded-2xl shadow-2xl p-4 backdrop-blur-lg border border-white/20"
            style={{ pointerEvents: 'none' }} // Отключаем события для всей панели
          >
            {/* NDVI-информация */}
            <div
              className="text-white rounded-xl p-3 flex flex-col items-center justify-center space-y-1 w-full"
            >
              <p className="text-base font-medium">
                Шир: <span className="font-semibold">{infoBoxLat}</span>, Дол: <span className="font-semibold">{infoBoxLng}</span>
              </p>
              <p className="text-base font-medium">NDVI:
                {infoBoxLoading ? (
                  <span className="loader-spin ml-2 h-4 w-4 border-2 border-t-2 border-blue-500 rounded-full inline-block"></span>
                ) : (
                  <span className="font-semibold ml-2">{infoBoxNdvi}</span>
                )}
              </p>
            </div>

            {/* Секция выбора слоев Sentinel Hub */}
            <div className="text-white rounded-xl p-3 flex flex-col items-start w-full">
              <label htmlFor="sentinel-layer-select-control" className="text-sm font-medium mb-2 w-full text-center">
                Выбрать слой Sentinel:
              </label>
              <select
                id="sentinel-layer-select-control"
                value={sentinelLayerId}
                onChange={(e) => setSentinelLayerId(e.target.value)}
                className="bg-white/20 text-white rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-300 border border-white/30 w-full hover:bg-white/30 transition-colors duration-200"
                style={{ pointerEvents: 'auto' }} // Включаем события только тут!
              >
                {sentinelLayerOptions.map(option => (
                  <option
                    key={option.id}
                    value={option.id}
                    className="bg-gray-800 text-white"
                  >
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </MapContainer>
  );
}
