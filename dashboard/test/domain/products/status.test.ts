import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATALOG_SETTINGS,
  PRODUCT_SALE_STATUS_LABELS,
  PRODUCT_SALE_STATUSES,
  productSaleStatus,
} from "@/domain/products/status";

const sell = { sellWhenOutOfStock: true };
const keep = { sellWhenOutOfStock: false };
const product = { visible: true, available: true, stockQuantity: 12 };

describe("productSaleStatus", () => {
  it("en vente, rupture de stock selon le paramètre, indisponible, masqué", () => {
    expect(productSaleStatus(product, keep)).toBe("en_vente");
    expect(productSaleStatus({ ...product, stockQuantity: 0 }, keep)).toBe(
      "rupture",
    );
    // Le paramètre coché : un stock à 0 ne change pas le statut.
    expect(productSaleStatus({ ...product, stockQuantity: 0 }, sell)).toBe(
      "en_vente",
    );
    expect(productSaleStatus({ ...product, available: false }, sell)).toBe(
      "indisponible",
    );
    expect(
      productSaleStatus(
        { visible: false, available: false, stockQuantity: 0 },
        keep,
      ),
    ).toBe("masque");
  });

  it("par défaut, un stock à 0 est une rupture ; chaque statut a son libellé", () => {
    expect(DEFAULT_CATALOG_SETTINGS.sellWhenOutOfStock).toBe(false);
    expect(
      PRODUCT_SALE_STATUSES.map((s) => PRODUCT_SALE_STATUS_LABELS[s]),
    ).toEqual(["En vente", "Rupture de stock", "Indisponible", "Masqué"]);
  });
});
