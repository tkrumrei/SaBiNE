// SPDX-FileCopyrightText: 2023 Open Pioneer project (https://github.com/open-pioneer)
// SPDX-License-Identifier: Apache-2.0
import OLText from 'ol/style/Text';
import {
    Box,
    Button,
    Flex,
    Input,
    Slider,
    SliderFilledTrack,
    SliderThumb,
    SliderTrack,
    Switch,
    Text
} from "@open-pioneer/chakra-integration";
import {MapAnchor, MapContainer, useMapModel} from "@open-pioneer/map";
import {ScaleBar} from "@open-pioneer/scale-bar";
import {InitialExtent, ZoomIn, ZoomOut} from "@open-pioneer/map-navigation";
import {useIntl} from "open-pioneer:react-hooks";
import {CoordinateViewer} from "@open-pioneer/coordinate-viewer";
import {SectionHeading, TitledSection} from "@open-pioneer/react-utils";
import {ToolButton} from "@open-pioneer/map-ui-components";
import {ScaleViewer} from "@open-pioneer/scale-viewer";
import {MAP_ID} from "./services";
import React, {useEffect, useId, useState} from "react";
import {Measurement} from "@open-pioneer/measurement";
import {PiRulerLight} from "react-icons/pi";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector.js";
import GeoJSON from 'ol/format/GeoJSON';
import Style from 'ol/style/Style';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import CircleStyle from 'ol/style/Circle';
import {transform} from 'ol/proj';
import {Image} from "@chakra-ui/react";
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import Select from "react-select";
import {Point} from "ol/geom";
import {createEmpty, extend} from 'ol/extent';


