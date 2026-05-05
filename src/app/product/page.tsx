"use client";

import * as mdi from "@mdi/js";
import Image from "next/image";
import { ChangeEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Icon } from "@/lib/icon";
import { createProductWithWorkato } from "@/src/lib/api/workato-product-api";

import { CreateProductBody, CreateProductImage, ProductRow } from "@/src/lib/domain/product/product.types";
import {
  fetchMarketplaceProducts,
  listMediaLibraryItems,
  uploadImageToMediaLibrary,
} from "@/src/lib/marketplace-client";
import { useMarketplace } from "@/src/providers/MarketplaceProvider";

const PAGE_SIZE = 10;
const STATUS_ALL = "all";
const STATUS_APPROVE = "approve";
const STATUS_DRAFT = "draft";
const STATUS_AWAITING_APPROVAL = "awaiting approval";
const STATUS_OPTIONS = [STATUS_ALL, STATUS_APPROVE, STATUS_DRAFT, STATUS_AWAITING_APPROVAL] as const;
const MEDIA_LIBRARY_FOLDER_ID = "{FE08FD99-630B-4A0D-94D7-8767562AA0FC}";
/** Experience Edge `item(path: …)` for `ListMediaUrls` (public `url.url` on children). Override via env. */
const MEDIA_LIBRARY_EDGE_FOLDER_PATH =
  process.env.NEXT_PUBLIC_SITECORE_MEDIA_LIBRARY_EDGE_FOLDER_PATH?.trim() ||
  "/sitecore/media library/Project/sai-sitecore/sai-sitecore";
const MEDIA_LIBRARY_UPLOAD_PATH =
  process.env.NEXT_PUBLIC_SITECORE_MEDIA_LIBRARY_UPLOAD_PATH ?? "";
type AlertVariant = "default" | "destructive";

const DEFAULT_CREATE_FORM: CreateProductBody = {
  model_name: "",
  desc: "",
  category: "",
  catalog: "",
  price: 0,
  quantity: 0,
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeStatus(status: string): string {
  const value = status.trim().toLowerCase();
  if (value === "approved" || value === "approve") return STATUS_APPROVE;
  if (value === "draft") return STATUS_DRAFT;
  if (value === "awaiting approval" || value === "awaiting_approval") return STATUS_AWAITING_APPROVAL;
  return STATUS_DRAFT;
}

function getStatusBadgeColor(status: string): "success" | "warning" | "primary" | "neutral" {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === STATUS_APPROVE) return "success";
  if (normalizedStatus === STATUS_AWAITING_APPROVAL) return "warning";
  if (normalizedStatus === STATUS_DRAFT) return "primary";
  return "neutral";
}

function getStatusLabel(status: string): string {
  return normalizeStatus(status).toUpperCase();
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}


function formatSitecoreMultilistValue(itemIds: string[]): string {
  return itemIds.join("|");
}

function buildMediaUploadItemPath(folderPath: string, fileName: string): string {
  const normalizedFolder = folderPath.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return normalizedFolder ? `${normalizedFolder}/${fileName}` : fileName;
}

