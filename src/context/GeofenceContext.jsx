import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { getDistanceMeters } from '../lib/maps';
import { fetchJobById, updateJob } from '../data/jobsRepo';
import { notifyDataChanged } from '../data/useData';

const GeofenceContext = createContext(null);

export function GeofenceProvider({ children }) {
  const [trackingJob, setTrackingJob] = useState(null); // { id, lat, lng, state: 'approaching'|'working' }
  const trackingJobRef = useRef(null);
  const watchId = useRef(null);
  const departureTimer = useRef(null);

  // Keep ref in sync with state so the watchPosition callback can read
  // current tracking state without being stale (refs don't go through
  // React's batching, so side effects can safely read them).
  const setTracking = (val) => {
    const next = typeof val === 'function' ? val(trackingJobRef.current) : val;
    trackingJobRef.current = next;
    setTrackingJob(next);
  };

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (departureTimer.current) {
      clearTimeout(departureTimer.current);
      departureTimer.current = null;
    }
    setTracking(null);
  };

  const handleClockIn = async (jobId) => {
    try {
      const job = await fetchJobById(jobId);
      if (!job || job.ai_context?.clock_in_time) return; // Already clocked in

      const clockIn = new Date().toISOString();
      const updatedAiContext = {
        ...(job.ai_context || {}),
        clock_in_time: clockIn,
        geofence_status: 'arrived'
      };

      await updateJob(jobId, { ai_context: updatedAiContext });
      notifyDataChanged();
    } catch (err) {
      console.error('[geofence] Clock-in failed:', err);
    }
  };

  const handleClockOut = async (jobId) => {
    try {
      const job = await fetchJobById(jobId);
      if (!job || !job.ai_context?.clock_in_time || job.job_status === 'Completed') return;

      const clockOut = new Date().toISOString();
      const clockIn = new Date(job.ai_context.clock_in_time);
      const durationMs = new Date(clockOut) - clockIn;
      const durationHours = Math.max(0.1, parseFloat((durationMs / 3600000).toFixed(2)));

      const updatedAiContext = {
        ...(job.ai_context || {}),
        clock_out_time: clockOut,
        geofence_status: 'departed'
      };

      await updateJob(jobId, {
        ai_context: updatedAiContext,
        job_status: 'Completed',
        actual_duration: durationHours,
        completion_date: new Date().toISOString().split('T')[0]
      });
      notifyDataChanged();
    } catch (err) {
      console.error('[geofence] Clock-out failed:', err);
    }
  };

  const startTracking = (jobId, targetLat, targetLng) => {
    stopTracking();
    setTracking({ id: jobId, lat: targetLat, lng: targetLng, state: 'approaching' });

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = getDistanceMeters(latitude, longitude, targetLat, targetLng);
        const cur = trackingJobRef.current;
        if (!cur || cur.id !== jobId) return;

        // Arrival (150m) — update state first, then fire the side effect
        if (cur.state === 'approaching' && dist <= 150) {
          setTracking({ ...cur, state: 'working' });
          handleClockIn(jobId);
          return;
        }

        // Departure (250m for 3 min) — pure ref/timer manipulation, no state update needed
        if (cur.state === 'working') {
          if (dist > 250) {
            if (!departureTimer.current) {
              departureTimer.current = setTimeout(() => {
                handleClockOut(jobId);
                stopTracking();
              }, 3 * 60 * 1000);
            }
          } else if (departureTimer.current) {
            clearTimeout(departureTimer.current);
            departureTimer.current = null;
          }
        }
      },
      (err) => console.error('[geofence] Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  };

  useEffect(() => {
    return () => stopTracking();
  }, []);

  return (
    <GeofenceContext.Provider value={{ trackingJob, startTracking, stopTracking, handleClockOut }}>
      {children}
    </GeofenceContext.Provider>
  );
}

export function useGeofence() {
  const ctx = useContext(GeofenceContext);
  if (!ctx) throw new Error('useGeofence must be used within GeofenceProvider');
  return ctx;
}
