"use client";

import * as mdi from "@mdi/js";
import Image from "next/image";
import { ChangeEvent, ReactNode, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/icon";
import { createProduct, updateProduct } from "@/src/lib/api/products-api";

import { CreateProductBody, CreateProductImage, ProductRow } from "@/src/lib/domain/product/product.types";
import {
  deleteProductFromGraph,
  fetchMarketplaceProductById,
  fetchMarketplaceProducts,
  getMediaItemById,
  listMediaLibraryItems,
  publishProductToEdge,
  updateProductNeverPublishInGraph,
  updateProductStatusInGraph,
  uploadImageToMediaLibrary,
  waitForPublishCompletion,
} from "@/src/lib/marketplace-client";
import { useMarketplace } from "@/src/providers/MarketplaceProvider";

const PAGE_SIZE = 10;
const STATUS_ALL = "all";
const STATUS_COMPLETE = "complete";
const STATUS_DRAFT = "draft";
const STATUS_OPTIONS = [STATUS_ALL, STATUS_DRAFT, STATUS_COMPLETE] as const;
const DEFAULT_PRODUCT_LANGUAGE = "en";
const PRODUCT_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ja-JP", label: "Japanese" },
  { value: "vi-VN", label: "Vietnamese" },
  { value: "es-MX", label: "Spanish (Mexico)" },
  { value: "fr-FR", label: "French" },
  { value: "ko-KR", label: "Korean" },
] as const;
const PRODUCT_FOLDER_ITEM_ID = "{3F757534-28A6-43F3-9DEA-6DF92C6FFCC2}";
const MEDIA_LIBRARY_FOLDER_ID = "{FE08FD99-630B-4A0D-94D7-8767562AA0FC}";
/** Experience Edge `item(path: …)` for `ListMediaUrls` (public `url.url` on children). Override via env. */
const MEDIA_LIBRARY_EDGE_FOLDER_PATH = "/sitecore/media library/Project/sai-sitecore/sai-sitecore";
const EDGE_PUBLISH_LANGUAGES = ["en", "ja-JP", "vi-VN", "es-MX", "fr-FR", "ko-KR"] as const;
type AlertVariant = "default" | "destructive";
type ToastVariant = "success" | "error";

const DEFAULT_CREATE_FORM: CreateProductBody = {
  language: DEFAULT_PRODUCT_LANGUAGE,
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
  if (value === "approved" || value === "approve" || value === "complete") return STATUS_COMPLETE;
  if (value === "draft") return STATUS_DRAFT;
  return STATUS_DRAFT;
}

function getStatusBadgeColor(status: string): "success" | "warning" | "primary" | "neutral" {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === STATUS_COMPLETE) return "success";
  if (normalizedStatus === STATUS_DRAFT) return "primary";
  return "neutral";
}

function getStatusLabel(status: string): string {
  return normalizeStatus(status).toUpperCase();
}

