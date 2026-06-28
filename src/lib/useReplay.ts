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
const STEP_MS = 1100;

/** Drives mission-replay playback over a fixed number of timeline events. */
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
    if (!active || !playing) return;
    if (cursor >= total) {
      setPlaying(false);
      return;
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
