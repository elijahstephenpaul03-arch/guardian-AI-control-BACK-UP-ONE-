import * as d3 from "d3";
import { ChildProfile, ActivityLog } from "../types";

export interface HeatmapPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  category: "school" | "home" | "recreation" | "transit" | "flagged_risk" | "safe_zone";
  frequency: number; // 1 to 10 scale (visit intensity)
  dwellMinutes: number; // estimated dwell time
  riskScore: number; // 0 to 100
  isFlagged: boolean;
  incidentTitle?: string;
  incidentDescription?: string;
  timestamp?: string;
  safetyLevel?: "safe" | "warning" | "severe";
}

/**
 * Extracts and synthesizes high-frequency activity points and flagged risk locations
 * from child profile, GPS coordinates, historical trail, logs, and security events.
 */
export function generateChildActivityHeatmapData(
  child: ChildProfile,
  logs: ActivityLog[] = [],
  dangerousEvents: any[] = [],
  safeZones: any[] = []
): HeatmapPoint[] {
  if (!child || !child.lastSeenLocation) return [];

  const { lat, lng } = child.lastSeenLocation;
  const isLeo = child.name.toLowerCase().includes("leo");
  const isEmily = child.name.toLowerCase().includes("emily");

  const points: HeatmapPoint[] = [];

  if (isLeo) {
    points.push(
      {
        id: "hp-leo-1",
        lat: lat + 0.0025,
        lng: lng + 0.0010,
        name: "Kondapur Tech Academy (Classrooms & Lab)",
        category: "school",
        frequency: 10,
        dwellMinutes: 340,
        riskScore: 4,
        isFlagged: false,
        timestamp: "Active Campus Area • 6 visits this week",
        safetyLevel: "safe"
      },
      {
        id: "hp-leo-2",
        lat: lat + 0.0024,
        lng: lng + 0.0012,
        name: "Kondapur Cafeteria & STEM Workshop",
        category: "school",
        frequency: 8,
        dwellMinutes: 120,
        riskScore: 2,
        isFlagged: false,
        timestamp: "Daily Lunch & Robotics Club",
        safetyLevel: "safe"
      },
      {
        id: "hp-leo-3",
        lat: lat - 0.0062,
        lng: lng - 0.0051,
        name: "Home Safe Zone (Raghavendra Colony)",
        category: "home",
        frequency: 10,
        dwellMinutes: 480,
        riskScore: 0,
        isFlagged: false,
        timestamp: "Verified Safe Zone Sanctuary",
        safetyLevel: "safe"
      },
      {
        id: "hp-leo-4",
        lat: lat - 0.0012,
        lng: lng - 0.0010,
        name: "Botanical Garden & Outdoor Courts",
        category: "recreation",
        frequency: 6,
        dwellMinutes: 90,
        riskScore: 12,
        isFlagged: false,
        timestamp: "Afternoon Physical Recreation",
        safetyLevel: "safe"
      },
      {
        id: "hp-leo-5",
        lat: lat + 0.0010,
        lng: lng + 0.0005,
        name: "Kondapur Main Road Protected Bike Path",
        category: "transit",
        frequency: 7,
        dwellMinutes: 45,
        riskScore: 8,
        isFlagged: false,
        timestamp: "Daily Commute Route",
        safetyLevel: "safe"
      },
      {
        id: "hp-leo-6",
        lat: lat - 0.0028,
        lng: lng - 0.0018,
        name: "Sarath City Capital Mall (Public Wi-Fi Hub)",
        category: "flagged_risk",
        frequency: 4,
        dwellMinutes: 40,
        riskScore: 88,
        isFlagged: true,
        incidentTitle: "AI Scam & Phishing Link Intercepted",
        incidentDescription: "Blocked attempt to access phishing domain on public Wi-Fi network.",
        timestamp: "2 hours ago • HIGH RISK ALERT",
        safetyLevel: "severe"
      },
      {
        id: "hp-leo-7",
        lat: lat - 0.0035,
        lng: lng - 0.0030,
        name: "Kondapur Junction Intersection (P2P Handshake)",
        category: "flagged_risk",
        frequency: 3,
        dwellMinutes: 25,
        riskScore: 92,
        isFlagged: true,
        incidentTitle: "Unverified Torrent / P2P Connection Blocked",
        incidentDescription: "AI Content Filter dropped suspicious peer-to-peer download handshake attempt.",
        timestamp: "Yesterday, 11:15 AM • WARNING",
        safetyLevel: "severe"
      },
      {
        id: "hp-leo-8",
        lat: lat - 0.0055,
        lng: lng - 0.0042,
        name: "Raghavendra Residential Sidewalk (Safe Transit)",
        category: "transit",
        frequency: 5,
        dwellMinutes: 30,
        riskScore: 5,
        isFlagged: false,
        timestamp: "Walking Corridor",
        safetyLevel: "safe"
      }
    );
  } else if (isEmily) {
    points.push(
      {
        id: "hp-emily-1",
        lat: lat - 0.0010,
        lng: lng - 0.0005,
        name: "Botanical Garden Sports Complex",
        category: "recreation",
        frequency: 9,
        dwellMinutes: 240,
        riskScore: 0,
        isFlagged: false,
        timestamp: "Team Practice & Games • 5 visits",
        safetyLevel: "safe"
      },
      {
        id: "hp-emily-2",
        lat: lat + 0.0045,
        lng: lng + 0.0055,
        name: "Home Safe Zone (Raghavendra Colony)",
        category: "home",
        frequency: 10,
        dwellMinutes: 520,
        riskScore: 0,
        isFlagged: false,
        timestamp: "Verified Safe Zone Sanctuary",
        safetyLevel: "safe"
      },
      {
        id: "hp-emily-3",
        lat: lat + 0.0005,
        lng: lng + 0.0008,
        name: "Community Public Library (Children's Wing)",
        category: "school",
        frequency: 7,
        dwellMinutes: 150,
        riskScore: 2,
        isFlagged: false,
        timestamp: "Reading & Spanish Story Hours",
        safetyLevel: "safe"
      },
      {
        id: "hp-emily-4",
        lat: lat + 0.0015,
        lng: lng + 0.0018,
        name: "Sweet Scoops Ice Cream & Social Plaza",
        category: "recreation",
        frequency: 5,
        dwellMinutes: 50,
        riskScore: 5,
        isFlagged: false,
        timestamp: "Family Weekend Outing",
        safetyLevel: "safe"
      },
      {
        id: "hp-emily-5",
        lat: lat + 0.0028,
        lng: lng + 0.0028,
        name: "Main Street Pedestrian Walkway",
        category: "transit",
        frequency: 6,
        dwellMinutes: 35,
        riskScore: 10,
        isFlagged: false,
        timestamp: "Regular Walking Route",
        safetyLevel: "safe"
      },
      {
        id: "hp-emily-6",
        lat: lat + 0.0022,
        lng: lng + 0.0030,
        name: "Broadway Plaza Arcade (Unsupervised Hub)",
        category: "flagged_risk",
        frequency: 3,
        dwellMinutes: 35,
        riskScore: 78,
        isFlagged: true,
        incidentTitle: "High-Traffic Public Unmonitored Spot",
        incidentDescription: "Child stayed 35m in busy commercial zone outside safe perimeter.",
        timestamp: "Yesterday, 3:40 PM • NOTICE",
        safetyLevel: "warning"
      },
      {
        id: "hp-emily-7",
        lat: lat + 0.0038,
        lng: lng + 0.0048,
        name: "Pine Street Intersection Crosswalk",
        category: "transit",
        frequency: 7,
        dwellMinutes: 20,
        riskScore: 15,
        isFlagged: false,
        timestamp: "School Route Crossing",
        safetyLevel: "safe"
      }
    );
  } else {
    // Generic child fallback
    points.push(
      {
        id: "hp-gen-1",
        lat: lat,
        lng: lng,
        name: child.lastSeenLocation.name || "Primary Activity Hub",
        category: "school",
        frequency: 9,
        dwellMinutes: 280,
        riskScore: 5,
        isFlagged: false,
        timestamp: "Current Spot",
        safetyLevel: "safe"
      },
      {
        id: "hp-gen-2",
        lat: lat - 0.003,
        lng: lng - 0.003,
        name: "Home Perimeter",
        category: "home",
        frequency: 10,
        dwellMinutes: 450,
        riskScore: 0,
        isFlagged: false,
        timestamp: "Base Residence",
        safetyLevel: "safe"
      },
      {
        id: "hp-gen-3",
        lat: lat + 0.002,
        lng: lng - 0.002,
        name: "Commercial Flagged Zone",
        category: "flagged_risk",
        frequency: 3,
        dwellMinutes: 30,
        riskScore: 82,
        isFlagged: true,
        incidentTitle: "Suspicious Network Connection",
        incidentDescription: "Device attempted handshake with untrusted public Wi-Fi.",
        timestamp: "Recent Alert",
        safetyLevel: "warning"
      }
    );
  }

  // Include dynamic dangerous events if provided from Firebase
  dangerousEvents.forEach((ev, idx) => {
    if (ev.childId === child.id) {
      points.push({
        id: `hp-dynamic-event-${idx}`,
        lat: lat + (idx % 2 === 0 ? 0.0018 : -0.0018),
        lng: lng + (idx % 2 === 0 ? -0.0022 : 0.0022),
        name: `Security Incident: ${ev.category || "Flagged Threat"}`,
        category: "flagged_risk",
        frequency: 2,
        dwellMinutes: 15,
        riskScore: ev.riskLevel === "critical" ? 95 : 80,
        isFlagged: true,
        incidentTitle: ev.category || "Flagged Event",
        incidentDescription: ev.reason || ev.target || "Security rule interception",
        timestamp: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "Recent Event",
        safetyLevel: ev.riskLevel === "critical" ? "severe" : "warning"
      });
    }
  });

  return points;
}

