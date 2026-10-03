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

export function loadProcyonSvg(event: MessageEvent, optimizer: SVGOptimizer): void {
  if (!procyonPlugin || event.source !== window) return;
  const data = event.data;
  if (
    !data ||
    typeof data !== "object" ||
    data.type !== "load-svg" ||
    data.loadToken !== procyonPlugin.loadToken ||
    typeof data.svg !== "string" ||
    typeof data.uri !== "string"
  ) return;
  documentLoaded = true;
  optimizer.loadSvgString(data.svg);
}

export function canSaveProcyonSvg(optimizer: SVGOptimizer): boolean {
  return documentLoaded && Boolean(optimizer.getSourceSvg().trim());
}

export function saveProcyonSvg(optimizer: SVGOptimizer): void {
  if (!procyonPlugin || !canSaveProcyonSvg(optimizer)) return;
  procyonPlugin.postMessage({ type: "save-svg", svg: optimizer.getSourceSvg() });
}
