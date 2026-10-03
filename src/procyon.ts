import type { SVGOptimizer } from "./optimizer";

type ProcyonPlugin = {
  loadToken: string;
  postMessage(message: { type: "save-svg"; svg: string }): void;
};

export const procyonPlugin: ProcyonPlugin | undefined =
  typeof window !== "undefined" &&
  typeof window.procyonPlugin?.postMessage === "function" &&
  typeof window.procyonPlugin.loadToken === "string" &&
  window.procyonPlugin.loadToken.length > 0
    ? window.procyonPlugin
    : undefined;

let documentLoaded = false;

export type ProcyonSaveResult =
  | { type: "save-result"; success: true }
  | { type: "save-result"; success: false; error?: string };

export function handleProcyonMessage(
  event: MessageEvent,
  optimizer: SVGOptimizer,
): { type: "load-svg" } | ProcyonSaveResult | null {
  if (!procyonPlugin || event.source !== window) return null;
  const data = event.data;
  if (
    !data ||
    typeof data !== "object" ||
    data.loadToken !== procyonPlugin.loadToken
  ) return null;
  if (data.type === "load-svg") {
    if (typeof data.svg !== "string" || typeof data.uri !== "string") return null;
    documentLoaded = true;
    optimizer.loadSvgString(data.svg);
    return { type: "load-svg" };
  }
  if (
    data.type === "save-result" &&
    typeof data.success === "boolean" &&
    (data.error === undefined || typeof data.error === "string")
  ) {
    return data.success
      ? { type: "save-result", success: true }
      : { type: "save-result", success: false, error: data.error };
  }
  return null;
}

export function canSaveProcyonSvg(optimizer: SVGOptimizer): boolean {
  return documentLoaded && Boolean(optimizer.getSourceSvg().trim());
}

export function saveProcyonSvg(optimizer: SVGOptimizer): void {
  if (!procyonPlugin || !canSaveProcyonSvg(optimizer)) return;
  procyonPlugin.postMessage({ type: "save-svg", svg: optimizer.getSourceSvg() });
}
