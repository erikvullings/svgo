type PathDataSegment = { type: string; values: number[] };

interface SVGPathElement {
  getPathData?: (options?: { normalize?: boolean }) => PathDataSegment[];
}

type MonacoEditorInstance = {
  getValue: () => string;
  setValue: (value: string) => void;
  onDidChangeModelContent: (listener: () => void) => void;
};

type MonacoLanguageConfig = {
  brackets: [string, string][];
  autoClosingPairs: { open: string; close: string }[];
};

interface MonacoApi {
  languages: {
    register: (config: { id: string }) => void;
    setLanguageConfiguration: (languageId: string, config: MonacoLanguageConfig) => void;
  };
  editor: {
    setTheme: (theme: string) => void;
    create: (
      container: HTMLElement,
      options: {
        value: string;
        language: string;
        theme: string;
        automaticLayout: boolean;
        minimap: { enabled: boolean };
        wordWrap: 'on' | 'off' | 'bounded';
        renderLineHighlight: 'none' | 'line' | 'all' | 'gutter';
      }
    ) => MonacoEditorInstance;
  };
}

interface RequireLike {
  (dependencies: string[], callback: () => void): void;
  config: (config: { paths: Record<string, string> }) => void;
}

declare const require: RequireLike;
declare const monaco: MonacoApi;
declare function acquireVsCodeApi(): { postMessage: (message: unknown) => void } | undefined;
