import type { CatalogImageTrashItem } from "@package/services";
import { formatTranslation } from "@pocket-trash/localizations";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { restoreCatalogImage } from "@/lib/catalog-api";
import { useLocale } from "@/providers/locale-provider";

export function CatalogImageTrashPage({
  initialImages,
}: {
  initialImages: CatalogImageTrashItem[];
}) {
  const { locale } = useLocale();
  const [images, setImages] = useState(initialImages);
  const t = (
    key: Parameters<typeof formatTranslation>[0],
    values: Record<string, unknown> = {},
  ) => formatTranslation(key, values, locale);
  return (
    <AppShell title={t("web.resources.upload.imagesLabel")}>
      <main className="grid max-w-4xl gap-3 p-6">
        {images.map((image) => (
          <article
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
            key={`${image.targetType}-${image.id}`}
          >
            <img
              alt={t("web.resources.detail.imageAlt", { name: image.fileName })}
              className="size-20 rounded-md object-cover"
              src={image.url}
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{image.targetName}</h2>
              <p className="truncate text-sm text-muted-foreground">
                {image.fileName}
              </p>
            </div>
            <Button
              onClick={async () => {
                await restoreCatalogImage({
                  data: { imageId: image.id, targetType: image.targetType },
                });
                setImages((current) =>
                  current.filter(
                    (candidate) =>
                      candidate.id !== image.id ||
                      candidate.targetType !== image.targetType,
                  ),
                );
              }}
              type="button"
              variant="outline"
            >
              <RotateCcw />
              {t("web.resources.action.restore")}
            </Button>
          </article>
        ))}
      </main>
    </AppShell>
  );
}
