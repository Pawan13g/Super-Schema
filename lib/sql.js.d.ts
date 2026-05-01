declare module "sql.js" {
  interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    close(): void;
  }

  interface SqlJsStatic {
    Database: new () => Database;
  }

  interface InitSqlJsConfig {
    locateFile?: (file: string, scriptDirectory: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
    [key: string]: unknown;
  }

  export type { Database };
  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>;
}
