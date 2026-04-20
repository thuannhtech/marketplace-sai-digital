import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/lib/icon";
import { cn } from "@/lib/utils";
import { ProductItem } from "@/src/lib/theme/product-catalog";

interface ProductCardProps {
  product: ProductItem;
}

export function ProductCard({ product }: ProductCardProps) {
  const isPublished = product.status === "Published";

  return (
    <Card className="group border-sidebar-border transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sidebar-border bg-neutral-bg text-primary">
            <Icon path={product.icon} className="h-5 w-5" />
          </div>
          <Badge
            className={cn(
              "border-sidebar-border",
              isPublished ? "bg-success-background text-success-foreground" : "bg-warning-background text-warning-foreground",
            )}
          >
            {product.status}
          </Badge>
        </div>
        <CardTitle className="text-base text-body-text">{product.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-subtle-text">{product.description}</p>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-primary">{product.priceLabel}</span>
        <Button size="sm" variant="outline" className="border-sidebar-border bg-background">
          View details
        </Button>
      </CardFooter>
    </Card>
  );
}
