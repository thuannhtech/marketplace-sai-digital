export interface ProductRow {
  id: string;
  language?: string;
  version?: number;
  modelName: string;
  description: string;
  ordercloud_id: string;
  price: number;
  quantity: number;
  status: string;
  createdDate?: string;
  mediaItemIds?: string[];
}

export interface CreateProductImage {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface CreateProductBody {
  language: string;
  model_name: string;
  desc: string;
  category: string;
  catalog: string;
  price: number;
  quantity: number;
  images?: CreateProductImage[];
  MediaItemIds?: string;
}
