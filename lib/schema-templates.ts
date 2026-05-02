import type { Schema, Table, Column, Relation, ColumnType, ColumnConstraint } from "./types";
import { TABLE_COLORS } from "./types";

export interface TemplateColumn {
  name: string;
  type: ColumnType;
  constraints?: ColumnConstraint[];
  comment?: string;
  defaultValue?: string;
}

export interface TemplateTable {
  name: string;
  comment?: string;
  columns: TemplateColumn[];
}

export interface TemplateRelation {
  source: string;
  sourceColumn: string;
  target: string;
  targetColumn: string;
  type: Relation["type"];
}

export interface SchemaTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  tables: TemplateTable[];
  relations: TemplateRelation[];
}

const T = {
  pk: { name: "id", type: "SERIAL" as ColumnType, constraints: ["PRIMARY KEY"] as ColumnConstraint[] },
  uuidPk: { name: "id", type: "UUID" as ColumnType, constraints: ["PRIMARY KEY"] as ColumnConstraint[] },
  createdAt: { name: "created_at", type: "TIMESTAMP" as ColumnType, constraints: ["NOT NULL"] as ColumnConstraint[], defaultValue: "CURRENT_TIMESTAMP" },
  updatedAt: { name: "updated_at", type: "TIMESTAMP" as ColumnType, constraints: ["NOT NULL"] as ColumnConstraint[], defaultValue: "CURRENT_TIMESTAMP" },
};

