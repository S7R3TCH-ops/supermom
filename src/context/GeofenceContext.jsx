import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { getDistanceMeters } from '../lib/maps';
import { fetchJobById, updateJob } from '../data/jobsRepo';
import { notifyDataChanged } from '../data/useData';

const GeofenceContext = createContext(null);

export function GeofenceProvider({ children }) {
  const [trackingJob, setTrackingJob] = useState(null); // { id, lat, lng, state: 'approaching'|'working' }
  const watchId = useRef(null);
  const departureTimer = useRef(null);

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (departureTimer.current) {
      clearTimeout(departureTimer.current);
      departureTimer.current = null;
    }
    setTrackingJob(null);
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
    setTrackingJob({ id: jobId, lat: targetLat, lng: targetLng, state: 'approaching' });

    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = getDistanceMeters(latitude, longitude, targetLat, targetLng);

        setTrackingJob(prev => {
          if (!prev || prev.id !== jobId) return prev;

          // Arrival check (150m)
          if (prev.state === 'approaching' && dist <= 150) {
            handleClockIn(jobId);
            return { ...prev, state: 'working' };
          }

          // Departure check (250m)
          if (prev.state === 'working') {
            if (dist > 250) {
              if (!departureTimer.current) {
                departureTimer.current = setTimeout(() => {
                  handleClockOut(jobId);
                  stopTracking();
                }, 3 * 60 * 1000); // 3 minutes
              }
            } else {
              if (departureTimer.current) {
                clearTimeout(departureTimer.current);
                departureTimer.current = null;
              }
            }
          }
          return prev;
        });
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
