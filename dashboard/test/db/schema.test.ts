import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { ARTICLE_CATEGORIES } from "@/domain/articles/category";
import { ROLES } from "@/domain/auth/roles";
import { CANCELLATION_REASONS } from "@/domain/orders/cancellation";
import { ORDER_STATUSES } from "@/domain/orders/status";
import { CONTAINERS, PRODUCT_CATEGORIES } from "@/domain/products/category";

/*
 * Le schéma n'importe pas le domaine (drizzle-kit doit pouvoir le charger seul) :
 * ce test garantit que ses enums Postgres restent identiques aux constantes du
 * domaine, et que les tables attendues existent.
 */
describe("enums du schéma = constantes du domaine", () => {
  it.each([
    ["order_status", schema.orderStatusEnum.enumValues, ORDER_STATUSES],
    [
      "cancellation_reason",
      schema.cancellationReasonEnum.enumValues,
      CANCELLATION_REASONS,
    ],
    [
      "product_category",
      schema.productCategoryEnum.enumValues,
      PRODUCT_CATEGORIES,
    ],
    ["container", schema.containerEnum.enumValues, CONTAINERS],
    [
      "article_category",
      schema.articleCategoryEnum.enumValues,
      ARTICLE_CATEGORIES,
    ],
    ["user_role", schema.userRoleEnum.enumValues, ROLES],
  ])("%s", (_name, enumValues, domainValues) => {
    expect([...enumValues]).toEqual([...domainValues]);
  });

  it("product_unit couvre pièce et gramme", () => {
    expect([...schema.productUnitEnum.enumValues]).toEqual(["piece", "g"]);
  });
});

describe("tables", () => {
  it("expose les neuf tables du dashboard", () => {
    const names = [
      schema.users,
      schema.customers,
      schema.customerNotes,
      schema.products,
      schema.orders,
      schema.orderLines,
      schema.orderEvents,
      schema.articles,
      schema.engagementMonthly,
    ].map(getTableName);
    expect(names).toEqual([
      "users",
      "customers",
      "customer_notes",
      "products",
      "orders",
      "order_lines",
      "order_events",
      "articles",
      "engagement_monthly",
    ]);
  });
});