export const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Customers, products, orders, line items, payments.",
    tags: ["shop", "orders", "payments"],
    tables: [
      {
        name: "customers",
        comment: "Buyers / shoppers.",
        columns: [
          T.pk,
          { name: "email", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"], comment: "Login + receipts." },
          { name: "name", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "phone", type: "VARCHAR" },
          T.createdAt,
        ],
      },
      {
        name: "addresses",
        comment: "Shipping / billing addresses per customer.",
        columns: [
          T.pk,
          { name: "customer_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "line1", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "line2", type: "VARCHAR" },
          { name: "city", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "region", type: "VARCHAR" },
          { name: "postal_code", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "country", type: "CHAR", constraints: ["NOT NULL"], comment: "ISO 3166-1 alpha-2." },
        ],
      },
      {
        name: "products",
        comment: "Sellable items.",
        columns: [
          T.pk,
          { name: "sku", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "name", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "description", type: "TEXT" },
          { name: "price_cents", type: "INT", constraints: ["NOT NULL"], comment: "Store as integer cents." },
          { name: "stock", type: "INT", constraints: ["NOT NULL"], defaultValue: "0" },
          T.createdAt,
        ],
      },
      {
        name: "orders",
        comment: "Customer orders.",
        columns: [
          T.pk,
          { name: "customer_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "shipping_address_id", type: "INT", constraints: ["REFERENCES"] },
          { name: "status", type: "VARCHAR", constraints: ["NOT NULL"], defaultValue: "'pending'", comment: "pending|paid|shipped|cancelled" },
          { name: "total_cents", type: "INT", constraints: ["NOT NULL"] },
          T.createdAt,
        ],
      },
      {
        name: "order_items",
        comment: "Line items of an order.",
        columns: [
          T.pk,
          { name: "order_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "product_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "quantity", type: "INT", constraints: ["NOT NULL"], defaultValue: "1" },
          { name: "unit_price_cents", type: "INT", constraints: ["NOT NULL"], comment: "Snapshot of price at order time." },
        ],
      },
      {
        name: "payments",
        comment: "Payment attempts per order.",
        columns: [
          T.pk,
          { name: "order_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "provider", type: "VARCHAR", constraints: ["NOT NULL"], comment: "stripe|paypal|..." },
          { name: "amount_cents", type: "INT", constraints: ["NOT NULL"] },
          { name: "status", type: "VARCHAR", constraints: ["NOT NULL"], defaultValue: "'pending'" },
          T.createdAt,
        ],
      },
    ],
    relations: [
      { source: "addresses", sourceColumn: "customer_id", target: "customers", targetColumn: "id", type: "one-to-many" },
      { source: "orders", sourceColumn: "customer_id", target: "customers", targetColumn: "id", type: "one-to-many" },
      { source: "orders", sourceColumn: "shipping_address_id", target: "addresses", targetColumn: "id", type: "one-to-many" },
      { source: "order_items", sourceColumn: "order_id", target: "orders", targetColumn: "id", type: "one-to-many" },
      { source: "order_items", sourceColumn: "product_id", target: "products", targetColumn: "id", type: "one-to-many" },
      { source: "payments", sourceColumn: "order_id", target: "orders", targetColumn: "id", type: "one-to-many" },
    ],
  },
  {
    id: "saas",
    name: "SaaS / Multi-tenant",
    description: "Organizations, users, memberships, subscriptions.",
    tags: ["users", "auth", "billing"],
    tables: [
      {
        name: "users",
        columns: [
          T.uuidPk,
          { name: "email", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "name", type: "VARCHAR" },
          { name: "password_hash", type: "VARCHAR" },
          T.createdAt,
        ],
      },
      {
        name: "organizations",
        comment: "Tenant boundary.",
        columns: [
          T.uuidPk,
          { name: "name", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "slug", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          T.createdAt,
        ],
      },
      {
        name: "memberships",
        comment: "User ↔ organization with role.",
        columns: [
          T.uuidPk,
          { name: "user_id", type: "UUID", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "organization_id", type: "UUID", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "role", type: "VARCHAR", constraints: ["NOT NULL"], defaultValue: "'member'", comment: "owner|admin|member" },
          T.createdAt,
        ],
      },
      {
        name: "subscriptions",
        columns: [
          T.uuidPk,
          { name: "organization_id", type: "UUID", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "plan", type: "VARCHAR", constraints: ["NOT NULL"], comment: "free|pro|enterprise" },
          { name: "status", type: "VARCHAR", constraints: ["NOT NULL"], defaultValue: "'active'" },
          { name: "current_period_end", type: "TIMESTAMP" },
          T.createdAt,
        ],
      },
      {
        name: "api_keys",
        columns: [
          T.uuidPk,
          { name: "organization_id", type: "UUID", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "name", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "key_hash", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "last_used_at", type: "TIMESTAMP" },
          T.createdAt,
        ],
      },
    ],
    relations: [
      { source: "memberships", sourceColumn: "user_id", target: "users", targetColumn: "id", type: "one-to-many" },
      { source: "memberships", sourceColumn: "organization_id", target: "organizations", targetColumn: "id", type: "one-to-many" },
      { source: "subscriptions", sourceColumn: "organization_id", target: "organizations", targetColumn: "id", type: "one-to-many" },
      { source: "api_keys", sourceColumn: "organization_id", target: "organizations", targetColumn: "id", type: "one-to-many" },
    ],
  },
  {
    id: "blog",
    name: "Blog / CMS",
    description: "Authors, posts, comments, tags.",
    tags: ["content", "cms"],
    tables: [
      {
        name: "authors",
        columns: [
          T.pk,
          { name: "email", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "display_name", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "bio", type: "TEXT" },
          T.createdAt,
        ],
      },
      {
        name: "posts",
        columns: [
          T.pk,
          { name: "author_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "slug", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "title", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "body", type: "TEXT", constraints: ["NOT NULL"] },
          { name: "published_at", type: "TIMESTAMP" },
          T.createdAt,
          T.updatedAt,
        ],
      },
      {
        name: "tags",
        columns: [
          T.pk,
          { name: "name", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "slug", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
        ],
      },
      {
        name: "post_tags",
        comment: "Many-to-many join.",
        columns: [
          { name: "post_id", type: "INT", constraints: ["PRIMARY KEY", "REFERENCES"] },
          { name: "tag_id", type: "INT", constraints: ["PRIMARY KEY", "REFERENCES"] },
        ],
      },
      {
        name: "comments",
        columns: [
          T.pk,
          { name: "post_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "author_email", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "body", type: "TEXT", constraints: ["NOT NULL"] },
          T.createdAt,
        ],
      },
    ],
    relations: [
      { source: "posts", sourceColumn: "author_id", target: "authors", targetColumn: "id", type: "one-to-many" },
      { source: "comments", sourceColumn: "post_id", target: "posts", targetColumn: "id", type: "one-to-many" },
      { source: "post_tags", sourceColumn: "post_id", target: "posts", targetColumn: "id", type: "many-to-many" },
      { source: "post_tags", sourceColumn: "tag_id", target: "tags", targetColumn: "id", type: "many-to-many" },
    ],
  },
  {
    id: "auth",
    name: "Auth (NextAuth-style)",
    description: "Users, accounts, sessions, verification tokens.",
    tags: ["auth", "users"],
    tables: [
      {
        name: "users",
        columns: [
          T.uuidPk,
          { name: "email", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "email_verified", type: "TIMESTAMP" },
          { name: "name", type: "VARCHAR" },
          { name: "image", type: "VARCHAR" },
          { name: "password_hash", type: "VARCHAR" },
          T.createdAt,
        ],
      },
      {
        name: "accounts",
        comment: "OAuth provider links.",
        columns: [
          T.uuidPk,
          { name: "user_id", type: "UUID", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "provider", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "provider_account_id", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "access_token", type: "TEXT" },
          { name: "refresh_token", type: "TEXT" },
          { name: "expires_at", type: "INT" },
        ],
      },
      {
        name: "sessions",
        columns: [
          T.uuidPk,
          { name: "user_id", type: "UUID", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "session_token", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "expires", type: "TIMESTAMP", constraints: ["NOT NULL"] },
        ],
      },
      {
        name: "verification_tokens",
        columns: [
          { name: "identifier", type: "VARCHAR", constraints: ["PRIMARY KEY", "NOT NULL"] },
          { name: "token", type: "VARCHAR", constraints: ["PRIMARY KEY", "NOT NULL"] },
          { name: "expires", type: "TIMESTAMP", constraints: ["NOT NULL"] },
        ],
      },
    ],
    relations: [
      { source: "accounts", sourceColumn: "user_id", target: "users", targetColumn: "id", type: "one-to-many" },
      { source: "sessions", sourceColumn: "user_id", target: "users", targetColumn: "id", type: "one-to-many" },
    ],
  },
  {
    id: "inventory",
    name: "Inventory / Warehouse",
    description: "Suppliers, products, warehouses, stock movements.",
    tags: ["stock", "logistics"],
    tables: [
      {
        name: "suppliers",
        columns: [
          T.pk,
          { name: "name", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "contact_email", type: "VARCHAR" },
          T.createdAt,
        ],
      },
      {
        name: "products",
        columns: [
          T.pk,
          { name: "supplier_id", type: "INT", constraints: ["REFERENCES"] },
          { name: "sku", type: "VARCHAR", constraints: ["NOT NULL", "UNIQUE"] },
          { name: "name", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "unit_cost_cents", type: "INT", constraints: ["NOT NULL"] },
        ],
      },
      {
        name: "warehouses",
        columns: [
          T.pk,
          { name: "name", type: "VARCHAR", constraints: ["NOT NULL"] },
          { name: "city", type: "VARCHAR" },
        ],
      },
      {
        name: "stock_levels",
        comment: "Per-warehouse on-hand quantity.",
        columns: [
          T.pk,
          { name: "product_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "warehouse_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "quantity", type: "INT", constraints: ["NOT NULL"], defaultValue: "0" },
        ],
      },
      {
        name: "stock_movements",
        comment: "Append-only ledger of inbound/outbound moves.",
        columns: [
          T.pk,
          { name: "product_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "warehouse_id", type: "INT", constraints: ["NOT NULL", "REFERENCES"] },
          { name: "delta", type: "INT", constraints: ["NOT NULL"], comment: "Positive = inbound, negative = outbound." },
          { name: "reason", type: "VARCHAR" },
          T.createdAt,
        ],
      },
    ],
    relations: [
      { source: "products", sourceColumn: "supplier_id", target: "suppliers", targetColumn: "id", type: "one-to-many" },
      { source: "stock_levels", sourceColumn: "product_id", target: "products", targetColumn: "id", type: "one-to-many" },
      { source: "stock_levels", sourceColumn: "warehouse_id", target: "warehouses", targetColumn: "id", type: "one-to-many" },
      { source: "stock_movements", sourceColumn: "product_id", target: "products", targetColumn: "id", type: "one-to-many" },
      { source: "stock_movements", sourceColumn: "warehouse_id", target: "warehouses", targetColumn: "id", type: "one-to-many" },
    ],
  },
];

function genId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000)}`;
}

const GRID_X = 320;
const GRID_Y = 280;
const COLS = 3;

export function templateToSchema(template: SchemaTemplate): Schema {
  const tableIdByName = new Map<string, string>();
  const colIdByTableCol = new Map<string, Map<string, string>>();

  const tables: Table[] = template.tables.map((t, i) => {
    const tableId = genId("tbl");
    tableIdByName.set(t.name, tableId);

    const colMap = new Map<string, string>();
    const columns: Column[] = t.columns.map((c) => {
      const colId = genId("col");
      colMap.set(c.name, colId);
      return {
        id: colId,
        name: c.name,
        type: c.type,
        constraints: [...(c.constraints ?? [])],
        comment: c.comment ?? "",
        defaultValue: c.defaultValue,
      };
    });
    colIdByTableCol.set(t.name, colMap);

    return {
      id: tableId,
      name: t.name,
      color: TABLE_COLORS[i % TABLE_COLORS.length],
      columns,
      indexes: [],
      comment: t.comment ?? "",
      position: { x: (i % COLS) * GRID_X + 60, y: Math.floor(i / COLS) * GRID_Y + 60 },
    };
  });

  const relations: Relation[] = template.relations
    .map((r) => {
      const sId = tableIdByName.get(r.source);
      const tId = tableIdByName.get(r.target);
      const sc = colIdByTableCol.get(r.source)?.get(r.sourceColumn);
      const tc = colIdByTableCol.get(r.target)?.get(r.targetColumn);
      if (!sId || !tId || !sc || !tc) return null;
      return {
        id: genId("rel"),
        sourceTable: sId,
        sourceColumn: sc,
        targetTable: tId,
        targetColumn: tc,
        type: r.type,
      };
    })
    .filter((r): r is Relation => r !== null);

  return { tables, relations };
}