export function MapApp() {

    const intl = useIntl();
    const measurementTitleId = useId();

    const [measurementIsActive, setMeasurementIsActive] = useState<boolean>(false);
    const [startAddress, setStartAddress] = useState<string>('');
    const [startId, setStartId] = useState<string>('');
    const [startCoordinates, setStartCoordinates] = useState<number[]>([]);
    const [destinationAddress, setDestinationAddress] = useState<string>('');
    const [endId, setEndId] = useState<string>('');
    const [endCoordinates, setEndCoordinates] = useState<number[]>([]);
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [coordinatesMap, setCoordinatesMap] = useState({});
    const [filteredDestinations, setFilteredDestinations] = useState([]);
    const [addressToAreaMapping, setAddressToAreaMapping] = useState({});
    const [sliderValue, setSliderValue] = useState<number>(1);
    const [safetyRating, setSafetyRating] = useState<string>('');
    const [timeEfficiencyRating, setTimeEfficiencyRating] = useState<string>('');
    const [nearestNodeMapping, setNearestNodeMapping] = useState({});
    const [isSwitchEnabled, setIsSwitchEnabled] = useState(false);
    const [isSwitchChecked, setIsSwitchChecked] = useState(false);
    const [mapGraph, setMapGraph] = useState<Map<string, any>>(new Map());


    const sliderLabels = ["Safest", "Balanced", "Fastest"];

    const resetInputs = () => {
        setStartId("");
        setStartAddress("");
        setStartCoordinates([]);
        setEndId("");
        setDestinationAddress("");
        setEndCoordinates([]);
        setSliderValue(0);
        if (isSwitchEnabled) {
            // Wenn deaktiviert, Switch zurücksetzen
            setIsSwitchChecked(false);
        }
        setIsSwitchEnabled((prev) => !prev);

        if (map?.olMap) {
            const layers = map.olMap.getLayers().getArray();

            // Entferne alle Marker
            const markerLayer = layers.find(layer => layer.get('id') === "markerLayer");
            if (markerLayer) {
                const source = markerLayer.getSource();
                source.clear(); // Entfernt alle Features aus dem Marker-Layer
            }

            // Entferne alle Linien
            const routeLayer = layers.find(layer => layer.get('id') === "addressToRouteLayer");
            if (routeLayer) {
                const source = routeLayer.getSource();
                source.clear(); // Entfernt alle Features aus dem Linien-Layer
            }
            
            // Entferne route
            const targetLayer = layers.find(layer => layer.get('id') === "routeLayer");
            if (targetLayer) {
                const source = targetLayer.getSource();
                source.clear();
            }
        }
        
    };

    function toggleMeasurement() {
        setMeasurementIsActive(!measurementIsActive);
    };


    const {map} = useMapModel(MAP_ID);

    useEffect(() => {
        // Set Defaultvalue Scalebar to Safe
        const initializeDefaults = () => {
            setSliderValue(0); // Setzt den Slider auf den mittleren Wert
        };

        initializeDefaults();

        if (map?.layers) {
            // Setze maximalen Zoom
            map.olMap.getView().setMaxZoom(19);

            const routeVectorLayer = new VectorLayer({
                source: new VectorSource(),
                style: (feature) => {
                    return isSwitchChecked ? styleByCategory(feature) : styleDefaultBlue(feature);
                },
            });
            routeVectorLayer.set('id', 'routeLayer');
            map.olMap.addLayer(routeVectorLayer);


            // Add planned Areas Layer
            const plannedAreasVectorSource = new VectorSource({
                url: './data/plannedAreas.geojson', // Pfad zu deinem GeoJSON
                format: new GeoJSON({
                    dataProjection: 'EPSG:3857',
                    featureProjection: 'EPSG:3857'
                })
            });

            // Layer für GeoJSON
            const plannedAreasLayer = new VectorLayer({
                source: plannedAreasVectorSource,
                style: new Style({
                    fill: new Fill({
                        color: 'rgba(55, 67, 61, 0.4)'
                    }),
                    image: new CircleStyle({
                        radius: 6,
                        fill: new Fill({
                            color: '#ffcc33'
                        })
                    })
                }),
                visible: true
            });

            // GeoJSON-Layer zur Karte hinzufügen
            map.olMap.addLayer(plannedAreasLayer);

            // Add address Layer
            const addressVectorSource = new VectorSource({
                url: './data/matching_hsnr_features_with_address.geojson',
                format: new GeoJSON({
                    dataProjection: 'EPSG:3857',
                    featureProjection: 'EPSG:3857'
                })
            });

            // Layer für GeoJSON
            const addressLayer = new VectorLayer({
                source: addressVectorSource,
                style: new Style({
                    image: new CircleStyle({
                        radius: 1,
                        fill: new Fill({
                            color: 'rgba(255, 255, 255, 0.6)'
                        })
                    })
                }),
                visible: false
            });

            // GeoJSON-Layer zur Karte hinzufügen
            map.olMap.addLayer(addressLayer);
            

            // Add Street data layer
            const vectorSource2 = new VectorSource({
                url: './data/exportedGeojsonRouting (2).geojson',
                format: new GeoJSON({
                    dataProjection: 'EPSG:3857',
                    featureProjection: 'EPSG:3857'
                })
            });

            const streetDataLayer = new VectorLayer({
                source: vectorSource2,
                style: styleByCategory,
                visible: false
            });
            streetDataLayer.set('id', 'streetDataLayer');

            map.olMap.addLayer(streetDataLayer);

            /*
            Dieser Code wird benötigt um category hinzuzufügen. wird in der fertigen applikation aber nicht benötigt.
            */
            /*
             // Sobald die Daten ready sind ...
             vectorSource2.once('change', function () {
       
       
               if (vectorSource2.getState() === 'ready') {
                 const features = vectorSource2.getFeatures();
                 console.log(features)
       
                 const relevantProps = [
                   'bicycle',
                   'cycleway',
                   'cycleway_left',
                   'cycleway_right',
                   'bicycle_road',
                   'cycleway_right_bicycle',
                   'cycleway_left_bicycle'
                 ];
       
                 // Kategorien
                 const withoutCycleHighwayGroup = [];
                 const withoutCycleOther = [];
                 const cyclePropsYesDesignated = [];
                 const cyclePropsOther = [];
       
                 features.forEach((feature) => {
                   const properties = feature.getProperties();
                   console.log(properties)
       
                   // Prüfen, ob eine relevante Rad-Property vorhanden ist
                   const hasCycleProp = relevantProps.some((prop) => {
                     return properties[prop] != null && properties[prop] !== '';
                   });
       
                   if (!hasCycleProp) {
                     // Keine Radinfrastruktur, weiter unterteilen nach highway-Werten
                     const highway = properties.highway;
                     if (
                       highway === 'residential' ||
                       highway === 'living_street' ||
                       highway === 'bridleway' ||
                       highway === 'track'
                     ) {
                       feature.set('category_number', 2);
                       withoutCycleHighwayGroup.push(feature);
                     } else {
                       feature.set('category_number', 1);
                       withoutCycleOther.push(feature);
                     }
                   } else {
                     // Hat Radinfrastruktur, nun verfeinern:
                     const bicycleValue = properties.bicycle;
                     const bicycleRoadValue = properties.bicycle_road;
       
                     const isYesOrDesignated =
                       bicycleValue === 'yes' ||
                       bicycleValue === 'designated' ||
                       bicycleRoadValue === 'yes' ||
                       bicycleRoadValue === 'designated';
       
                     if (isYesOrDesignated) {
                       feature.set('category_number', 4);
                       cyclePropsYesDesignated.push(feature);
                     } else {
                       feature.set('category_number', 3);
                       cyclePropsOther.push(feature);
                     }
                   }
       
                   // Style anwenden
                   streetDataLayer.setStyle(styleByCategory);
                 });
       
                 const geoJSONFormat = new GeoJSON();
       
                 // Features als GeoJSON exportieren
                 const geojsonStr = geoJSONFormat.writeFeatures(features);
                 const blob = new Blob([geojsonStr], { type: 'application/json' });
       
                 // URL für den Blob erstellen
                 const url = URL.createObjectURL(blob);
       
                 // Temporären Link erstellen
                 const link = document.createElement('a');
                 link.href = url;
                 link.download = 'exportedGeojsonRouting.geojson';
       
                 // Link zum Dokument hinzufügen und Klick simulieren
                 document.body.appendChild(link);
                 link.click();
       
                 // Link wieder entfernen
                 document.body.removeChild(link);
       
                 // URL freigeben
                 URL.revokeObjectURL(url);
               }
             });
             */
        } else {
            return;
        }
    }, [map]);

    useEffect(() => {
        if (map?.olMap) {
            const layers = map.olMap.getLayers().getArray();
            const routeLayer = layers.find(layer => layer.get('id') === "routeLayer");
            if (routeLayer) {
                routeLayer.setStyle((feature) => {
                    return isSwitchChecked ? styleByCategory(feature) : styleDefaultBlue(feature);
                });
               
            }
        }
    }, [isSwitchChecked, map]);

    useEffect(() => {
        // Fetch addresses and their planned_area_id from the CSV file
        fillAdressInput();


    }, []);

    useEffect(() => {
        // Filter destination addresses based on the area of the selected start address
        if (startAddress) {
            const selectedAreaId = addressToAreaMapping[startAddress];
            const filtered = Object.keys(addressToAreaMapping).filter(
                (address) => addressToAreaMapping[address] === selectedAreaId
            );
            setFilteredDestinations(filtered);
        } else {
            setFilteredDestinations([]);
        }
    }, [startAddress, addressToAreaMapping]);

    function fillAdressInput() {
        fetch("./data/Matched_Addresses_in_Planned_Areas.csv")
            .then((response) => response.text())
            .then((data) => {
                const rows = data.split("\n").slice(1); // Header überspringen
                const mapping = {};
                const nearestNodeMap = {};
                const coordinatesMap = {};
                const addresses = [];

                rows.forEach((row) => {
                    const [address, plannedAreaId, nearest_node, coordinates] = row.split(";");

                    if (address && plannedAreaId) {
                        const trimmedAddress = address.trim();

                        // Mapping der Daten
                        mapping[trimmedAddress] = plannedAreaId.trim();

                        if (nearest_node) {
                            nearestNodeMap[trimmedAddress] = nearest_node.trim();
                        }

                        if (coordinates) {
                            coordinatesMap[trimmedAddress] = coordinates.trim();
                        }

                        addresses.push(trimmedAddress);
                    }
                });

                // Setze State-Werte
                setAddressToAreaMapping(mapping);
                setNearestNodeMapping(nearestNodeMap);
                setAddressSuggestions(addresses);
                setCoordinatesMap(coordinatesMap); // Speichere die Koordinaten für spätere Verwendung
                
                
            })
            .catch((error) => console.error("Error loading CSV data:", error));
    }



    function 
    getWeightVector(sliderValue: number) {
        switch(sliderValue){
            case 0: 
                return [1.5, 2, 2.5];
            case 1:
                return [1.2, 1.5, 2];
            case 2:
                return [1, 1, 1];
        }
    }

    function zoomToFeatures() {
        const layers = map.olMap.getLayers().getArray();
        const targetLayer = layers.find(layer => layer.get('id') === "routeLayer");
        if (targetLayer) {
            // Hole die Quelle der Layer
            const source = targetLayer.getSource();
            const allFeatures = source.getFeatures();

            // Filtere Features, die das Attribut 'route' mit dem Wert true haben
            const routeFeatures = allFeatures.filter(feature => feature.get('route') === 'true');

            if (routeFeatures.length > 0) {
                // Erstelle eine Bounding-Box aus den gefilterten Features
                const extent = createEmpty();
                routeFeatures.forEach(feature => {
                    extend(extent, feature.getGeometry().getExtent());
                });

                // Passe die Karte an die Bounding-Box an
                map.olMap.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
                console.log(`Gefittet auf ${routeFeatures.length} Features mit 'route = true'.`);
            } else {
                console.log('Keine Features mit dem Attribut "route = true" gefunden.');
            }
        } else {
            console.log('Layer mit der ID "routeLayer" nicht gefunden.');
        }
        
    }

    function calculateRoute() {
        setIsSwitchEnabled(true);
        // Berechne den Abstand zwischen startId und endId
        let distance = calculateDistance(startId, endId);
        console.log(`Distance between startId and endId: ${distance} meters`);
        // Distance für abort berechnen
        distance = distance * 2;
        console.log('Abort Distance: ', distance)
        
        
        const weightVector = getWeightVector(sliderValue);
        

        fetch('./data/graph (40).json')
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Fehler beim Laden der Datei");
                }
                return response.json();
            })
            .then((graphObject) => {
                

                const calculatedGraph = new Map(Object.entries(graphObject)); // JSON in Map umwandeln
                setMapGraph(calculatedGraph)
                console.log("Graph erfolgreich geladen:", calculatedGraph);

                // Nutze den geladenen Graph

                const paretoFront = new Map();

                // Initialisiere Startknoten mit Vektor [0,0,...,0]
                paretoFront.set(startId, [
                    {
                        costVector: new Array(5).fill(0),
                        predecessor: null
                    }
                ]);

                // Warteschlange für Knoten mit offenen Zuständen
                const queue = [];
                queue.push({node: startId, costVector: paretoFront.get(startId)[0].costVector});

                // Hauptschleife
                while (queue.length > 0) {
                    const current = queue.shift();
                    const { node: currentNode, costVector: currentCostVec } = current;

                    // Ignoriere den Pfad, wenn er die maximale Distanz überschreitet
                    if (currentCostVec[4] > distance) {
                        continue; // Überspringe diesen Pfad
                    }

                    // Betrachte alle Nachbarn von currentNode
                    const edges = calculatedGraph.get(currentNode) || [];
                    edges.forEach((edge) => {
                        const nextNode = edge.node;

                        // Berechne neuen Kostenvektor für nextNode
                        const edgeCostVec = getUnweightedCostVector(edge.length, edge.category, weightVector);
                        const newCostVec = vectorAdd(currentCostVec, edgeCostVec);

                        // Falls keine Pareto-Front für nextNode existiert, initialisiere sie
                        if (!paretoFront.has(nextNode)) {
                            paretoFront.set(nextNode, []);
                        }
                        const currentPareto = paretoFront.get(nextNode);

                        // Prüfe Pareto-Dominanz
                        let dominatedByExisting = false;
                        let dominatingIndices = [];

                        for (let i = 0; i < currentPareto.length; i++) {
                            const existingVec = currentPareto[i].costVector;
                            if (dominates(existingVec, newCostVec)) {
                                dominatedByExisting = true;
                                break;
                            }
                            if (dominates(newCostVec, existingVec)) {
                                dominatingIndices.push(i);
                            }
                        }

                        if (!dominatedByExisting) {
                            // Lösche alte Vektoren, die von newCostVec dominiert werden
                            for (let i = dominatingIndices.length - 1; i >= 0; i--) {
                                currentPareto.splice(dominatingIndices[i], 1);
                            }

                            // Füge newCostVec zur Pareto-Front hinzu
                            currentPareto.push({
                                costVector: newCostVec,
                                predecessor: currentNode,
                            });

                            // Füge nextNode zur Warteschlange hinzu
                            queue.push({ node: nextNode, costVector: newCostVec });
                        }
                    });
                }

                // Nach der Schleife: Wähle den besten Weg aus der Pareto-Front des Zielknotens
                if (!paretoFront.has(endId)) {
                    console.error("Kein gültiger Pfad zum Zielknoten gefunden.");
                } else {
                    const endPareto = paretoFront.get(endId);

                    // Suche den Kostenvektor mit dem kleinsten costVector[0]
                    const bestPath = endPareto.reduce((best, entry) => {
                        return entry.costVector[0] < best.costVector[0] ? entry : best;
                    }, endPareto[0]);

                    console.log("Bester Pfad mit minimalem costVector[0]:", bestPath);

                    // Rekonstruiere und visualisiere den besten Pfad
                    const pathNodes = reconstructPath(paretoFront, startId, endId, calculatedGraph);
                    highlightPath([pathNodes.find((path) => path.costVector === bestPath.costVector)], calculatedGraph);
                    zoomToFeatures();
                }


                // Rückgabe: Die Pareto-Front aller Knoten
                //mit paretoFront.get(endId) kriegt man das ergebnis für den zielknoten
                //console.log(paretoFront.get(endId))
            })
            .catch((error) => console.error("Fehler:", error));
        // Pareto-Front: Map<Knoten, [ { costVector: number[], predecessor: string } ] >

    }


    // Hilfsfunktion für die Routenberechnung: Für jede Kante wird der Kostenvektor berechnet 
    // ! ACHTUNG ! Bisher ist hier noch keine Gewichtung vorhanden 
    function getUnweightedCostVector(length, category, weights) {
        const costVector = new Array(5).fill(0);
        costVector[4] = length;
        switch (category) {
            case 1: // Rot
                costVector[3] = length;
                costVector[2] = costVector[3] * weights[2];
                costVector[1] = costVector[2] * weights[1];
                costVector[0] = costVector[1] * weights[0];
                break;
            case 2: // Orange
                costVector[2] = length;
                costVector[1] = costVector[2] * weights[1];
                costVector[0] = costVector[1] * weights[0];
                break;
            case 3: // Hellgrün
                costVector[1] = length;
                costVector[0] = costVector[1] * weights[0];
                break;
            case 4: // Grün
                costVector[0] = length;
                break;
            default:
                break;
        }
        return costVector;
    }


    // Hilfsfunktion die determiniert, ob ein Kostenvektor einen anderen dominiert.
    function dominates(vecA, vecB) {
        let strictlyBetter = false;

        for (let i = 0; i < vecA.length; i++) {
            if (vecA[i] > vecB[i]) {
                return false;
            }
            if (vecA[i] < vecB[i]) {
                strictlyBetter = true;
            }
        }

        return strictlyBetter;
    }

    function vectorAdd(vecA, vecB) {
        return vecA.map((val, idx) => val + vecB[idx]);
    }


    function buildGraphFromGeoJSON(geojson) {
        const graph = new Map();

        geojson.features.forEach((feature) => {
            const geometry = feature.geometry;
            const properties = feature.properties;

            if (geometry.type === "LineString") {
                const coordinates = geometry.coordinates;
                const length = properties.length;
                const category = properties.category_number;

                // Gehe alle Segmente im LineString durch
                for (let i = 0; i < coordinates.length - 1; i++) {
                    const fromCoord = coordToId(coordinates[i]); // Startpunkt
                    const toCoord = coordToId(coordinates[i + 1]); // Endpunkt

                    // Kante vom Startpunkt zum Endpunkt hinzufügen
                    if (!graph.has(fromCoord)) {
                        graph.set(fromCoord, []);
                    }
                    graph.get(fromCoord).push({node: toCoord, length, category});

                    // Kante vom Endpunkt zurück zum Startpunkt hinzufügen (bidirektional)
                    if (!graph.has(toCoord)) {
                        graph.set(toCoord, []);
                    }
                    graph.get(toCoord).push({node: fromCoord, length, category});
                }
            }
        });

        return graph;
    }

    // Helper: Konvertiert Koordinaten in Strings
    function coordToId(coord) {
        return coord.join(",");
    }

    // Helper-Funktion: Konvertiert Koordinatenpaar in einen String (z. B. "13.4050,52.5200")
    function coordToId(coord) {
        return coord.join(",");
    }


    /* 
    Dieser Code wird benötigt um den Graphen zu erstellen. IN der normalen Applikation jedoch nicht notwendig, weil dieser dann schon erstellt wurde
    fetch('./data/exportedGeojsonRouting (2).geojson') // Relativer Pfad zur Datei
      .then((response) => {
        if (!response.ok) {
          throw new Error('Fehler beim Laden der GeoJSON-Datei');
        }
        return response.json();
      })
      .then((geojsonData) => {
  
        
        // Hier kannst du mit den GeoJSON-Daten arbeiten
        const graph = buildGraphFromGeoJSON(geojsonData);
       
        const graphObject = Object.fromEntries(graph); // Konvertiere Map in ein einfaches Objekt
        
  
        
        const graphJSON = JSON.stringify(graphObject, null, 2); // Formatiere als JSON
       
  
        // JSON-Datei erstellen und Download auslösen
        
        const blob = new Blob([graphJSON], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'graph.json';
        link.click();
    
        // Graph-Statistik ausgeben
        
        let edgeCount = 0;
        graph.forEach((edges) => {
          edgeCount += edges.length;
        });
          
  
      })
      
      */


    // Hier fehlt noch eine Funktion mit der wir den pareto pfad zurückverfolgen können um die routen zu finden.

    function reconstructPath(paretoFront, startId, endId, graph) {
        const results = [];
        const endPareto = paretoFront.get(endId);

        if (!endPareto) {
            console.error("Kein Pfad zum Zielknoten gefunden.");
            return results;
        }

        // Für jeden nicht-dominierten Zustand am Zielknoten den Pfad rekonstruieren
        endPareto.forEach((entry) => {
            const path = [];
            let currentEntry = entry;
            let currentNode = endId;

            // Rückwärts den Pfad entlanggehen
            while (currentEntry) {
                path.push(currentNode); // Füge aktuellen Knoten zum Pfad hinzu
                currentNode = currentEntry.predecessor; // Gehe zum Vorgängerknoten

                if (!currentNode) break; // Wenn kein Vorgänger mehr existiert, sind wir am Start

                const predecessorPareto = paretoFront.get(currentNode);
                if (!predecessorPareto) {
                    console.error("Kein Pareto-Eintrag für den Vorgängerknoten gefunden:", currentNode);
                    break;
                }

                currentEntry = predecessorPareto.find((e) =>
                    arraysEqual(
                        vectorAdd(e.costVector, getEdgeCost(currentNode, path[path.length - 1], graph)),
                        currentEntry.costVector
                    )
                );
            }

            // Pfad umkehren, da er rückwärts aufgebaut wurde
            results.push({
                path: path.reverse(),
                costVector: entry.costVector,
            });
        });

        console.log(results)
        return results;
    }

    function arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        return arr1.every((val, idx) => val === arr2[idx]);
    }


    // Hilfsfunktion: Kostenvektor für eine Kante berechnen
    function getEdgeCost(fromNode, toNode, graph) {
        const edges = graph.get(fromNode) || [];
        const edge = edges.find((e) => e.node === toNode);
        return edge ? getUnweightedCostVector(edge.length, edge.category, getWeightVector(sliderValue)) : null;
    }

    function highlightPath(paths, graph: Map<string, any>) {
        // 1) Route-Layer und Source ermitteln
        const layers = map.olMap.getLayers().getArray();
        const targetLayer = layers.find(layer => layer.get('id') === "routeLayer");

        if (!targetLayer) {
            console.error(`Layer mit ID "routeLayer" nicht gefunden.`);
            return;
        }

        const source = targetLayer.getSource();
        // Alle alten Routen-Features entfernen
        source.clear();

        // 2) Für jeden Pfad in paths
        paths.forEach((singlePath) => {
            // singlePath.path = Array der Knoten (z.B. ["13.41,52.52", "13.42,52.53", ...])
            const routeSegments = []; // Array zum Sammeln der Segment-Features

            for (let i = 0; i < singlePath.path.length - 1; i++) {
                const fromNode = singlePath.path[i];
                const toNode = singlePath.path[i + 1];

                // Suche die Edge im Graph
                const edges = graph.get(fromNode); // <-- Dein Graph in einer Variable "mapGraph"
                if (!edges) continue;

                // Gesuchte Kante
                const edge = edges.find(e => e.node === toNode);
                if (!edge) continue;

                // Kategorie aus der Kante holen
                const cat = edge.category; // 1, 2, 3, 4 ...

                // Koordinaten als [lon, lat] aus fromNode und toNode
                const fromCoord = fromNode.split(',').map(Number);
                const toCoord = toNode.split(',').map(Number);

                // OpenLayers-LineString erstellen
                const lineSegment = new LineString([fromCoord, toCoord]);

                // Neues Feature für das Segment
                const segmentFeature = new Feature({
                    geometry: lineSegment,
                });
                // category_number setzen, damit styleByCategory() die Farbe wählen kann
                segmentFeature.set('category_number', cat);
                // Optional: Markiere dieses Feature als Teil der Route
                segmentFeature.set('route', 'true');

                routeSegments.push(segmentFeature);
            }

            // 3) Features in die Source des Route-Layers hinzufügen
            source.addFeatures(routeSegments);

            
            // Sicherheits- und Zeitbewertung ausgeben
            const estimatedTime = calculateEstimatedTime(paths[0].costVector[4]);
            setTimeEfficiencyRating(`${(paths[0].costVector[4] / 1000).toFixed(2)} km (~${estimatedTime} min)`);


            setSafetyRating(`Safety Rating: ${calculateSafetyScore(paths[0].costVector).toFixed(1)}`);
        });
    }

    function styleDefaultBlue() {
        return new Style({
            stroke: new Stroke({
                color: 'rgba(0, 0, 255, 0.8)', // Einheitliche blaue Farbe
                width: 5,
            }),
        });
    }
    function styleByCategory(feature) {
        const category = feature.get('category_number');
        let color;

        switch (category) {
            case 4:
                color = 'blue';
                break;
            case 3:
                color = 'rgba(34, 192, 13, 0.8)';
                break;
            case 2:
                color = 'yellow';
                break;
            case 1:
                color = 'red';
                break;
            default:
                color = 'gray';
        }

        return new Style({
            stroke: new Stroke({
                color: color,
                width: 5,
            }),
        });
    }


    function calculateDistance(startId: string, endId: string): number {
        const [startLon, startLat] = transform([parseFloat(startId.split(',')[0]), parseFloat(startId.split(',')[1])], 'EPSG:3857', 'EPSG:4326');
        const [endLon, endLat] = transform([parseFloat(endId.split(',')[0]), parseFloat(endId.split(',')[1])], 'EPSG:3857', 'EPSG:4326');

        const R = 6371e3; // Earth's radius in meters
        const φ1 = startLat * Math.PI / 180; // φ, λ in radians
        const φ2 = endLat * Math.PI / 180;
        const Δφ = (endLat - startLat) * Math.PI / 180;
        const Δλ = (endLon - startLon) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = R * c; // in meters
        return distance;
    }

    function calculateEstimatedTime(distanceInMeters) {
        const distanceInKm = distanceInMeters / 1000; // Distanz in Kilometer
        const averageSpeedKmH = 15; // Durchschnittliche Geschwindigkeit in km/h
        const timeInHours = distanceInKm / averageSpeedKmH; // Zeit in Stunden
        const timeInMinutes = timeInHours * 60; // Zeit in Minuten
        return Math.round(timeInMinutes); // Auf ganze Minuten runden
    }


    function calculateSafetyScore(costVector: number[]) {
        const weights: number[] = getWeightVector(0);
        let calculatedDistance: number;
        let safetyScore: number = 0.0;
        switch (sliderValue) {
            case 0: // safest
                calculatedDistance = calcBackWeights(costVector, weights, sliderValue);
                safetyScore = calculatedDistance / costVector[4];
                break;
            case 1: // balanced
                calculatedDistance = calcBackWeights(costVector, weights, sliderValue);
                safetyScore = calculatedDistance / costVector[4];
                break;
            case 2: // fastest
                calculatedDistance = calcBackWeights(costVector, weights, sliderValue);
                safetyScore = calculatedDistance / costVector[4];
                break;
        }
        // zwsichen 1.0 bis 6.0 normalisieren
        safetyScore = 1.0 + ((safetyScore - 1.0) / (7.5 - 1.0)) * (6.0 - 1.0);

        return safetyScore;
    }
    
    function calcBackWeights(costVector: number[], weights: number[], sliderValue: number) {
        const weightVector = getWeightVector(sliderValue);
        let cat1 = costVector[3];
        let cat2 = costVector[2] - (cat1 * weightVector[2]);
        let cat3 = costVector[1] - ((cat2 * weightVector[1]) + (cat1 * weightVector[2] * weightVector[1]));
        let cat4 = costVector[0] - ((cat3 * weightVector[0]) + (cat2 * weightVector[1] * weightVector[0]) + (cat1 * weightVector[2] * weightVector[1] * weightVector[0]));
        return (cat1 * weights[0] * weights[1] * weights[2]) + (cat2 * weights[1] * weights[2]) + (cat3 * weights[2]) + cat4;
        
    }


    function updateMarkers() {
        if (!map) return;

        // Identifiziere oder erstelle den Marker-Layer
        const layers = map.olMap.getLayers().getArray();
        let markerLayer = layers.find(layer => layer.get('id') === "markerLayer");

        if (!markerLayer) {
            markerLayer = new VectorLayer({
                source: new VectorSource(),
                style: null, // Marker-Stile werden individuell gesetzt
            });
            markerLayer.set('id', 'markerLayer');
            map.olMap.addLayer(markerLayer);
        }

        const source = markerLayer.getSource();

        // Entferne Marker, falls keine Startkoordinaten gesetzt sind
        if (startCoordinates.length === 0) {
            const startFeature = source.getFeatures().find(f => f.get('type') === 'start');
            if (startFeature) source.removeFeature(startFeature);
        } else {
            // Füge oder aktualisiere den Start-Marker
            let startFeature = source.getFeatures().find(f => f.get('type') === 'start');
            if (!startFeature) {
                startFeature = new Feature({ geometry: new Point(startCoordinates)});
                startFeature.set('type', 'start'); // Marker-Typ setzen
                source.addFeature(startFeature);
            } else {
                startFeature.setGeometry(new Point(startCoordinates));
            }
            startFeature.setStyle(new Style({
                image: new CircleStyle({
                    radius: 6,
                    fill: new Fill({ color: 'black' }),
                }),
                text: new OLText({
                    text: "Start",
                    font: '12px Calibri,sans-serif',
                    fill: new Fill({ color: 'black' }),
                    stroke: new Stroke({ color: 'white', width: 3 }),
                    offsetY: -15, // Text oberhalb des Markers
                }),
            }));
        }

        // Entferne Marker, falls keine Endkoordinaten gesetzt sind
        if (endCoordinates.length === 0) {
            const endFeature = source.getFeatures().find(f => f.get('type') === 'end');
            if (endFeature) source.removeFeature(endFeature);
        } else {
            // Füge oder aktualisiere den End-Marker
            let endFeature = source.getFeatures().find(f => f.get('type') === 'end');
            if (!endFeature) {
                endFeature = new Feature({ geometry: new Point(endCoordinates)});
                endFeature.set('type', 'end'); // Marker-Typ setzen
                source.addFeature(endFeature);
            } else {
                endFeature.setGeometry(new Point(endCoordinates));
            }
            endFeature.setStyle(new Style({
                image: new CircleStyle({
                    radius: 6,
                    fill: new Fill({ color: 'black' }),
                }),
                text: new OLText({
                    text: "End",
                    font: '12px Calibri,sans-serif',
                    fill: new Fill({ color: 'black' }),
                    stroke: new Stroke({ color: 'white', width: 3 }),
                    offsetY: -15, // Text oberhalb des Markers
                }),
            }));
        }
    }

    useEffect(() => {
        updateMarkers();
    }, [startCoordinates, endCoordinates]);
    
    return (
        <Flex height="100%" direction="column" overflow="hidden" width="100%">
            <Flex
                backgroundColor="white"
                borderWidth="1px"
                borderRadius="md"
                boxShadow="sm"
                padding={4}
                margin={4}
                maxWidth="2000px"
                justifyContent="space-between"
                alignItems="flex-start"
            >
                <Box marginBottom="20px">
                    <Text fontSize="lg" fontWeight="bold" marginBottom="10px">
                        Enter Start and Destination Address
                    </Text>
                    <Select
                        value={
                            startId
                                ? { value: startId, label: startAddress }
                                : null
                        }
                        options={addressSuggestions.map((address) => ({
                            value: nearestNodeMapping[address],
                            label: address,
                        }))}
                        onChange={(selectedOption) => {
                            setStartId(selectedOption ? selectedOption.value : "");
                            setStartAddress(selectedOption ? selectedOption.label : "");

                            if (selectedOption && coordinatesMap[selectedOption.label]) {
                                const coords = coordinatesMap[selectedOption.label].split(",").map(Number);
                                setStartCoordinates(coords);
                            } else {
                                setStartCoordinates([]); // Entfernt den Marker
                            }
                        }}
                        placeholder="Please enter your starting address"
                        isClearable
                        styles={{
                            container: (provided) => ({
                                ...provided,
                                marginBottom: "16px",
                            }),
                        }}
                    />

                    <Select
                        value={
                            endId
                                ? { value: endId, label: destinationAddress }
                                : null
                        }
                        options={filteredDestinations.map((address) => ({
                            value: nearestNodeMapping[address],
                            label: address,
                        }))}
                        onChange={(selectedOption) => {
                            setEndId(selectedOption ? selectedOption.value : "");
                            setDestinationAddress(selectedOption ? selectedOption.label : "");

                            if (selectedOption && coordinatesMap[selectedOption.label]) {
                                const coords = coordinatesMap[selectedOption.label].split(",").map(Number);
                                setEndCoordinates(coords);
                            } else {
                                setEndCoordinates([]); // Entfernt den Marker
                            }
                        }}
                        placeholder="Please enter your destination address"
                        isClearable
                        isDisabled={!startAddress}
                        styles={{
                            container: (provided) => ({
                                ...provided,
                                marginBottom: "16px",
                            }),
                        }}
                    />
                </Box>

                {/* Slider and Buttons */}
                <Flex ml={8} direction="row" alignItems="flex-start" maxWidth="400px">
                    <Box mr={4}>
                        <Text fontSize="lg" fontWeight="bold" mb={2}>
                            Route Preference
                        </Text>
                        <Flex justifyContent="space-between" alignItems="center" mb={2}>
                            <Text fontSize="2xl" role="img" aria-label="helmet-icons">
                                <Image
                                    src="./data/Helmet.png"
                                    alt="Safety Icon"
                                    boxSize="25px"
                                    display="inline"
                                />
                            </Text>
                            <Text fontSize="2xl" role="img" aria-label="rocket-icons">
                                <Image
                                    src="./data/Rocket.png"
                                    alt="Fast Icon"
                                    boxSize="25px"
                                    display="inline"
                                />
                            </Text>
                        </Flex>
                        <Slider
                            value={sliderValue}
                            min={0}
                            max={2}
                            step={1}
                            onChange={(val) => setSliderValue(val)}
                        >
                            <SliderTrack>
                                <SliderFilledTrack/>
                            </SliderTrack>
                            <SliderThumb/>
                        </Slider>
                        <Text mt={2} textAlign="center">
                            {sliderLabels[sliderValue]}
                        </Text>
                    </Box>
                </Flex>

                {/* Start */}
                <Flex direction="column">
                    <Text fontSize="lg" fontWeight="bold" mb={5} textAlign="center">
                        Start
                    </Text>
                    <Button
                        colorScheme="green"
                        mb={4}
                        onClick={calculateRoute}
                        borderRadius="full"
                        w="75px"
                        h="75px"
                        isDisabled={!startAddress || !destinationAddress}
                    >
                        Go!
                    </Button>
                </Flex>

                {/* Route Rating */}
                <Box maxWidth="400px">
                    <Text fontSize="lg" fontWeight="bold" mb={2} textAlign="center">
                        Route Rating
                    </Text>
                    <Input
                        id="safetyRating"
                        placeholder="Safety Rating (1.0 - 6.0 )"
                        value={safetyRating}
                        textAlign={"center"}
                        mb={4}
                        readOnly={true}
                    />
                    <Input
                        id="timeEfficiencyRating"
                        placeholder="Distance/Time"
                        value={timeEfficiencyRating}
                        textAlign={"center"}
                        readOnly={true}
                        maxWidth="1000px"
                    />
                </Box>

                {/* Options */}
                <Flex direction="column">
                    <Text fontSize="lg" fontWeight="bold" mb={2} textAlign="center">
                        Options
                    </Text>
                    <Button colorScheme="red" mb={4} onClick={resetInputs}>
                        Reset Input
                    </Button>
                    {/* Toggle */}
                    <Box>
                        <Flex direction="column" alignItems="center" mb={1}>
                            <Text mb={2} textAlign="center">
                                Show Street Safety Category
                            </Text>
                            <Switch
                                size="lg"
                                colorScheme="green"
                                isDisabled={!isSwitchEnabled}
                                isChecked={isSwitchChecked}
                                onChange={(e) => setIsSwitchChecked(e.target.checked)}
                            />
                        </Flex>
                    </Box>
                </Flex>
            </Flex>

            <Box
                backgroundColor="white"
                borderWidth="1px"
                borderRadius="lg"
                boxShadow="lg"
                overflow="hidden"
                height="100%"
                width="98.4%"
                alignSelf="center"
            >
                <MapContainer
                    mapId={MAP_ID}
                    role="main"
                    aria-label={intl.formatMessage({id: "ariaLabel.map"})}
                >
                    <MapAnchor position="top-left" horizontalGap={5} verticalGap={5}>
                        {measurementIsActive && (
                            <Box
                                backgroundColor="white"
                                borderWidth="1px"
                                borderRadius="lg"
                                padding={2}
                                boxShadow="lg"
                                role="top-left"
                                aria-label={intl.formatMessage({id: "ariaLabel.topLeft"})}
                            >
                                <Box role="dialog" aria-labelledby={measurementTitleId}>
                                    <TitledSection
                                        title={
                                            <SectionHeading
                                                id={measurementTitleId}
                                                size="md"
                                                mb={2}
                                            >
                                                {intl.formatMessage({id: "measurementTitle"})}
                                            </SectionHeading>
                                        }
                                    >
                                        <Measurement mapId={MAP_ID}/>
                                    </TitledSection>
                                </Box>
                            </Box>
                        )}
                    </MapAnchor>
                    <MapAnchor position="bottom-right" horizontalGap={10} verticalGap={30}>
                        <Flex
                            role="bottom-right"
                            aria-label={intl.formatMessage({id: "ariaLabel.bottomRight"})}
                            direction="column"
                            gap={1}
                            padding={1}
                        >
                            <ToolButton
                                label={intl.formatMessage({id: "measurementTitle"})}
                                icon={<PiRulerLight/>}
                                isActive={measurementIsActive}
                                onClick={toggleMeasurement}
                            />
                            <InitialExtent mapId={MAP_ID}/>
                            <ZoomIn mapId={MAP_ID}/>
                            <ZoomOut mapId={MAP_ID}/>
                        </Flex>
                    </MapAnchor>
                </MapContainer>
            </Box>
            <Flex
                role="region"
                aria-label={intl.formatMessage({id: "ariaLabel.footer"})}
                gap={3}
                alignItems="center"
                justifyContent="center"
            >
                <CoordinateViewer mapId={MAP_ID} precision={2}/>
                <ScaleBar mapId={MAP_ID}/>
                <ScaleViewer mapId={MAP_ID}/>
            </Flex>

        </Flex>
    );
}
