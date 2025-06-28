// components/ForMap/MapComponent.jsx
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
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
  sentinelLayerId,
  setSentinelLayerId,
  baseApiUrl,
  calculateArea,
  formatArea
}) {
  const mapRef = useRef();
  const [sentinelLayer, setSentinelLayer] = useState(null);

  const [currentPath, setCurrentPath] = useState([]);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Для отладки делаем true по умолчанию, чтобы блок всегда был виден
  const [infoBoxVisible, setInfoBoxVisible] = useState(true);
  const [infoBoxLat, setInfoBoxLat] = useState(null);
  const [infoBoxLng, setInfoBoxLng] = useState(null);
  const [infoBoxNdvi, setInfoBoxNdvi] = useState('Загрузка...');
  const [infoBoxLoading, setInfoBoxLoading] = useState(false);

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
    setInfoBoxLat,
    setInfoBoxLng,
    setInfoBoxVisible,
    baseApiUrl,
    setInfoBoxLoading,
    setInfoBoxNdvi,
    polygons,
    editableFGRef,
    selectedPolygon,
    isEditingMode,
    editingMapPolygon,
    onEdited,
    onDeleted,
    calculateArea,
    formatArea
  }) => {
    const map = useMap();
    const editControlRefInternal = useRef();
    const fetchTimeout = useRef(null);

    const flyToMarker = useCallback((center, zoom) => {
      map.flyTo(center, zoom);
    }, [map]);

    useMapEvents({
      click: (e) => {
        if (!isDrawing) return;
        const newPoint = [e.latlng.lat, e.latlng.lng];
        setCurrentPath((prev) => [...prev, newPoint]);
      },
      dblclick: (e) => {
        if (!isDrawing || currentPath.length < 3) return;
        onPolygonComplete(currentPath);
        setCurrentPath([]);
        setIsDrawing(false);
        setHoveredPoint(null);
      },
      mousemove: useCallback(async (e) => {
        const { lat, lng } = e.latlng;
        setInfoBoxLat(lat.toFixed(5));
        setInfoBoxLng(lng.toFixed(5));
        // setInfoBoxVisible(true); // Теперь infoBoxVisible всегда true для отладки

        if (isDrawing && currentPath.length > 0) {
          setHoveredPoint([lat, lng]);
        }

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
            console.error('Error fetching NDVI on mousemove:', error);
            setInfoBoxNdvi(`Ошибка: ${error.message.substring(0, 20)}...`);
          } finally {
            setInfoBoxLoading(false);
          }
        }, 300);
      }, [isDrawing, currentPath, baseApiUrl, setInfoBoxNdvi]),
      mouseout: useCallback(() => {
        // setInfoBoxVisible(false); // Теперь infoBoxVisible всегда true для отладки
        setHoveredPoint(null);
        if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
      }, []),
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

  const sentinelLayerOptions = [
    { id: '1_TRUE_COLOR', name: 'True Color (Естественные цвета)' },
    { id: '2_FALSE_COLOR', name: 'False Color (Ложные цвета)' },
    { id: '3_NDVI', name: 'NDVI (Индекс растительности)' },
  ];

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

  // --- Новый компонент пользовательского элемента управления Leaflet ---
  const InfoAndSentinelControl = useMemo(() => {
    return L.Control.extend({
      onAdd: function(map) {
        // Создаем div элемент для контрола
        this._div = L.DomUtil.create('div', 'debug-info-block'); // Добавляем класс для отладки
        
        // Применяем FIXED позиционирование непосредственно к этому div
        // Это обертка для вашего React-компонента
        Object.assign(this._div.style, {
            position: 'fixed', // Фиксированное позиционирование относительно окна просмотра
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '9999999', // Очень высокий z-index, чтобы быть ПОВЕРХ ВСЕГО
            pointerEvents: 'auto', // Позволяем взаимодействовать с элементами
            display: 'flex', // Для flexbox внутри
            flexDirection: 'column', // Элементы друг под другом
            alignItems: 'center', // Центрирование содержимого

            // --- DEBUG СТИЛИ ---
            width: '250px', // Задаем фиксированную ширину
            height: '180px', // Задаем фиксированную высоту
            border: '5px solid red', // Яркая красная рамка
            backgroundColor: 'yellow', // Ярко-желтый фон
            padding: '20px', // Увеличенный отступ
            boxSizing: 'border-box', // Учитываем padding и border в width/height
            // --- КОНЕЦ DEBUG СТИЛЕЙ ---
        });

        this._root = ReactDOM.createRoot(this._div);
        this.update();

        L.DomEvent.disableClickPropagation(this._div);
        L.DomEvent.disableScrollPropagation(this._div);
        
        return this._div;
      },
      onRemove: function(map) {
        if (this._root) {
          this._root.unmount();
        }
      },
      update: function() {
        if (this._root) {
          this._root.render(
            // Здесь ваш React-компонент, без инлайн-стилей позиционирования,
            // так как они теперь на родительском div._div
            <div className="flex flex-col items-center space-y-3
                            bg-white/10 rounded-2xl shadow-2xl p-4 backdrop-blur-lg border border-white/20">
              {infoBoxVisible && (
                <div
                  className="text-white rounded-xl p-3 flex flex-col items-center justify-center space-y-1 w-full"
                  style={{ pointerEvents: 'none' }}
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
              )}

              <div className="text-white rounded-xl p-3 flex flex-col items-start w-full">
                <label htmlFor="sentinel-layer-select-control" className="text-sm font-medium mb-2 w-full text-center" >Выбрать слой Sentinel:</label>
                <select
                  id="sentinel-layer-select-control"
                  value={sentinelLayerId}
                  onChange={(e) => setSentinelLayerId(e.target.value)}
                  className="bg-white/20 text-white rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-300 border border-white/30 w-full hover:bg-white/30 transition-colors duration-200"
                >
                  {sentinelLayerOptions.map(option => (
                    <option key={option.id} value={option.id} className="bg-gray-800 text-white">
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        }
      }
    });
  }, [infoBoxVisible, infoBoxLat, infoBoxLng, infoBoxNdvi, infoBoxLoading, sentinelLayerId, setSentinelLayerId, sentinelLayerOptions]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.__customInfoControl) {
      map.__customInfoControl = new InfoAndSentinelControl({ position: 'bottomleft' }); 
      map.addControl(map.__customInfoControl);
    }
    
    map.__customInfoControl.update();

    return () => {
      if (map.__customInfoControl && map.hasControl(map.__customInfoControl)) {
          map.removeControl(map.__customInfoControl);
          delete map.__customInfoControl;
      }
    };
  }, [InfoAndSentinelControl, infoBoxVisible, infoBoxLat, infoBoxLng, infoBoxNdvi, infoBoxLoading, sentinelLayerId]);


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
    </MapContainer>
  );
}