function getProductLanguageLabel(language: string): string {
  return (
    PRODUCT_LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ??
    language
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

function getCreatedDateTimestamp(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;

  const sitecoreMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (sitecoreMatch) {
    const [, year, month, day, hour, minute, second] = sitecoreMatch;
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function formatSitecoreMultilistValue(itemIds: string[]): string {
  return itemIds.join("|");
}

function isMissingOrdercloudId(value?: string): boolean {
  const normalizedValue = value?.trim();
  return !normalizedValue || normalizedValue?.length === 0|| normalizedValue === "N/A";
}

function normalizeMediaItemId(value: string): string {
  return value.replace(/[{}-]/g, "").toUpperCase();
}

function buildMediaUploadItemPath(folderPath: string, fileName: string): string {
  const normalizedFileName = fileName
    .trim()
    .replace(/[\\/:?"<>|\[\]]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[.\- ]+|[.\- ]+$/g, "") || "uploaded-file";
  const normalizedFolder = folderPath.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return normalizedFolder ? `${normalizedFolder}/${normalizedFileName}` : normalizedFileName;
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

function PickerActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-sidebar-border bg-white px-4 text-sm font-medium text-body-text shadow-[0_10px_25px_rgba(15,23,42,0.08)] transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
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

interface PendingLocalPublishProduct {
  id?: string;
  modelName: string;
}

interface PendingDeleteProduct {
  id: string;
  modelName: string;
  ordercloudId?: string;
  language: string;
}

interface ToastState {
  message: string;
  variant: ToastVariant;
}

const SelectedMediaLibraryGrid = memo(function SelectedMediaLibraryGrid({
  items,
  isBusy,
  onRemove,
}: {
  items: MediaLibraryOption[];
  isBusy: boolean;
  onRemove: (itemId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.itemId}
          className="overflow-hidden rounded-2xl border border-sidebar-border bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
        >
          <div className="relative aspect-[4/3] overflow-hidden bg-muted">
            <div className="absolute left-1.5 top-1.5 z-10 rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
              Linked
            </div>
            <MediaLibraryPickThumb src={item.previewUrl} label={item.name} />
          </div>
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-body-text">{item.name}</p>
              <p className="truncate text-xs text-subtle-text">{item.path}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onRemove(item.itemId)} disabled={isBusy}>
              <Icon path={mdi.mdiTrashCanOutline} className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
});

function MediaLibraryPickThumb({ src, label }: { src?: string; label: string }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const imageSrc = src?.trim();

  useEffect(() => {
    setLoadFailed(false);
  }, [imageSrc]);

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
    return null;
  }

  return (
    <div className="space-y-3">
      {selectedImages.map((image, index) => (
        <div
          key={`${image.fileName}-${index}`}
          className="flex items-center gap-3 rounded-2xl border border-sidebar-border bg-white px-3 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
        >
          <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-muted">
            <ProductThumb src={image.previewUrl} alt={image.fileName} className="h-full w-full object-cover" />
          </div>
          <Input
            value={image.fileName}
            readOnly
            className="h-10 flex-1 rounded-xl border-sidebar-border bg-white text-sm"
          />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" disabled>
              <Icon path={mdi.mdiArrowUpThin} className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" disabled>
              <Icon path={mdi.mdiCloudUploadOutline} className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onRemove(index)}
              disabled={isProcessingImages || isCreating || isUploadingToMediaLibrary}
            >
              <Icon path={mdi.mdiTrashCanOutline} className="h-4 w-4" />
            </Button>
          </div>
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
  onEditRow,
  onDeleteRow,
}: {
  isFetching: boolean;
  paginatedRows: ProductRow[];
  visibleRowsLength: number;
  pageStartIndex: number;
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onEditRow: (row: ProductRow) => void;
  onDeleteRow: (row: ProductRow) => void;
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
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
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
                    <td
                      className="px-4 py-3"
                      dangerouslySetInnerHTML={{ __html: row.description }}
                    />
                    <td className="px-4 py-3">{formatPrice(row.price)}</td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-4 py-3">
                      <Badge colorScheme={getStatusBadgeColor(row.status)}>
                        {getStatusLabel(row.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onEditRow(row)}>
                          Update
                        </Button>
                        <Button type="button" variant="outline" size="sm" colorScheme="danger" onClick={() => onDeleteRow(row)}>
                          Delete
                        </Button>
                      </div>
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

function extractMutationProductId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;

  const candidates = [data.id, data.itemId, data.productId, root.id, root.itemId, root.productId];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  return undefined;
}

export default function ProductPage() {
  const { client, isInitialized, isLoading } = useMarketplace();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [modelFilter, setModelFilter] = useState("");
  const [pendingModelFilter, setPendingModelFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState(DEFAULT_PRODUCT_LANGUAGE);
  const [pendingLanguageFilter, setPendingLanguageFilter] = useState(DEFAULT_PRODUCT_LANGUAGE);
  const [statusFilter, setStatusFilter] = useState(STATUS_ALL);
  const [pendingStatusFilter, setPendingStatusFilter] = useState(STATUS_ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isSwitchingEditLanguage, setIsSwitchingEditLanguage] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProductBody>(DEFAULT_CREATE_FORM);
  const [selectedImages, setSelectedImages] = useState<PendingImage[]>([]);
  const [mediaLibraryOptions, setMediaLibraryOptions] = useState<MediaLibraryOption[]>([]);
  const [selectedMediaItemIds, setSelectedMediaItemIds] = useState<string[]>([]);
  const [selectedMediaItems, setSelectedMediaItems] = useState<MediaLibraryOption[]>([]);
  const [isMediaLibraryLoading, setIsMediaLibraryLoading] = useState(false);
  const [isUploadingToMediaLibrary, setIsUploadingToMediaLibrary] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageVariant, setMessageVariant] = useState<AlertVariant>("default");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingLocalPublishProduct, setPendingLocalPublishProduct] = useState<PendingLocalPublishProduct | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<PendingDeleteProduct | null>(null);
  const [isLocalPublishConfirmOpen, setIsLocalPublishConfirmOpen] = useState(false);
  const [isSubmittingLocalPublish, setIsSubmittingLocalPublish] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const createModalContentRef = useRef<HTMLDivElement>(null);
  const productImagesInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreateModalBusy =
    isCreating || isProcessingImages || isUploadingToMediaLibrary || isMediaLibraryLoading || isSwitchingEditLanguage;
  const hasCreatedPendingPublish = !editingProduct && Boolean(pendingLocalPublishProduct?.id);
  const canShowPublishActions =
    Boolean(pendingLocalPublishProduct) &&
    (!editingProduct || normalizeStatus(editingProduct.status) === STATUS_DRAFT);
  const selectedProductLanguageLabel = getProductLanguageLabel(createForm.language);
  const canEditPriceAndQuantity = !editingProduct || createForm.language === DEFAULT_PRODUCT_LANGUAGE;

  function showMessage(text: string, variant: AlertVariant = "default") {
    setMessageVariant(variant);
    setMessage(text);
  }

  function clearMessage() {
    setMessage(null);
    setMessageVariant("default");
  }

  function showToast(message: string, variant: ToastVariant = "success") {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }

  function closeLocalPublishConfirm() {
    setIsLocalPublishConfirmOpen(false);
  }

  function closeDeleteConfirm() {
    setIsDeleteConfirmOpen(false);
  }

  function resetProductModalState() {
    setEditingProduct(null);
    setPendingLocalPublishProduct(null);
    setIsLocalPublishConfirmOpen(false);
    setPendingDeleteProduct(null);
    setIsDeleteConfirmOpen(false);
    setCreateForm(DEFAULT_CREATE_FORM);
    setSelectedMediaItemIds([]);
    setSelectedMediaItems([]);
    clearSelectedImages();
  }

  function handleCreateModalOpenChange(open: boolean) {
    clearMessage();
    if (open) {
      setMediaLibraryOptions([]);
    } else {
      resetProductModalState();
    }
    setIsCreateModalOpen(open);
  }

  function handleOpenCreateModal() {
    clearMessage();
    setEditingProduct(null);
    setPendingLocalPublishProduct(null);
    setCreateForm(DEFAULT_CREATE_FORM);
    setSelectedMediaItemIds([]);
    setSelectedMediaItems([]);
    clearSelectedImages();
    setMediaLibraryOptions([]);
    setIsCreateModalOpen(true);
  }

  async function handleOpenUpdateModal(product: ProductRow) {
    clearMessage();
    const updateLanguage = languageFilter || DEFAULT_PRODUCT_LANGUAGE;
    const mediaItemIds = product.mediaItemIds ?? [];
    setEditingProduct(product);
    setPendingLocalPublishProduct({
      id: product.id,
      modelName: product.modelName,
    });
    setCreateForm({
      language: updateLanguage,
      model_name: product.modelName,
      desc: product.description,
      category: "",
      catalog: "",
      price: product.price,
      quantity: product.quantity,
    });
    setSelectedMediaItemIds(mediaItemIds);
    setSelectedMediaItems([]);
    clearSelectedImages();
    setMediaLibraryOptions([]);
    setIsCreateModalOpen(true);
    await syncSelectedMediaItems(mediaItemIds);
    if (updateLanguage !== (product.language || DEFAULT_PRODUCT_LANGUAGE)) {
      await handleEditLanguageChange(updateLanguage);
    }
  }

  async function handleEditLanguageChange(language: string) {
    if (!editingProduct || !client || !isInitialized) return;
    const currentEditingProduct = editingProduct;

    setIsSwitchingEditLanguage(true);
    clearMessage();
    try {
      const localizedProduct = await fetchMarketplaceProductById(client, {
        itemId: currentEditingProduct.id,
        language,
      });

      if (!localizedProduct) {
        throw new Error(`No product data found for language ${language}.`);
      }

      const resolvedPrice =
        localizedProduct.price === 0 ? currentEditingProduct.price : localizedProduct.price;
      const resolvedQuantity =
        localizedProduct.quantity === 0 ? currentEditingProduct.quantity : localizedProduct.quantity;
      const resolvedOrdercloudId =
        isMissingOrdercloudId(localizedProduct.ordercloud_id)
          ? currentEditingProduct.ordercloud_id
          : localizedProduct.ordercloud_id;
      const resolvedMediaItemIds =
        !localizedProduct.mediaItemIds || localizedProduct.mediaItemIds.length === 0
          ? currentEditingProduct.mediaItemIds ?? []
          : localizedProduct.mediaItemIds;
      

      setEditingProduct((prev) =>
        prev
          ? {
              ...prev,
              ...localizedProduct,
              language,
              ordercloud_id: resolvedOrdercloudId,
              mediaItemIds: resolvedMediaItemIds,
            }
          : prev
      );
      setCreateForm((prev) => ({
        ...prev,
        language,
        model_name: localizedProduct.modelName === 'N/A' ? '' : localizedProduct.modelName,
        desc: localizedProduct.description?.includes('N/A') ? '' : localizedProduct.description, 
        price: resolvedPrice,
        quantity: resolvedQuantity,
      }));

      setSelectedMediaItemIds(resolvedMediaItemIds);
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to load product for selected language."), "destructive");
    } finally {
      setIsSwitchingEditLanguage(false);
    }
  }

  function handleOpenDeleteConfirm(product: ProductRow) {
    clearMessage();
    setPendingDeleteProduct({
      id: product.id,
      modelName: product.modelName,
      ordercloudId: product.ordercloud_id,
      language: product.language || DEFAULT_PRODUCT_LANGUAGE,
    });
    setIsDeleteConfirmOpen(true);
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

  const removeSelectedMediaItem = useCallback(function removeSelectedMediaItem(itemId: string) {
    const normalizedTargetId = normalizeMediaItemId(itemId);
    setSelectedMediaItemIds((prev) =>
      prev.filter((id) => normalizeMediaItemId(id) !== normalizedTargetId)
    );
    setSelectedMediaItems((prev) =>
      prev.filter((item) => normalizeMediaItemId(item.itemId) !== normalizedTargetId)
    );
    setEditingProduct((prev) =>
      prev
        ? {
            ...prev,
            mediaItemIds: (prev.mediaItemIds ?? []).filter(
              (id) => normalizeMediaItemId(id) !== normalizedTargetId,
            ),
          }
        : prev
    );
  }, []);

  async function handleLoadMediaLibrary({ quiet = false }: { quiet?: boolean } = {}) {
    if (!client || !isInitialized) {
      if (!quiet) {
        showMessage("Marketplace client is not ready to load media library.", "destructive");
      }
      return [];
    }
    if (!MEDIA_LIBRARY_FOLDER_ID) {
      if (!quiet) {
        showMessage("Missing NEXT_PUBLIC_SITECORE_MEDIA_LIBRARY_FOLDER_ID.", "destructive");
      }
      return [];
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
      if (!quiet) {
        showMessage(`Loaded ${items.length} images from media library.`);
      }
      return items;
    } catch (error) {
      if (!quiet) {
        showMessage(getErrorMessage(error, "Unable to load media library images."), "destructive");
      }
      return [];
    } finally {
      setIsMediaLibraryLoading(false);
    }
  }

  const toggleSelectedMediaItem = useCallback(function toggleSelectedMediaItem(itemId: string) {
    setSelectedMediaItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }, []);

  const syncSelectedMediaItems = useCallback(async function syncSelectedMediaItems(itemIds: string[]) {
    if (itemIds.length === 0) {
      setSelectedMediaItems([]);
      return;
    }

    const fromLoadedOptions = new Map(
      mediaLibraryOptions.map((item) => [normalizeMediaItemId(item.itemId), item] as const),
    );

    const resolved = new Map<string, MediaLibraryOption>();
    for (const itemId of itemIds) {
      const normalizedItemId = normalizeMediaItemId(itemId);
      const existing = fromLoadedOptions.get(normalizedItemId);
      if (existing) {
        resolved.set(normalizedItemId, existing);
      }
    }

    if (client && isInitialized) {
      const missingIds = itemIds.filter((itemId) => !resolved.has(normalizeMediaItemId(itemId)));
      if (missingIds.length > 0) {
        const fetched = await Promise.all(
          missingIds.map(async (itemId) => await getMediaItemById(client, itemId)),
        );

        for (const item of fetched) {
          if (item) {
            resolved.set(normalizeMediaItemId(item.itemId), item);
          }
        }
      }
    }

    const ordered = itemIds
      .map((itemId) => resolved.get(normalizeMediaItemId(itemId)))
      .filter((item): item is MediaLibraryOption => Boolean(item));

    setSelectedMediaItems(ordered);
  }, [client, isInitialized, mediaLibraryOptions]);

  const hasLoadedMediaLibraryOptions = mediaLibraryOptions.length > 0;

  async function handleLoadProducts({
    quiet = false,
    language,
    loadingMode,
  }: {
    quiet?: boolean;
    language?: string;
    loadingMode?: "search" | "filter" | "load";
  } = {}) {
    if (!client) {
      if (!quiet) showMessage("Marketplace client not ready.", "destructive");
      return;
    }

    setIsFetching(true);
    if (loadingMode === "search") setIsSearching(true);
    if (loadingMode === "filter") setIsFiltering(true);
    if (!quiet) clearMessage();

    try {
      const data = await fetchMarketplaceProducts(client, {
        language: language?.trim() || languageFilter,
      });
      setRows(data);
      setCurrentPage(1);
      if (!quiet) showMessage(`Loaded ${data.length} products from GraphQL.`);
    } catch (error) {
      if (!quiet) {
        showMessage(getErrorMessage(error, "Unable to query products."), "destructive");
      }
    } finally {
      setIsFetching(false);
      if (loadingMode === "search") setIsSearching(false);
      if (loadingMode === "filter") setIsFiltering(false);
    }
  }

  function handleSearchSubmit() {
    setModelFilter(pendingModelFilter);
    void handleLoadProducts({ language: languageFilter, loadingMode: "search" });
  }

  function handleFilterSubmit() {
    setLanguageFilter(pendingLanguageFilter);
    setStatusFilter(pendingStatusFilter);
    void handleLoadProducts({ language: pendingLanguageFilter, loadingMode: "filter" });
  }

  async function handleCreateProduct() {
    if (!createForm.model_name.trim()) {
      showMessage("Model name is required.", "destructive");
      return;
    }

    setIsCreating(true);
    clearMessage();
    try {
      let uploadedMediaItemIds: string[] = [];

      if (selectedImages.length > 0) {
        if (!client || !isInitialized) {
          throw new Error("Marketplace client is not ready to upload media.");
        }

        setIsUploadingToMediaLibrary(true);
        const uploaded = await Promise.all(
          selectedImages.map(async (image) => {
            return await uploadImageToMediaLibrary(client, {
              file: image.file,
              fileName: image.fileName,
            });
          }),
        );
        uploadedMediaItemIds = uploaded
          .map((item) => item.id)
          .filter((id): id is string => Boolean(id));
        setSelectedMediaItemIds((prev) => Array.from(new Set([...prev, ...uploadedMediaItemIds])));
      }

      const mergedMediaItemIds = Array.from(new Set([...selectedMediaItemIds, ...uploadedMediaItemIds]));
      const mediaItemIdsValue = formatSitecoreMultilistValue(mergedMediaItemIds);
      const normalizedModelName = createForm.model_name.trim();
      const payload: CreateProductBody = {
        ...createForm,
        model_name: normalizedModelName,
        category: createForm.category.trim(),
        catalog: createForm.catalog.trim(),
        price_name: `${normalizedModelName.replace(/\s+/g, "_")}_price`,
        desc: createForm.desc.trim() || "<p>No description</p>",
        images: selectedImages.map<CreateProductImage>((image) => ({
          fileName: image.fileName,
          mimeType: image.mimeType,
          contentBase64: image.contentBase64,
        })),
        MediaItemIds: mediaItemIdsValue || undefined,
      };

      let mutationResponse;
      if (editingProduct) {
        mutationResponse = await updateProduct(editingProduct.id, {
          ...payload,
          ordercloud_id: editingProduct.ordercloud_id,
        });
        if (!client || !isInitialized) {
          throw new Error("Marketplace client is not ready to update product status.");
        }
        await updateProductStatusInGraph(client, {
          itemId: editingProduct.id,
          status: "Draft",
          language: createForm.language,
        });
        setEditingProduct((prev) => (prev ? { ...prev, status: STATUS_DRAFT } : prev));
        setPendingLocalPublishProduct({
          id: editingProduct.id,
          modelName: normalizedModelName,
        });
      } else {
        mutationResponse = await createProduct(payload);
      }
      const resolvedProductId = editingProduct?.id ?? extractMutationProductId(mutationResponse);

      const wasEditingProduct = Boolean(editingProduct);
      clearSelectedImages();
      if (!wasEditingProduct) {
        setPendingLocalPublishProduct(null);
        handleCreateModalOpenChange(false);
      }
      clearMessage();
      showToast(
        wasEditingProduct
          ? resolvedProductId
            ? "Updated successfully."
            : "Updated successfully."
          : resolvedProductId
            ? "Created successfully."
            : "Created successfully.",
      );

      await handleLoadProducts({ quiet: true });
    } catch (createError) {
      showMessage(
        getErrorMessage(createError, editingProduct ? "Update product API failed." : "Create product API failed."),
        "destructive",
      );
    } finally {
      setIsUploadingToMediaLibrary(false);
      setIsCreating(false);
    }
  }

  async function handleDeleteProduct() {
    if (!pendingDeleteProduct) return;
    if (!client || !isInitialized) {
      showMessage("Marketplace client is not ready for web database publish.", "destructive");
      return;
    }

    const deletingProduct = pendingDeleteProduct;
    setIsDeletingProduct(true);
    clearMessage();
    try {
      if (deletingProduct.ordercloudId && deletingProduct.ordercloudId !== "N/A") {
        const orderCloudDeleteResponse = await fetch(
          `/api/ordercloud/products/${encodeURIComponent(deletingProduct.ordercloudId)}`,
          { method: "DELETE" },
        );
        const orderCloudDeleteData = (await orderCloudDeleteResponse.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!orderCloudDeleteResponse.ok) {
          throw new Error(orderCloudDeleteData.error || "Unable to delete product from OrderCloud.");
        }
      }

      await updateProductNeverPublishInGraph(client, {
        itemId: deletingProduct.id,
        language: languageFilter,
        value: true,
      });
      const publishResult = await publishProductToEdge(client, {
        itemId: deletingProduct.id,
        languages: [languageFilter],
        publishSubItems: false,
        publishRelatedItems: false,
      });
      await waitForPublishCompletion(client, {
        operationId: publishResult.operationId,
      });
      await deleteProductFromGraph(client, {
        itemId: deletingProduct.id,
      });

      if (editingProduct?.id === deletingProduct.id) {
        resetProductModalState();
        setIsCreateModalOpen(false);
      }

      closeDeleteConfirm();
      setPendingDeleteProduct(null);
      await handleLoadProducts({ quiet: true });
      clearMessage();
      showToast("Deleted and published successfully.");
    } catch (error) {
      showMessage(getErrorMessage(error, "Unable to delete product."), "destructive");
    } finally {
      setIsDeletingProduct(false);
    }
  }

  const visibleRows = useMemo(() => {
    const normalizedModel = modelFilter.trim().toLowerCase();

    const filteredRows = rows.filter((row) => {
      const matchesModel = !normalizedModel || row.modelName.toLowerCase().includes(normalizedModel);
      const normalizedStatus = normalizeStatus(row.status);
      const matchesStatus = statusFilter === STATUS_ALL || normalizedStatus === statusFilter;

      return matchesModel && matchesStatus;
    });

    return [...filteredRows].sort(
      (left, right) => getCreatedDateTimestamp(right.createdDate) - getCreatedDateTimestamp(left.createdDate),
    );
  }, [modelFilter, rows, statusFilter]);
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
  }, [modelFilter, statusFilter]);

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

  useEffect(() => {
    void syncSelectedMediaItems(selectedMediaItemIds);
  }, [selectedMediaItemIds, syncSelectedMediaItems]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed right-4 top-4 z-[80]">
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-[0_14px_40px_rgba(15,23,42,0.18)] ${
              toast.variant === "success" ? "bg-green-600" : "bg-destructive"
            }`}
            role="status"
            aria-live="polite"
          >
            <Icon
              path={toast.variant === "success" ? mdi.mdiCheckCircle : mdi.mdiAlertCircle}
              className="h-5 w-5"
            />
            <span>{toast.message}</span>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-body-text">Product Listing</h1>
      </section>

      <Card className="border-sidebar-border">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="md:ml-auto">
              <Button onClick={handleOpenCreateModal}>
                <Icon path={mdi.mdiPlus} className="mr-2 h-4 w-4" />
                Create New Product
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-xs">
              <Icon
                path={mdi.mdiMagnify}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-text"
              />
              <Input
                className="pl-9"
                placeholder="Search by model name"
                value={pendingModelFilter}
                onChange={(event) => setPendingModelFilter(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={handleSearchSubmit}
              disabled={isLoading || isSearching || !isInitialized}
            >
              {isSearching ? (
                <BlokLoader label="Searching..." />
              ) : (
                <>
                  <Icon path={mdi.mdiDatabaseSearch} className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12">
            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <p className="text-xs text-subtle-text">Language</p>
              <select
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm focus:ring-1 focus:outline-none"
                value={pendingLanguageFilter}
                onChange={(event) => setPendingLanguageFilter(event.target.value)}
              >
                {PRODUCT_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 md:col-span-2 lg:col-span-3">
              <p className="text-xs text-subtle-text">Status</p>
              <select
                className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm capitalize focus:ring-1 focus:outline-none"
                value={pendingStatusFilter}
                onChange={(event) => setPendingStatusFilter(event.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === STATUS_ALL ? "All status" : status === STATUS_COMPLETE ? "COMPLETE" : status.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end md:col-span-2 lg:col-span-2">
              <Button
                variant="outline"
                className="border-sidebar-border"
                onClick={handleFilterSubmit}
                disabled={isLoading || isFiltering || !isInitialized}
              >
                {isFiltering ? (
                  <BlokLoader label="Filtering..." />
                ) : (
                  <>
                    <Icon path={mdi.mdiFilterOutline} className="mr-2 h-4 w-4" />
                    Filter
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="text-sm text-subtle-text">
            Total {rows.length} | Filtered {visibleRows.length} | Page {currentPage}/{totalPages}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateModalOpen} onOpenChange={handleCreateModalOpenChange}>
        <DialogContent className="border-sidebar-border p-0 sm:max-w-6xl">
          <DialogHeader>
            <div className="border-b border-sidebar-border px-6 py-5">
              <DialogTitle className="text-xl font-semibold text-body-text">
                {editingProduct ? "Update Model" : "Add New Model"}
              </DialogTitle>
              <p className="mt-1 text-sm text-subtle-text">
                {editingProduct ? `Update ${editingProduct.modelName}` : "Create a new product model"}
              </p>
            </div>
          </DialogHeader>
          <div ref={createModalContentRef} className="max-h-[calc(100vh-14rem)] space-y-6 overflow-y-auto px-6 py-6">
            {isCreateModalBusy && (
              <div className="rounded-md border border-sidebar-border bg-neutral-bg px-3 py-2">
                <BlokLoader
                  label={
                    isCreating
                      ? editingProduct
                        ? "Saving changes..."
                        : "Creating product..."
                      : isSwitchingEditLanguage
                        ? "Loading product..."
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

            {canShowPublishActions ? (
              <div className="rounded-2xl border border-sidebar-border bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="rounded-md border border-sidebar-border bg-[#f7f5f2] px-3 py-2 text-sm text-subtle-text md:max-w-md">
                    Publish language: {selectedProductLanguageLabel}
                  </div>
                  <div className="md:ml-auto">
                    <Button
                      type="button"
                      onClick={() => setIsLocalPublishConfirmOpen(true)}
                      disabled={!pendingLocalPublishProduct?.id}
                    >
                      Publish to web
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <section className="overflow-hidden rounded-2xl border border-sidebar-border">
                  <div className="border-b border-sidebar-border px-5 py-3">
                    <h2 className="font-semibold text-body-text">Basic Information</h2>
                  </div>
                  <div className="space-y-5 px-5 py-5">
                    {editingProduct ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-body-text" htmlFor="product-language">
                          Language
                        </label>
                        <select
                          id="product-language"
                          className="border-input focus:border-primary focus:ring-primary h-10 w-full rounded-md border bg-body-bg px-3 text-sm focus:ring-1 focus:outline-none"
                          value={createForm.language}
                          onChange={(event) => {
                            const nextLanguage = event.target.value;
                            if (editingProduct) {
                              void handleEditLanguageChange(nextLanguage);
                              return;
                            }
                            setCreateForm((prev) => ({ ...prev, language: nextLanguage }));
                          }}
                          disabled={isCreateModalBusy || !editingProduct}
                        >
                          {PRODUCT_LANGUAGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className="space-y-2">
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

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
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
                          disabled={!canEditPriceAndQuantity}
                        />
                      </div>
                      <div className="space-y-2">
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
                          disabled={!canEditPriceAndQuantity}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-sidebar-border">
                  <div className="border-b border-sidebar-border px-5 py-3">
                    <h2 className="font-semibold text-body-text">Description</h2>
                  </div>
                  <div className="space-y-5 px-5 py-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-body-text" htmlFor="description">
                        Product details
                      </label>
                      <HtmlDescriptionEditor
                        value={createForm.desc}
                        onChange={(desc) => setCreateForm((prev) => ({ ...prev, desc }))}
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="overflow-hidden rounded-2xl border border-sidebar-border">
                  <div className="border-b border-sidebar-border px-5 py-3">
                    <h2 className="font-semibold text-body-text">Media</h2>
                  </div>
                  <div className="space-y-5 px-5 py-5">
                    {selectedMediaItemIds.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-body-text">
                          Selected media library images ({selectedMediaItemIds.length})
                        </p>
                        <SelectedMediaLibraryGrid
                          items={selectedMediaItems}
                          isBusy={isCreateModalBusy}
                          onRemove={removeSelectedMediaItem}
                        />
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-body-text" htmlFor="product-images">
                        Basic Model Image
                      </label>
                      <input
                        ref={productImagesInputRef}
                        id="product-images"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        disabled={isProcessingImages || isCreating}
                        className="hidden"
                      />
                      <div className="rounded-2xl border border-sidebar-border bg-[#f7f5f2] p-4">
                        <div className="flex flex-wrap gap-3">
                          <PickerActionButton
                            onClick={() => void handleLoadMediaLibrary()}
                            disabled={
                              isMediaLibraryLoading ||
                              isUploadingToMediaLibrary ||
                              isProcessingImages ||
                              isCreating ||
                              !isInitialized
                            }
                          >
                            <Icon path={mdi.mdiImageMultipleOutline} className="h-4 w-4" />
                            {isMediaLibraryLoading ? "Loading media..." : "Sitecore Media Library"}
                          </PickerActionButton>
                          <PickerActionButton
                            onClick={() => productImagesInputRef.current?.click()}
                            disabled={isProcessingImages || isCreating}
                          >
                            <Icon path={mdi.mdiTrayArrowUp} className="h-4 w-4" />
                            Click to upload images
                          </PickerActionButton>
                        </div>
                      </div>
                      {isProcessingImages ? <BlokLoader label="Preparing selected images..." /> : null}
                      <SelectedImagesGrid
                        selectedImages={selectedImages}
                        isProcessingImages={isProcessingImages}
                        isCreating={isCreating}
                        isUploadingToMediaLibrary={isUploadingToMediaLibrary}
                        onRemove={removeSelectedImage}
                      />
                      <p className="text-xs text-subtle-text">
                        Selected images are uploaded to Sitecore Media Library automatically when you click{" "}
                        {editingProduct ? "Save Changes." : "Create Model."}
                      </p>
                    </div>

                    {hasLoadedMediaLibraryOptions ? (
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
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-sidebar-border px-6 py-4">
            <Button
              variant="outline"
              className="border-sidebar-border"
              onClick={() => {
                resetProductModalState();
                handleCreateModalOpenChange(false);
              }}
              disabled={isCreateModalBusy}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={isCreateModalBusy || hasCreatedPendingPublish}>
              {isCreating ? (
                <BlokLoader label={editingProduct ? "Saving..." : "Creating..."} />
              ) : hasCreatedPendingPublish ? (
                "Created"
              ) : (
                <>
                  <Icon path={mdi.mdiPlus} className="mr-2 h-4 w-4" />
                  {editingProduct ? "Save Changes" : "Create Model"}
                </>
              )}
            </Button>
          </DialogFooter>

          {isLocalPublishConfirmOpen && pendingLocalPublishProduct ? (
            <div className="absolute inset-0 z-[60] flex items-start justify-center bg-black/35 px-4 py-16">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-body-text">Web publish</h2>
                    <p className="mt-1 text-sm text-subtle-text">
                      Publish <span className="font-medium text-body-text">{pendingLocalPublishProduct.modelName}</span> to Web database?
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={closeLocalPublishConfirm}>
                    <Icon path={mdi.mdiClose} className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-5 rounded-xl border border-sidebar-border bg-[#f7f5f2] px-4 py-3 text-sm text-subtle-text">
                  Language: <span className="font-medium text-body-text">{selectedProductLanguageLabel}</span>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeLocalPublishConfirm}
                    disabled={isSubmittingLocalPublish}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    onClick={async () => {
                      if (!pendingLocalPublishProduct.id) {
                        showMessage("Missing product item ID for edge publish.", "destructive");
                        return;
                      }

                      setIsSubmittingLocalPublish(true);
                      try {
                        if (!client || !isInitialized) {
                          throw new Error("Marketplace client is not ready for web database publish.");
                        }

                        await updateProductStatusInGraph(client, {
                          itemId: pendingLocalPublishProduct.id,
                          status: "Approved",
                          language: createForm.language,
                        });
                        const publishResult = await publishProductToEdge(client, {
                          itemId: pendingLocalPublishProduct.id,
                          languages: [...EDGE_PUBLISH_LANGUAGES],
                        });
                        await waitForPublishCompletion(client, {
                          operationId: publishResult.operationId,
                        });
                        setEditingProduct((prev) => (prev ? { ...prev, status: STATUS_COMPLETE } : prev));
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === pendingLocalPublishProduct.id ? { ...row, status: STATUS_COMPLETE } : row
                          ),
                        );
                        closeLocalPublishConfirm();
                        setPendingLocalPublishProduct(null);
                        clearMessage();
                        showToast("Submitted for web database publish.");
                      } catch (error) {
                        showMessage(getErrorMessage(error, "Unable to submit for web database publish."), "destructive");
                      } finally {
                        setIsSubmittingLocalPublish(false);
                      }
                    }}
                    disabled={isSubmittingLocalPublish}
                  >
                    {isSubmittingLocalPublish ? <BlokLoader label="Publishing..." /> : "Approve"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ProductTable
        isFetching={isFetching}
        paginatedRows={paginatedRows}
        visibleRowsLength={visibleRows.length}
        pageStartIndex={pageStartIndex}
        currentPage={currentPage}
        totalPages={totalPages}
        onPreviousPage={handlePreviousPage}
        onNextPage={handleNextPage}
        onEditRow={handleOpenUpdateModal}
        onDeleteRow={handleOpenDeleteConfirm}
      />

      {isDeleteConfirmOpen && pendingDeleteProduct ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/35 px-4 py-16">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-body-text">Delete Product</h2>
                <p className="mt-1 text-sm text-subtle-text">
                  Delete <span className="font-medium text-body-text">{pendingDeleteProduct.modelName}</span> and publish the change to Edge?
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={closeDeleteConfirm} disabled={isDeletingProduct}>
                <Icon path={mdi.mdiClose} className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 rounded-xl border border-sidebar-border bg-[#f7f5f2] px-4 py-3 text-sm text-subtle-text">
              Language: <span className="font-medium text-body-text">{getProductLanguageLabel(pendingDeleteProduct.language)}</span>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={closeDeleteConfirm} disabled={isDeletingProduct}>
                Cancel
              </Button>
              <Button type="button" colorScheme="danger" onClick={() => void handleDeleteProduct()} disabled={isDeletingProduct}>
                {isDeletingProduct ? <BlokLoader label="Deleting..." /> : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
