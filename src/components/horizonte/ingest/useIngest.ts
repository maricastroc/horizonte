"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldEngine } from "../engine/FieldEngine";
import { filesFromDataTransfer } from "./drop";
import { IngestSession } from "./session";
import type { IngestStatus } from "./types";

export const IDLE_STATUS: IngestStatus = {
  phase: "done",
  progress: 0,
  groupIndex: 0,
  groupCount: 0,
  artist: "",
  title: "",
  probe: null,
  error: null,
};

const CLOSE_MS = 900;
const ERROR_MS = 5200;
const CANCEL_MS = 1400;

export function useIngest(engine: FieldEngine | null) {
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [dragging, setDragging] = useState(false);
  const sessionRef = useRef<IngestSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depth = useRef(0);

  useEffect(
    () => () => {
      sessionRef.current?.dispose();
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const ingest = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      sessionRef.current?.dispose();

      const session = new IngestSession(setStatus);
      sessionRef.current = session;
      engine?.markIntent();

      const { indices } = await session.run(files);
      if (sessionRef.current !== session) return;

      if (indices.length > 0) {
        timerRef.current = setTimeout(() => {
          engine?.enterAlbum(indices[0]);
          setStatus(null);
        }, CLOSE_MS);
      } else {
        timerRef.current = setTimeout(() => setStatus(null), ERROR_MS);
      }
    },
    [engine],
  );

  const cancel = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.cancel();
    sessionRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus(null), CANCEL_MS);
  }, []);

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      depth.current++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    };
    const move = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const drop = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      await ingest(await filesFromDataTransfer(e.dataTransfer));
    };

    window.addEventListener("dragenter", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", move);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", move);
      window.removeEventListener("drop", drop);
    };
  }, [ingest]);

  return { status, dragging, ingest, cancel };
}
