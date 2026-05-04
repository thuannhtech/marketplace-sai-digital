export interface ProductRow {
  id: string;
  modelName: string;
  description: string;
  ordercloud_id: string;
  price: number;
  quantity: number;
  status: string;
}

export interface CreateProductImage {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface CreateProductBody {
  model_name: string;
  desc: string;
  category: string;
  catalog: string;
  price: number;
  quantity: number;
  images?: CreateProductImage[];
  mediaItemIds?: string[];
}
