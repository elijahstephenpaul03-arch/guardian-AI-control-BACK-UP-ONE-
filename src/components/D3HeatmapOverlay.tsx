import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import * as d3 from "d3";
import { ChildProfile, ActivityLog } from "../types";
import { 
  HeatmapPoint, 
  generateChildActivityHeatmapData, 
  getD3HeatmapColorScale, 
  computeD3Contours 
} from "../lib/d3Heatmap";
import { AlertTriangle, MapPin, Clock, Flame, ShieldAlert, Sparkles, X, ChevronRight, Eye } from "lucide-react";

interface D3HeatmapOverlayProps {
  map: L.Map | null;
  activeChild: ChildProfile;
  logs?: ActivityLog[];
  dangerousEvents?: any[];
  safeZones?: any[];
  enabled: boolean;
  heatmapType: "frequency" | "flagged" | "combined";
  opacity: number;
  bandwidth: number;
  selectedPoint: HeatmapPoint | null;
  setSelectedPoint: (pt: HeatmapPoint | null) => void;
}

export default function D3HeatmapOverlay({
  map,
  activeChild,
  logs = [],
  dangerousEvents = [],
  safeZones = [],
  enabled,
  heatmapType,
  opacity,
  bandwidth,
  selectedPoint,
  setSelectedPoint
}: D3HeatmapOverlayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Generate heatmap data points for active child
  const heatmapData = useMemo(() => {
    return generateChildActivityHeatmapData(activeChild, logs, dangerousEvents, safeZones);
  }, [activeChild, logs, dangerousEvents, safeZones]);

  // Redraw D3 Heatmap onto the Leaflet Overlay Pane
  useEffect(() => {
    if (!map) return;

    const overlayPane = map.getPanes().overlayPane;
    let svg = d3.select(overlayPane).select<SVGSVGElement>(".d3-leaflet-heatmap-layer");

    if (!enabled) {
      svg.remove();
      return;
    }

    if (svg.empty()) {
      svg = d3.select(overlayPane)
        .append("svg")
        .attr("class", "d3-leaflet-heatmap-layer pointer-events-auto")
        .style("position", "absolute")
        .style("z-index", "450");
    }

    svgRef.current = svg.node();

    // Defs for D3 gradients, glowing filter effects and animations
    let defs = svg.select<SVGDefsElement>("defs");
    if (defs.empty()) {
      defs = svg.append("defs");

      // Inject custom keyframes and transition stylesheets for smooth heatmap interpolation
      defs.append("style").text(`
        .d3-contour {
          transition: opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1), fill 0.6s ease, stroke 0.6s ease;
          will-change: opacity, fill;
        }
        .d3-hotspot-node {
          transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
          will-change: transform, opacity;
        }
        .d3-halo-normal {
          animation: d3-halo-breathe 2.8s infinite ease-in-out;
        }
        .d3-halo-flagged {
          animation: d3-halo-alert 1.6s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }
        @keyframes d3-halo-breathe {
          0% { r: 16px; opacity: 0.28; }
          50% { r: 24px; opacity: 0.10; }
          100% { r: 16px; opacity: 0.28; }
        }
        @keyframes d3-halo-alert {
          0% { r: 18px; opacity: 0.45; }
          50% { r: 32px; opacity: 0.08; }
          100% { r: 18px; opacity: 0.45; }
        }
      `);

      // Gaussian blur filter for smooth thermal blending
      const filter = defs.append("filter")
        .attr("id", "d3-heat-blur")
        .attr("x", "-40%")
        .attr("y", "-40%")
        .attr("width", "180%")
        .attr("height", "180%");
      
      filter.append("feGaussianBlur")
        .attr("stdDeviation", "5")
        .attr("result", "blur");

      filter.append("feMerge")
        .selectAll("feMergeNode")
        .data(["blur", "SourceGraphic"])
        .enter()
        .append("feMergeNode")
        .attr("in", d => d);
    }

    // Function to project coordinates and update D3 SVG elements
    const updateHeatmap = () => {
      if (!map || !svgRef.current) return;

      const bounds = map.getBounds();
      const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
      const bottomRight = map.latLngToLayerPoint(bounds.getSouthEast());

      const width = Math.max(100, bottomRight.x - topLeft.x);
      const height = Math.max(100, bottomRight.y - topLeft.y);

      // Reposition and resize SVG container matching current map layer view
      svg
        .attr("width", width)
        .attr("height", height)
        .style("left", `${topLeft.x}px`)
        .style("top", `${topLeft.y}px`);

      // Transform group for panning/zooming compensation
      let g = svg.select<SVGGElement>(".d3-heat-group");
      if (g.empty()) {
        g = svg.append("g").attr("class", "d3-heat-group");
      }

      g.attr("transform", `translate(${-topLeft.x}, ${-topLeft.y})`);

      // Project all child activity points into current pixel positions
      const projected = heatmapData.map(pt => {
        const layerPt = map.latLngToLayerPoint([pt.lat, pt.lng]);
        let weight = 1;

        if (heatmapType === "frequency") {
          weight = pt.frequency * 8 + (pt.dwellMinutes / 10);
        } else if (heatmapType === "flagged") {
          weight = pt.isFlagged ? pt.riskScore * 1.5 : (pt.riskScore > 10 ? pt.riskScore * 0.5 : 0.5);
        } else {
          // Combined spectrum
          weight = (pt.frequency * 5) + (pt.riskScore * 0.9);
        }

        return {
          point: pt,
          x: layerPt.x,
          y: layerPt.y,
          weight: Math.max(1, weight)
        };
      });

      // Filter points to those relevant for the current mode
      const activeProjected = projected.filter(p => {
        if (heatmapType === "flagged") {
          return p.point.isFlagged || p.point.riskScore > 15;
        }
        return true;
      });

      // 1. Calculate continuous 2D Kernel Density Contours using D3
      const contours = computeD3Contours(
        activeProjected.map(p => ({ x: p.x, y: p.y, weight: p.weight })),
        map.getSize().x + 200,
        map.getSize().y + 200,
        bandwidth,
        14
      );

      const maxDensity = d3.max(contours, c => c.value) || 0.01;
      const colorScale = getD3HeatmapColorScale(heatmapType, maxDensity);
      const geoPath = d3.geoPath();

      // Render Density Contour Iso-bands
      let contourGroup = g.select<SVGGElement>(".d3-contours-layer");
      if (contourGroup.empty()) {
        contourGroup = g.append("g").attr("class", "d3-contours-layer");
      }

      const paths = contourGroup.selectAll<SVGPathElement, d3.ContourMultiPolygon>("path.d3-contour")
        .data(contours, (d: any, idx) => `contour-${idx}-${d?.value?.toFixed(5)}`);

      // Entering contour paths start transparent and fade in
      const pathsEnter = paths.enter()
        .append("path")
        .attr("class", "d3-contour")
        .attr("d", geoPath)
        .attr("fill", d => colorScale(d.value))
        .attr("stroke", d => colorScale(d.value))
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.4)
        .attr("opacity", 0);

      // Merge and transition opacity & color fill smoothly
      pathsEnter.merge(paths)
        .attr("d", geoPath)
        .attr("fill", d => colorScale(d.value))
        .attr("stroke", d => colorScale(d.value))
        .attr("opacity", (d) => {
          const ratio = d.value / maxDensity;
          return Math.min(0.80, (opacity / 100) * (0.22 + ratio * 0.58));
        });

      // Exiting contours fade out gracefully
      paths.exit()
        .attr("opacity", 0)
        .remove();

      // 2. Render Point Hotspot Discs, Pulses & Flags
      let pointsGroup = g.select<SVGGElement>(".d3-points-layer");
      if (pointsGroup.empty()) {
        pointsGroup = g.append("g").attr("class", "d3-points-layer");
      }

      const pointNodes = pointsGroup.selectAll<SVGGElement, any>("g.d3-hotspot-node")
        .data(activeProjected, (d: any) => d?.point?.id || "");

      const pointEnter = pointNodes.enter()
        .append("g")
        .attr("class", "d3-hotspot-node cursor-pointer")
        .style("opacity", "0")
        .on("click", (_event: any, d: any) => {
          setSelectedPoint(d.point);
          map.flyTo([d.point.lat, d.point.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
        });

      // Outer animated heat halo with dynamic pulsing classes
      pointEnter.append("circle")
        .attr("class", (d: any) => `d3-halo ${d.point.isFlagged ? 'd3-halo-flagged' : 'd3-halo-normal'}`)
        .attr("r", (d: any) => d.point.isFlagged ? 22 : 16)
        .attr("fill", (d: any) => d.point.isFlagged ? "#ef4444" : (heatmapType === "frequency" ? "#06b6d4" : "#8b5cf6"))
        .attr("opacity", 0.22)
        .attr("filter", "url(#d3-heat-blur)");

      // Core anchor circle
      pointEnter.append("circle")
        .attr("class", "d3-core")
        .attr("r", (d: any) => d.point.isFlagged ? 10 : 7)
        .attr("fill", (d: any) => d.point.isFlagged ? "#ef4444" : (heatmapType === "frequency" ? "#0891b2" : "#7c3aed"))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .attr("opacity", 0.95);

      // Flagged Danger indicator badge
      const flaggedGroup = pointEnter.filter((d: any) => !!d.point.isFlagged);
      flaggedGroup.append("rect")
        .attr("x", -10)
        .attr("y", -24)
        .attr("width", 20)
        .attr("height", 12)
        .attr("rx", 3)
        .attr("fill", "#991b1b")
        .attr("stroke", "#f87171")
        .attr("stroke-width", 1);

      flaggedGroup.append("text")
        .attr("x", 0)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .attr("fill", "#ffffff")
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .attr("font-family", "monospace")
        .text("⚠️");

      // Merge and update positions and styles smoothly
      const mergedPoints = pointEnter.merge(pointNodes);
      mergedPoints
        .attr("transform", (d: any) => `translate(${d.x}, ${d.y})`)
        .style("opacity", "1");

      mergedPoints.select("circle.d3-halo")
        .attr("class", (d: any) => `d3-halo ${d.point.isFlagged ? 'd3-halo-flagged' : 'd3-halo-normal'}`)
        .attr("fill", (d: any) => d.point.isFlagged ? "#ef4444" : (heatmapType === "frequency" ? "#06b6d4" : "#8b5cf6"))
        .attr("opacity", (opacity / 100) * 0.28);

      mergedPoints.select("circle.d3-core")
        .attr("fill", (d: any) => d.point.isFlagged ? "#ef4444" : (heatmapType === "frequency" ? "#0891b2" : "#7c3aed"));

      // Exit points with fade out
      pointNodes.exit()
        .style("opacity", "0")
        .remove();
    };

    // Attach Leaflet event listeners
    map.on("move", updateHeatmap);
    map.on("zoom", updateHeatmap);
    map.on("viewreset", updateHeatmap);
    map.on("resize", updateHeatmap);

    // Initial render
    updateHeatmap();

    return () => {
      map.off("move", updateHeatmap);
      map.off("zoom", updateHeatmap);
      map.off("viewreset", updateHeatmap);
      map.off("resize", updateHeatmap);
      if (svgRef.current) {
        d3.select(svgRef.current).remove();
        svgRef.current = null;
      }
    };
  }, [map, activeChild, heatmapData, enabled, heatmapType, opacity, bandwidth]);

  if (!enabled || !selectedPoint) return null;

  return (
    <div className="absolute bottom-16 left-3 z-[1001] w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl space-y-3 font-sans text-left animate-fadeIn text-white">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg ${selectedPoint.isFlagged ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
            {selectedPoint.isFlagged ? <ShieldAlert className="h-4 w-4" /> : <Flame className="h-4 w-4" />}
          </div>
          <div>
            <h5 className="font-bold text-xs text-white leading-tight font-display">{selectedPoint.name}</h5>
            <span className="text-[9px] font-mono text-slate-400 uppercase">
              {selectedPoint.isFlagged ? "⚠️ Flagged Threat Location" : "High-Frequency Safe Zone"}
            </span>
          </div>
        </div>
        <button 
          onClick={() => setSelectedPoint(null)}
          className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-px bg-slate-800"></div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
          <span className="text-[8px] uppercase font-mono text-slate-400 block">Activity Intensity</span>
          <span className="font-bold font-mono text-cyan-400 text-sm">
            {selectedPoint.frequency} / 10 <span className="text-[9px] text-slate-400 font-normal">Score</span>
          </span>
        </div>
        <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800">
          <span className="text-[8px] uppercase font-mono text-slate-400 block">Est. Dwell Time</span>
          <span className="font-bold font-mono text-emerald-400 text-sm">
            {selectedPoint.dwellMinutes} mins
          </span>
        </div>
      </div>

      {selectedPoint.isFlagged ? (
        <div className="p-2.5 bg-red-950/40 border border-red-800/50 rounded-xl space-y-1">
          <div className="flex items-center space-x-1.5 text-red-400 text-[10px] font-bold font-mono uppercase">
            <AlertTriangle className="h-3 w-3" />
            <span>{selectedPoint.incidentTitle || "Security Incident Intercepted"}</span>
          </div>
          <p className="text-[10px] text-red-200/90 leading-relaxed font-sans">
            {selectedPoint.incidentDescription}
          </p>
        </div>
      ) : (
        <div className="p-2.5 bg-slate-950/60 border border-slate-800/60 rounded-xl flex items-center justify-between text-[10px] text-slate-300">
          <span>Safety Classification</span>
          <span className="font-bold text-emerald-400 font-mono uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Safe Perimeter
          </span>
        </div>
      )}

      <div className="text-[9px] text-slate-400 font-mono flex items-center justify-between pt-1">
        <span>Lat: {selectedPoint.lat.toFixed(4)}, Lng: {selectedPoint.lng.toFixed(4)}</span>
        <span>{selectedPoint.timestamp}</span>
      </div>
    </div>
  );
}
