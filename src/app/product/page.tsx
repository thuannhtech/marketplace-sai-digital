"use client";

import * as mdi from "@mdi/js";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/icon";
import { createHttpClient } from "@/src/lib/api/http-client";
import { fetchMarketplaceProducts, ProductRow } from "@/src/lib/marketplace/product-query";
import { useMarketplace } from "@/src/providers/MarketplaceProvider";

const fallbackRows: ProductRow[] = [
  {
    id: "fallback-iphone-15-pro",
    modelName: "iPhone 15 Pro",
    category: "Smartphones",
    catalog: "Electronics",
    price: 1199.99,
    quantity: 50,
    status: "published",
  },
  {
    id: "fallback-macbook-pro",
    modelName: "MacBook Pro M4",
    category: "Laptops",
    catalog: "Electronics",
    price: 2299,
    quantity: 20,
    status: "draft",
  },
];

interface CreateProductBody {
  model_name: string;
  desc: string;
  category: string;
  catalog: string;
  price: number;
  quantity: number;
}

const apiClient = createHttpClient();

async function createProduct(body: CreateProductBody) {
  const response = await apiClient.post("/api/products", body);
  return response.data;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ProductPage() {
  const { client, isInitialized, isLoading, error } = useMarketplace();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleLoadProducts() {
    if (!client) {
      setRows(fallbackRows);
      setMessage("Marketplace client not ready. Showing fallback data.");
      return;
    }

    setIsFetching(true);
    setMessage(null);

    try {
      const data = await fetchMarketplaceProducts(client);
      if (data.length > 0) {
        setRows(data);
        setMessage(`Loaded ${data.length} products from GraphQL.`);
      } else {
        setRows(fallbackRows);
        setMessage("No GraphQL products returned. Showing fallback data.");
      }
    } catch {
      setRows(fallbackRows);
      setMessage("Unable to query products. Showing fallback data.");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleCreateProduct() {
    const payload: CreateProductBody = {
      model_name: "test",
      desc: "<p>The latest Apple flagship smartphone with A17 Pro chip and titanium design.</p>",
      category: "Smartphones",
      catalog: "Electronics",
      price: 1199.99,
      quantity: 50,
    };

    setIsCreating(true);
    setMessage(null);
    try {
      await createProduct(payload);
      setMessage("Create product API called successfully.");
      await handleLoadProducts();
    } catch (createError) {
      const errorMessage =
        createError instanceof Error ? createError.message : "Create product API failed.";
      setMessage(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }

  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return rows;

    return rows.filter((row) => {
      return (
        row.modelName.toLowerCase().includes(normalizedKeyword) ||
        row.category.toLowerCase().includes(normalizedKeyword) ||
        row.catalog.toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [keyword, rows]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-body-text">Product Listing</h1>
        <p className="text-sm text-subtle-text">
          GraphQL product table from Sitecore Marketplace SDK and create-product API integration.
        </p>
      </section>

      <Card className="border-sidebar-border">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Icon
              path={mdi.mdiMagnify}
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-text"
            />
            <Input
              className="pl-9"
              placeholder="Search model/category/catalog"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={handleLoadProducts}
              disabled={isLoading || isFetching || !isInitialized}
            >
              <Icon path={mdi.mdiDatabaseSearch} className="mr-2 h-4 w-4" />
              {isFetching ? "Loading..." : "Load GraphQL"}
            </Button>
            <Button onClick={handleCreateProduct} disabled={isCreating}>
              <Icon path={mdi.mdiPlus} className="mr-2 h-4 w-4" />
              {isCreating ? "Creating..." : "Create Product"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {message ? (
        <div className="rounded-md border border-sidebar-border bg-muted px-3 py-2 text-sm text-subtle-text">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger-fg">
          {String(error)}
        </div>
      ) : null}

      <Card className="border-sidebar-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted">
                <tr className="border-b border-sidebar-border text-left">
                  <th className="px-4 py-3 font-semibold">Model Name</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Catalog</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Quantity</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-subtle-text" colSpan={6}>
                      No products yet. Click <strong>Load GraphQL</strong> to fetch data.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr key={row.id} className="border-b border-sidebar-border/70">
                      <td className="px-4 py-3 font-medium">{row.modelName}</td>
                      <td className="px-4 py-3 text-subtle-text">{row.category}</td>
                      <td className="px-4 py-3 text-subtle-text">{row.catalog}</td>
                      <td className="px-4 py-3">{formatPrice(row.price)}</td>
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">
                        <Badge
                          colorScheme={row.status.toLowerCase() === "published" ? "success" : "warning"}
                        >
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