function BlokLoader({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-fg" aria-live="polite">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-bg-active border-t-primary"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function ProductThumb({
  src,
  alt,
  className,
  onError,
}: {
  src: string;
  alt: string;
  className: string;
  onError?: () => void;
}) {
  if (src.startsWith("blob:") || src.startsWith("data:")) {
    return <img src={src} alt={alt} className={className} onError={onError} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 50vw, 180px"
      className={className}
      unoptimized
      onError={onError}
    />
  );
}

interface PendingImage {
  file: File;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  previewUrl: string;
}

interface MediaLibraryOption {
  itemId: string;
  name: string;
  path: string;
  previewUrl?: string;
}

function MediaLibraryPickThumb({ src, label }: { src?: string; label: string }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const imageSrc = src?.trim();

  return (
    <div className="relative h-full min-h-[120px] w-full">
      {imageSrc && !loadFailed ? (
        <ProductThumb
          src={imageSrc}
          alt={label}
          className="h-full w-full object-cover"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 p-2 text-center">
          <Icon path={mdi.mdiImageOutline} className="h-10 w-10 text-subtle-text" />
          <span className="line-clamp-2 text-[11px] text-subtle-text">{label}</span>
        </div>
      )}
    </div>
  );
}

const SelectedImagesGrid = memo(function SelectedImagesGrid({
  selectedImages,
  isProcessingImages,
  isCreating,
  isUploadingToMediaLibrary,
  onRemove,
}: {
  selectedImages: PendingImage[];
  isProcessingImages: boolean;
  isCreating: boolean;
  isUploadingToMediaLibrary: boolean;
  onRemove: (index: number) => void;
}) {
  if (selectedImages.length === 0) {
    return <p className="text-xs text-subtle-text">No image selected.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {selectedImages.map((image, index) => (
        <div key={`${image.fileName}-${index}`} className="rounded-md border border-sidebar-border p-2">
          <div className="relative h-24 w-full overflow-hidden rounded-md">
            <ProductThumb
              src={image.previewUrl}
              alt={image.fileName}
              className="h-full w-full object-cover"
            />
          </div>
          <p className="mt-2 truncate text-xs text-subtle-text">{image.fileName}</p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mt-1"
            onClick={() => onRemove(index)}
            disabled={isProcessingImages || isCreating || isUploadingToMediaLibrary}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
});

const MediaLibraryGrid = memo(function MediaLibraryGrid({
  mediaLibraryOptions,
  selectedMediaItemIds,
  isCreateModalBusy,
  onToggle,
}: {
  mediaLibraryOptions: MediaLibraryOption[];
  selectedMediaItemIds: string[];
  isCreateModalBusy: boolean;
  onToggle: (itemId: string) => void;
}) {
  if (mediaLibraryOptions.length === 0) {
    return (
      <p className="text-xs text-subtle-text">
        No media items loaded. Click "Load Media Library Images".
      </p>
    );
  }

  return (
    <div className="max-h-96 overflow-auto rounded-md border border-sidebar-border p-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {mediaLibraryOptions.map((item) => {
          const selected = selectedMediaItemIds.includes(item.itemId);
          return (
            <label
              key={item.itemId}
              className={`group cursor-pointer overflow-hidden rounded-md border transition-colors ${
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-sidebar-border hover:bg-muted"
              }`}
            >
              <div className="relative aspect-square bg-muted">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(item.itemId)}
                  disabled={isCreateModalBusy}
                  className="absolute left-2 top-2 z-10 h-4 w-4 rounded border-sidebar-border"
                  aria-label={`Select ${item.name}`}
                />
                <MediaLibraryPickThumb src={item.previewUrl} label={item.name} />
              </div>
              <div className="space-y-0.5 p-2">
                <p className="truncate text-xs font-medium text-body-text">{item.name}</p>
                <p className="truncate text-[10px] text-subtle-text">{item.path}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
});

const ProductTable = memo(function ProductTable({
  isFetching,
  paginatedRows,
  visibleRowsLength,
  pageStartIndex,
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
}: {
  isFetching: boolean;
  paginatedRows: ProductRow[];
  visibleRowsLength: number;
  pageStartIndex: number;
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <Card className="border-sidebar-border">
      <CardContent className="p-0">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted">
              <tr className="border-b border-sidebar-border text-left">
                <th className="px-4 py-3 font-semibold">Model Name</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Quantity</th>
                <th className="px-4 py-3 font-semibold">Ordercloud ID</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isFetching ? (
                <tr>
                  <td className="px-4 py-8 text-center" colSpan={6}>
                    <BlokLoader label="Loading products..." />
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-subtle-text" colSpan={6}>
                    No products found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr key={row.id} className="border-b border-sidebar-border/70">
                    <td className="px-4 py-3 font-medium">{row.modelName}</td>
                    <td className="px-4 py-3">{row.description}</td>
                    <td className="px-4 py-3">{formatPrice(row.price)}</td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-4 py-3">{row.ordercloud_id}</td>
                    <td className="px-4 py-3">
                      <Badge colorScheme={getStatusBadgeColor(row.status)}>
                        {getStatusLabel(row.status)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-subtle-text">
            Showing {visibleRowsLength === 0 ? 0 : pageStartIndex + 1}-
            {Math.min(pageStartIndex + PAGE_SIZE, visibleRowsLength)} of {visibleRowsLength}
          </p>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={onPreviousPage}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-subtle-text">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={onNextPage}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

function HtmlDescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.innerHTML === value) return;
    editor.innerHTML = value;
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("URL");
    if (!url?.trim()) return;
    runCommand("createLink", url.trim());
  }

  return (
    <div className="overflow-hidden rounded-md border border-input bg-body-bg">
      <div className="flex flex-wrap gap-1 border-b border-input bg-muted p-1">
        <Button type="button" variant="ghost" size="icon" aria-label="Bold" onClick={() => runCommand("bold")}>
          <Icon path={mdi.mdiFormatBold} className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Italic" onClick={() => runCommand("italic")}>
          <Icon path={mdi.mdiFormatItalic} className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Bulleted list"
          onClick={() => runCommand("insertUnorderedList")}
        >
          <Icon path={mdi.mdiFormatListBulleted} className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Numbered list"
          onClick={() => runCommand("insertOrderedList")}
        >
          <Icon path={mdi.mdiFormatListNumbered} className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Link" onClick={addLink}>
          <Icon path={mdi.mdiLinkVariant} className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear formatting"
          onClick={() => runCommand("removeFormat")}
        >
          <Icon path={mdi.mdiFormatClear} className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={editorRef}
        id="description"
        className="min-h-32 w-full px-3 py-2 text-sm text-body-text outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        contentEditable
        data-placeholder="Write a short product description"
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        suppressContentEditableWarning
      />
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function ProductPage() {
  const { client, isInitialized, isLoading } = useMarketplace();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProductBody>(DEFAULT_CREATE_FORM);
  const [selectedImages, setSelectedImages] = useState<PendingImage[]>([]);
  const [mediaLibraryOptions, setMediaLibraryOptions] = useState<MediaLibraryOption[]>([]);
  const [selectedMediaItemIds, setSelectedMediaItemIds] = useState<string[]>([]);
  const [isMediaLibraryLoading, setIsMediaLibraryLoading] = useState(false);
  const [isUploadingToMediaLibrary, setIsUploadingToMediaLibrary] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageVariant, setMessageVariant] = useState<AlertVariant>("default");
  const createModalContentRef = useRef<HTMLDivElement>(null);
  const isCreateModalBusy =
    isCreating || isProcessingImages || isUploadingToMediaLibrary || isMediaLibraryLoading;

  function showMessage(text: string, variant: AlertVariant = "default") {
    setMessageVariant(variant);
    setMessage(text);
  }

  function clearMessage() {
    setMessage(null);
    setMessageVariant("default");
  }

  function handleCreateModalOpenChange(open: boolean) {
    clearMessage();
    if (open) {
      setMediaLibraryOptions([]);
    }
    setIsCreateModalOpen(open);
  }

  const clearSelectedImages = useCallback(function clearSelectedImages() {
    setSelectedImages((prev) => {
      for (const image of prev) URL.revokeObjectURL(image.previewUrl);
      return [];
    });
  }, []);

  async function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!files.length) return;

    setIsProcessingImages(true);
    try {
      const mappedImages = await Promise.all(
        files.map(async (file) => ({
          file,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64: await fileToBase64(file),
          previewUrl: URL.createObjectURL(file),
        }))
      );
      setSelectedImages((prev) => [...prev, ...mappedImages]);
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to process selected images."), "destructive");
    } finally {
      setIsProcessingImages(false);
      event.target.value = "";
    }
  }

  const removeSelectedImage = useCallback(function removeSelectedImage(index: number) {
    setSelectedImages((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  async function handleLoadMediaLibrary() {
    if (!client || !isInitialized) {
      showMessage("Marketplace client is not ready to load media library.", "destructive");
      return;
    }
    if (!MEDIA_LIBRARY_FOLDER_ID) {
      showMessage("Missing NEXT_PUBLIC_SITECORE_MEDIA_LIBRARY_FOLDER_ID.", "destructive");
      return;
    }

    setIsMediaLibraryLoading(true);
    try {
      const items = await listMediaLibraryItems(
        client,
        MEDIA_LIBRARY_FOLDER_ID,
        100,
        MEDIA_LIBRARY_EDGE_FOLDER_PATH,
      );
      setMediaLibraryOptions(items);
      showMessage(`Loaded ${items.length} images from media library.`);
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to load media library images."), "destructive");
    } finally {
      setIsMediaLibraryLoading(false);
    }
  }

  async function handleUploadSelectedImagesToMediaLibrary() {
    if (!client || !isInitialized) {
      showMessage("Marketplace client is not ready to upload media.", "destructive");
      return;
    }
    if (selectedImages.length === 0) {
      showMessage("Choose at least one image before uploading to media library.", "destructive");
      return;
    }

    setIsUploadingToMediaLibrary(true);
    try {
      const uploaded = await Promise.all(
        selectedImages.map(async (image) => {
          const uploadPath = buildMediaUploadItemPath(MEDIA_LIBRARY_UPLOAD_PATH, image.fileName);
          return await uploadImageToMediaLibrary(client, {
            itemPath: uploadPath,
            file: image.file,
            fileName: image.fileName,
          });
        })
      );

      const uploadedIds = uploaded.map((item) => item.id).filter((id): id is string => Boolean(id));
      if (uploadedIds.length > 0) {
        setSelectedMediaItemIds((prev) => Array.from(new Set([...prev, ...uploadedIds])));
      }

      showMessage(`Uploaded ${uploaded.length} image(s) to media library.`);
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to upload images to media library."), "destructive");
    } finally {
      setIsUploadingToMediaLibrary(false);
    }
  }

  const toggleSelectedMediaItem = useCallback(function toggleSelectedMediaItem(itemId: string) {
    setSelectedMediaItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }, []);

  async function handleLoadProducts({ quiet = false }: { quiet?: boolean } = {}) {
    if (!client) {
      if (!quiet) showMessage("Marketplace client not ready.", "destructive");
      return;
    }

    setIsFetching(true);
    if (!quiet) clearMessage();

    try {
      const data = await fetchMarketplaceProducts(client);
      setRows(data);
      setCurrentPage(1);
      if (!quiet) showMessage(`Loaded ${data.length} products from GraphQL.`);
    } catch (error) {
      if (!quiet) {
        showMessage(getErrorMessage(error, "Unable to query products."), "destructive");
      }
    } finally {
      setIsFetching(false);
    }
  }

  async function handleCreateProduct() {
    if (!createForm.model_name.trim()) {
      showMessage("Model name is required.", "destructive");
      return;
    }

    const mediaItemIdsValue = formatSitecoreMultilistValue(selectedMediaItemIds);
    const payload: CreateProductBody = {
      ...createForm,
      model_name: createForm.model_name.trim(),
      category: createForm.category.trim(),
      catalog: createForm.catalog.trim(),
      desc: createForm.desc.trim() || "<p>No description</p>",
      images: selectedImages.map<CreateProductImage>((image) => ({
        fileName: image.fileName,
        mimeType: image.mimeType,
        contentBase64: image.contentBase64,
      })),
      MediaItemIds: mediaItemIdsValue || undefined,
    };

    setIsCreating(true);
    clearMessage();
    try {
      await createProductWithWorkato(payload);
      setCreateForm(DEFAULT_CREATE_FORM);
      clearSelectedImages();
      setSelectedMediaItemIds([]);
      handleCreateModalOpenChange(false);
      await handleLoadProducts({ quiet: true });
    } catch (createError) {
      showMessage(getErrorMessage(createError, "Create product API failed."), "destructive");
    } finally {
      setIsCreating(false);
    }
  }

  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedCategory = categoryFilter.trim().toLowerCase();
    const normalizedModel = modelFilter.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesKeyword =
        !normalizedKeyword ||
        row.modelName.toLowerCase().includes(normalizedKeyword) ||
        row.description.toLowerCase().includes(normalizedKeyword) ||
        row.ordercloud_id.toLowerCase().includes(normalizedKeyword);
      const matchesCategory =
        !normalizedCategory || row.description.toLowerCase().includes(normalizedCategory);
      const matchesModel = !normalizedModel || row.modelName.toLowerCase().includes(normalizedModel);

      const normalizedStatus = normalizeStatus(row.status);
      const matchesStatus = statusFilter === STATUS_ALL || normalizedStatus === statusFilter;
      const matchesLanguage = languageFilter === "all" || languageFilter === "english";

      return matchesKeyword && matchesCategory && matchesModel && matchesStatus && matchesLanguage;
    });
  }, [categoryFilter, keyword, languageFilter, modelFilter, rows, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = visibleRows.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);
  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, keyword, languageFilter, modelFilter, statusFilter]);

  useEffect(() => {
    if (!hasAutoLoaded && isInitialized && client) {
      setHasAutoLoaded(true);
      void handleLoadProducts();
    }
  }, [client, hasAutoLoaded, isInitialized]);

  useEffect(() => {
    if (!message || !isCreateModalOpen) return;

    createModalContentRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [isCreateModalOpen, message]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-body-text">Product Listing</h1>
      </section>

      <Card className="border-sidebar-border">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-xs">
              <Icon
                path={mdi.mdiMagnify}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-text"
              />
              <Input
                className="pl-9"
                placeholder="Search by keyword"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={() => void handleLoadProducts()}
              disabled={isLoading || isFetching || !isInitialized}
            >
              {isFetching ? (
                <BlokLoader label="Searching..." />
              ) : (
                <>
                  <Icon path={mdi.mdiDatabaseSearch} className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
            <div className="md:ml-auto">
              <Button onClick={() => handleCreateModalOpenChange(true)}>
                <Icon path={mdi.mdiPlus} className="mr-2 h-4 w-4" />
                Create New Product
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <p className="text-xs text-subtle-text">Language</p>
              <select
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm focus:ring-1 focus:outline-none"
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
              >
                <option value="all">All languages</option>
                <option value="english">English (region)</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-subtle-text">Status</p>
              <select
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm capitalize focus:ring-1 focus:outline-none"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === STATUS_ALL ? "All status" : status.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={() => void handleLoadProducts()}
                disabled={isLoading || isFetching || !isInitialized}
              >
                {isFetching ? (
                  <BlokLoader label="Filtering..." />
                ) : (
                  <>
                    <Icon path={mdi.mdiDatabaseSearch} className="mr-2 h-4 w-4" />
                    Filter
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setKeyword("");
                  setStatusFilter(STATUS_ALL);
                  setCategoryFilter("");
                  setModelFilter("");
                  setLanguageFilter("all");
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="text-sm text-subtle-text">
            Total {rows.length} | Filtered {visibleRows.length} | Page {currentPage}/{totalPages}
          </div>
        </CardContent>
      </Card>

      <Sheet open={isCreateModalOpen} onOpenChange={handleCreateModalOpenChange}>
        <SheetContent
          ref={createModalContentRef}
          side="right"
          className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>Add New Model</SheetTitle>
            <SheetDescription>Create a new product model</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            {isCreateModalBusy && (
              <div className="rounded-md border border-sidebar-border bg-neutral-bg px-3 py-2">
                <BlokLoader
                  label={
                    isCreating
                      ? "Creating product..."
                      : isUploadingToMediaLibrary
                        ? "Uploading images..."
                        : isMediaLibraryLoading
                          ? "Loading media library..."
                          : "Processing images..."
                  }
                />
              </div>
            )}

            {message && (
              <Alert
                variant={messageVariant}
                className={messageVariant === "default" ? "border-sidebar-border bg-muted" : undefined}
              >
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-body-text" htmlFor="model-name">
                Model name
              </label>
              <Input
                id="model-name"
                value={createForm.model_name}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, model_name: event.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-body-text" htmlFor="price">
                  Price
                </label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={createForm.price}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, price: Number(event.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-body-text" htmlFor="quantity">
                  Quantity
                </label>
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  step="1"
                  value={createForm.quantity}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, quantity: Number(event.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-body-text" htmlFor="description">
                Description
              </label>
              <HtmlDescriptionEditor
                value={createForm.desc}
                onChange={(desc) => setCreateForm((prev) => ({ ...prev, desc }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-body-text" htmlFor="product-images">
                Product images (multiple)
              </label>
              <Input
                id="product-images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                disabled={isProcessingImages || isCreating}
              />
              {isProcessingImages ? <BlokLoader label="Preparing selected images..." /> : null}
              <SelectedImagesGrid
                selectedImages={selectedImages}
                isProcessingImages={isProcessingImages}
                isCreating={isCreating}
                isUploadingToMediaLibrary={isUploadingToMediaLibrary}
                onRemove={removeSelectedImage}
              />

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUploadSelectedImagesToMediaLibrary}
                  disabled={
                    isUploadingToMediaLibrary ||
                    isMediaLibraryLoading ||
                    isProcessingImages ||
                    isCreating ||
                    !isInitialized
                  }
                >
                  {isUploadingToMediaLibrary ? (
                    <BlokLoader label="Uploading..." />
                  ) : (
                    "Upload selected to Media Library"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadMediaLibrary}
                  disabled={
                    isMediaLibraryLoading ||
                    isUploadingToMediaLibrary ||
                    isProcessingImages ||
                    isCreating ||
                    !isInitialized
                  }
                >
                  {isMediaLibraryLoading ? (
                    <BlokLoader label="Loading..." />
                  ) : (
                    "Load Media Library Images"
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-body-text">
                Choose images from Media Library ({selectedMediaItemIds.length} selected)
              </p>
              <MediaLibraryGrid
                mediaLibraryOptions={mediaLibraryOptions}
                selectedMediaItemIds={selectedMediaItemIds}
                isCreateModalBusy={isCreateModalBusy}
                onToggle={toggleSelectedMediaItem}
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={() => {
                clearSelectedImages();
                setSelectedMediaItemIds([]);
                handleCreateModalOpenChange(false);
              }}
              disabled={isCreateModalBusy}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={isCreateModalBusy}>
              {isCreating ? (
                <BlokLoader label="Creating..." />
              ) : (
                <>
                  <Icon path={mdi.mdiPlus} className="mr-2 h-4 w-4" />
                  Create Model
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ProductTable
        isFetching={isFetching}
        paginatedRows={paginatedRows}
        visibleRowsLength={visibleRows.length}
        pageStartIndex={pageStartIndex}
        currentPage={currentPage}
        totalPages={totalPages}
        onPreviousPage={handlePreviousPage}
        onNextPage={handleNextPage}
      />
    </div>
  );
}
