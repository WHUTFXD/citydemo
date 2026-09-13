"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { autoDispatchScenario } from "@/lib/autoDispatchScenario";
import type { AutoDispatchPhase, AutoDispatchRuntimeItem } from "@/types/auto-dispatch";

interface AutoDispatchState {
  phase: AutoDispatchPhase;
  items: AutoDispatchRuntimeItem[];
  nextIndex: number;
  nextArrivalAt: number | null;
  remainingMs: number;
}

type AutoDispatchAction =
  | { type: "START"; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number }
  | { type: "ARRIVE"; index: number; now: number }
  | { type: "RESOLVE"; scenarioIndex: number }
  | { type: "MANUAL_RESOLVE"; orderId: string };

const initialState: AutoDispatchState = {
  phase: "idle",
  items: [],
  nextIndex: 0,
  nextArrivalAt: null,
  remainingMs: autoDispatchScenario.items[0]?.arrivalOffsetMs ?? autoDispatchScenario.intervalMs,
};

function reducer(state: AutoDispatchState, action: AutoDispatchAction): AutoDispatchState {
  if (action.type === "START") {
    const firstDelay = autoDispatchScenario.items[0]?.arrivalOffsetMs ?? autoDispatchScenario.intervalMs;
    return { phase: "running", items: [], nextIndex: 0, nextArrivalAt: action.now + firstDelay, remainingMs: firstDelay };
  }
  if (action.type === "PAUSE" && state.phase === "running") {
    return {
      ...state,
      phase: "paused",
      remainingMs: Math.max(0, (state.nextArrivalAt ?? action.now) - action.now),
      nextArrivalAt: null,
    };
  }
  if (action.type === "RESUME" && state.phase === "paused") {
    return { ...state, phase: "running", nextArrivalAt: action.now + state.remainingMs };
  }
  if (action.type === "ARRIVE" && state.phase === "running" && action.index === state.nextIndex) {
    const nextIndex = state.nextIndex + 1;
    const currentOffset = autoDispatchScenario.items[action.index]?.arrivalOffsetMs ?? 0;
    const nextOffset = autoDispatchScenario.items[nextIndex]?.arrivalOffsetMs;
    const nextDelay = nextOffset === undefined ? 0 : Math.max(0, nextOffset - currentOffset);
    return {
      ...state,
      items: [{ scenarioIndex: action.index, state: "analyzing", enteredAt: action.now }, ...state.items],
      nextIndex,
      nextArrivalAt: nextOffset === undefined ? null : action.now + nextDelay,
      remainingMs: nextDelay,
    };
  }
  if (action.type === "RESOLVE") {
    const scenarioItem = autoDispatchScenario.items[action.scenarioIndex];
    const items = state.items.map((item) => item.scenarioIndex === action.scenarioIndex && item.state === "analyzing"
      ? { ...item, state: scenarioItem.outcome === "needs-manual" ? "needsManual" as const : "autoDispatched" as const }
      : item);
    const done = state.nextIndex >= autoDispatchScenario.items.length && !items.some((item) => item.state === "analyzing");
    return { ...state, items, phase: done ? "completed" : state.phase };
  }
  if (action.type === "MANUAL_RESOLVE") {
    return {
      ...state,
      items: state.items.map((item) => autoDispatchScenario.items[item.scenarioIndex].order.id === action.orderId
        ? { ...item, state: "manuallyResolved" }
        : item),
    };
  }
  return state;
}

interface AutoDispatchContextValue extends AutoDispatchState {
  total: number;
  countdownSeconds: number;
  autoDispatchedCount: number;
  needsManualCount: number;
  manuallyResolvedCount: number;
  toggle: (enabled: boolean) => void;
  replay: () => void;
  resolveManual: (orderId: string) => void;
}

const AutoDispatchContext = createContext<AutoDispatchContextValue | null>(null);

export function AutoDispatchProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (state.phase !== "running") return;
    const ticker = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(ticker);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "running" || state.nextArrivalAt === null || state.nextIndex >= autoDispatchScenario.items.length) return;
    const delay = Math.max(0, state.nextArrivalAt - Date.now());
    const timer = window.setTimeout(() => dispatch({ type: "ARRIVE", index: state.nextIndex, now: Date.now() }), delay);
    return () => window.clearTimeout(timer);
  }, [state.nextArrivalAt, state.nextIndex, state.phase]);

  useEffect(() => {
    const timers = state.items.filter((item) => item.state === "analyzing").map((item) => {
      const delay = Math.max(0, autoDispatchScenario.items[item.scenarioIndex].analysisDurationMs - (Date.now() - item.enteredAt));
      return window.setTimeout(() => dispatch({ type: "RESOLVE", scenarioIndex: item.scenarioIndex }), delay);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [state.items]);

  const value = useMemo<AutoDispatchContextValue>(() => ({
    ...state,
    total: autoDispatchScenario.items.length,
    countdownSeconds: state.phase === "running" && state.nextArrivalAt !== null
      ? Math.max(0, Math.ceil((state.nextArrivalAt - clock) / 1000))
      : Math.ceil(state.remainingMs / 1000),
    autoDispatchedCount: state.items.filter((item) => item.state === "autoDispatched").length,
    needsManualCount: state.items.filter((item) => item.state === "needsManual").length,
    manuallyResolvedCount: state.items.filter((item) => item.state === "manuallyResolved").length,
    toggle: (enabled) => {
      const now = Date.now();
      setClock(now);
      if (!enabled) dispatch({ type: "PAUSE", now });
      else if (state.phase === "paused") dispatch({ type: "RESUME", now });
      else dispatch({ type: "START", now });
    },
    replay: () => {
      const now = Date.now();
      setClock(now);
      dispatch({ type: "START", now });
    },
    resolveManual: (orderId) => dispatch({ type: "MANUAL_RESOLVE", orderId }),
  }), [clock, state]);

  return <AutoDispatchContext.Provider value={value}>{children}</AutoDispatchContext.Provider>;
}

export function useAutoDispatch() {
  const context = useContext(AutoDispatchContext);
  if (!context) throw new Error("useAutoDispatch must be used within AutoDispatchProvider");
  return context;
}
