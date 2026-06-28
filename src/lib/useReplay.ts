import { useCallback, useEffect, useState } from "react";

export interface Replay {
  active: boolean;
  cursor: number; // number of events revealed (0..total)
  total: number;
  playing: boolean;
  speed: number;
  atEnd: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
  seek: (n: number) => void;
  toStart: () => void;
  toEnd: () => void;
  cycleSpeed: () => void;
}

const SPEEDS = [1, 2, 4, 8];
const STEP_MS = 1100; // ≈ 1s between beats at 1×
const END_HOLD_MS = 2200; // dwell on the final beat before the loop restarts

/**
 * Drives mission-replay playback over a fixed number of timeline beats. Playback
 * loops: on reaching the end it holds briefly on the final beat, then restarts
 * from the top — so the operation replays as a continuous performance.
 */
export function useReplay(total: number): Replay {
  const [active, setActive] = useState(false);
  const [cursor, setCursor] = useState(total);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Track live tip while not replaying so exit/seek land on current state.
  useEffect(() => {
    if (!active) setCursor(total);
  }, [total, active]);

  useEffect(() => {
    if (!active || !playing || total === 0) return;
    if (cursor >= total) {
      // Loop: hold on the final beat, then restart from the top.
      const id = setTimeout(() => setCursor(0), END_HOLD_MS / speed);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCursor((c) => Math.min(total, c + 1)), STEP_MS / speed);
    return () => clearTimeout(id);
  }, [active, playing, cursor, total, speed]);

  const enter = useCallback(() => {
    setActive(true);
    setCursor(0);
    setPlaying(true);
  }, []);
  const exit = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setCursor(total);
  }, [total]);
  const toggle = useCallback(() => {
    setCursor((c) => (c >= total ? 0 : c)); // replay from start if at end
    setPlaying((p) => !p);
  }, [total]);
  const seek = useCallback((n: number) => {
    setPlaying(false);
    setCursor(Math.max(0, Math.min(total, n)));
  }, [total]);
  const toStart = useCallback(() => {
    setPlaying(false);
    setCursor(0);
  }, []);
  const toEnd = useCallback(() => {
    setPlaying(false);
    setCursor(total);
  }, [total]);
  const cycleSpeed = useCallback(() => {
    setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
  }, []);

  return {
    active,
    cursor,
    total,
    playing,
    speed,
    atEnd: cursor >= total,
    enter,
    exit,
    toggle,
    seek,
    toStart,
    toEnd,
    cycleSpeed,
  };
}
