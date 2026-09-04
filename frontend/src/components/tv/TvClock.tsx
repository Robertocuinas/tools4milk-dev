"use client";

import { useEffect, useState } from "react";

export function TvClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    function update() {
      setTime(
        new Date().toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="font-mono text-2xl font-bold tracking-tight text-tv-accent">
      {time ?? "--:--:--"}
    </span>
  );
}

export function TvDate() {
  const now = new Date();
  const label = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <span className="text-sm capitalize text-tv-dim">{label}</span>
  );
}
