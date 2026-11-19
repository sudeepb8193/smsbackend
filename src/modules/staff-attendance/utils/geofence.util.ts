/**
 * Geofencing Utilities for GPS-based punch verification.
 * Implements the Great-Circle Haversine distance formula.
 */

export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface GeofenceValidationResult {
  isWithinGeofence: boolean;
  distanceInMeters: number;
  maxAllowedRadiusMeters: number;
  message?: string;
}

export function validateGeofence(
  userLat: number,
  userLon: number,
  branchLat: number,
  branchLon: number,
  maxAllowedRadiusMeters: number = 200,
): GeofenceValidationResult {
  const distance = calculateDistanceInMeters(
    userLat,
    userLon,
    branchLat,
    branchLon,
  );
  const roundedDist = Math.round(distance);

  if (distance <= maxAllowedRadiusMeters) {
    return {
      isWithinGeofence: true,
      distanceInMeters: roundedDist,
      maxAllowedRadiusMeters,
    };
  }

  return {
    isWithinGeofence: false,
    distanceInMeters: roundedDist,
    maxAllowedRadiusMeters,
    message: `Geofence check failed: You are currently ~${roundedDist}m away from the branch location. Maximum allowed punch radius is ${maxAllowedRadiusMeters}m. Please use front-desk kiosk or request manual manager check-in.`,
  };
}
