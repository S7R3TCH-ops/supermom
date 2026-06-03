// src/lib/maps.js
// Logic for calculating drive times and mileage using the Google Distance Matrix API (via Vercel proxy).

import { updateJob } from '../data/jobsRepo';
import { fetchClients } from '../data/clientsRepo';

const HOME_ADDRESS = "Georgetown, ON, Canada"; // Default base for Sandra

/**
 * Calculates and stores drive estimates for a day's worth of jobs.
 * Follows "Option C" logic: Home -> Job 1 -> Job 2 -> ... -> Home.
 * @param {Array} jobsForDay - Sorted list of jobs for a single day.
 */
export async function updateDailyRoutes(jobsForDay) {
  if (!jobsForDay || jobsForDay.length === 0) return;

  // 1. Fetch client info to get addresses
  let clientLookup = {};
  try {
    const clients = await fetchClients();
    clientLookup = Object.fromEntries(clients.map(c => [c.id, c]));
  } catch (e) {
    console.error('[maps] Failed to fetch clients for routing:', e);
    return;
  }

  // 2. Gather all stop addresses
  const stops = [HOME_ADDRESS];
  for (const j of jobsForDay) {
    const c = clientLookup[j.client_id];
    const addr = (c?.street && c?.city) ? `${c.street}, ${c.city}, ${c.province || 'ON'}` : null;
    stops.push(addr || HOME_ADDRESS);
  }

  const origins = stops.join('|');
  const destinations = stops.join('|');

  try {
    const res = await fetch(`/api/distance?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}`);
    const data = await res.json();

    if (data.status !== 'OK') {
      console.warn('[maps] Distance matrix API returned status:', data.status, data.error_message);
      return;
    }

    const matrix = data.rows; // rows[i].elements[j] is distance from origins[i] to destinations[j]

    for (let i = 0; i < jobsForDay.length; i++) {
      const job = jobsForDay[i];
      const jobIndex = i + 1; // index in stops array

      // Leg 1: i=0 -> matrix[0][1] (Home -> Job 1)
      // Leg 2: i=1 -> matrix[1][2] (Job 1 -> Job 2)
      const elementTo = matrix[jobIndex - 1].elements[jobIndex];
      
      let driveTo = false; // false = attempted but no route (vs undefined = never attempted)
      if (elementTo && elementTo.status === 'OK') {
        driveTo = {
          from: i === 0 ? "Home" : "Previous Job",
          duration: elementTo.duration.text,
          distance: elementTo.distance.text,
          durationValue: elementTo.duration.value,
          distanceValue: elementTo.distance.value
        };
      }

      let driveHome = null;
      // If it's the last job of the day, calculate return leg: matrix[jobIndex][0] (Job N -> Home)
      if (i === jobsForDay.length - 1) {
        const elementHome = matrix[jobIndex].elements[0];
        if (elementHome && elementHome.status === 'OK') {
          driveHome = {
            duration: elementHome.duration.text,
            distance: elementHome.distance.text,
            durationValue: elementHome.duration.value,
            distanceValue: elementHome.distance.value
          };
        }
      }

      // Patch the job's ai_context
      const updatedAiContext = {
        ...(job.ai_context || {}),
        drive_to: driveTo,
        ...(driveHome ? { drive_home: driveHome } : {})
      };

      await updateJob(job.id, { ai_context: updatedAiContext });
    }
  } catch (error) {
    console.error('[maps] updateDailyRoutes failed:', error);
  }
}

/**
 * Constructs a Google Maps navigation intent URL.
 * @param {string} address - The destination address.
 * @returns {string} The intent URL.
 */
export function getNavigationUrl(address) {
  if (!address) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

/**
 * Converts an address string into lat/lng coordinates.
 * @param {string} address 
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
export async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    const data = await res.json();
    if (data.status === 'OK' && data.results.length > 0) {
      return data.results[0].geometry.location; // { lat, lng }
    }
  } catch (e) {
    console.error('[maps] Geocode failed:', e);
  }
  return null;
}

/**
 * Calculates the Haversine distance between two points in meters.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
