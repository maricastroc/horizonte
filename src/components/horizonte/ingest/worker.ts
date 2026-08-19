/// <reference lib="webworker" />
import type { IngestRequest } from "./protocol";
import { createWorkerCore } from "./workerCore";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const core = createWorkerCore((msg) => scope.postMessage(msg));

scope.onmessage = (event: MessageEvent<IngestRequest>) => core.handle(event.data);
