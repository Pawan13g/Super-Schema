declare module "sql.js" {
  interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): { columns: string[]; values: unknown[][] }[];
    close(): void;
  }

  interface SqlJsStatic {
    Database: new () => Database;
  }

  export type { Database };
  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}
