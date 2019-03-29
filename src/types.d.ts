type ReplaceMap = Record<string, string>;

interface ExploreOptions {
  onlyMapped?: boolean;
  html?: boolean;
  noRoot?: boolean;
  replace?: ReplaceMap;
}

interface Args {
  /** Path to code file or Glob matching bundle files */
  '<script.js>': string;
  /** Path to map file */
  '<script.js.map>'?: string;
  '--json'?: boolean;
  '--html'?: boolean;
  '--tsv'?: boolean;
  '--only-mapped'?: boolean;
  '-m': boolean;
  '--replace'?: string[];
  '--with'?: string[];
  '--noroot'?: boolean;
}

type FileSizeMap = Record<string, number>;

interface ExploreResult {
  bundleName: string;
  totalBytes: number;
  unmappedBytes?: number;
  files: FileSizeMap;
  html?: string;
}

interface WriteConfig {
  path?: string;
  fileName: string;
}

interface Bundle {
  codePath: string;
  mapPath?: string;
}

interface WebTreeMapNode {
  name: string;
  data: {
    $area: number;
  };
  children: WebTreeMapNode[];
}

interface Span {
  source: string | null;
  numChars: number;
}
