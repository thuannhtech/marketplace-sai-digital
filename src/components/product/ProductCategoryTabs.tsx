import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductCategory } from "@/src/lib/theme/product-catalog";

interface ProductCategoryTabsProps {
  categories: ProductCategory[];
}

export function ProductCategoryTabs({ categories }: ProductCategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category, index) => (
        <Button
          key={category.id}
          variant={index === 0 ? "default" : "outline"}
          className="gap-2 border-sidebar-border"
        >
          {category.title}
          <Badge className="bg-background/70 text-subtle-text">
            {category.totalProducts}
          </Badge>
        </Button>
      ))}
    </div>
  );
}