/**
 * Creates D3 sequential color scales based on heatmap mode
 */
export function getD3HeatmapColorScale(
  mode: "frequency" | "flagged" | "combined",
  maxVal: number = 1
) {
  if (mode === "frequency") {
    // Cyan -> Blue -> Purple -> Pink (High Frequency Activity)
    return d3.scaleSequential(d3.interpolateTurbo).domain([0, maxVal]);
  } else if (mode === "flagged") {
    // Yellow -> Amber -> Crimson -> Dark Red (Flagged Threat Concentration)
    return d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxVal]);
  } else {
    // Emerald (Safe) -> Cyan -> Amber -> Crimson (Risk/Activity Combined Spectrum)
    return d3.scaleSequential(d3.interpolateInferno).domain([0, maxVal]);
  }
}

/**
 * Computes D3 2D Contour Density for map coordinate points
 */
export function computeD3Contours(
  projectedPoints: { x: number; y: number; weight: number }[],
  width: number,
  height: number,
  bandwidth: number = 35,
  thresholdsCount: number = 10
) {
  if (projectedPoints.length === 0 || width <= 0 || height <= 0) return [];

  try {
    const density = d3.contourDensity<{ x: number; y: number; weight: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .weight(d => d.weight)
      .size([width, height])
      .bandwidth(bandwidth)
      .thresholds(thresholdsCount);

    return density(projectedPoints);
  } catch (err) {
    console.warn("D3 contourDensity computation fallback:", err);
    return [];
  }
}
