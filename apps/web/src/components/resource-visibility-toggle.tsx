import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { markResourcePrivate, setResourceVisibility } from "@/lib/resources";
import { useLocale } from "@/providers/locale-provider";

export function PublicResourceSwitch({
  checked,
  disabled = false,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange(checked: boolean): void;
}) {
  const id = useId();
  const { locale } = useLocale();
  const publicLabel = formatTranslation(
    "web.resources.visibility.public" as TranslationKey,
    {},
    locale,
  );
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
      <label className="text-sm font-medium" htmlFor={id}>
        {publicLabel}
      </label>
      <SwitchPrimitive.Root
        aria-label={publicLabel}
        checked={checked}
        className="flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-muted-foreground/35 p-0.5 outline-none transition-colors data-[checked]:bg-green-600 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:data-[checked]:bg-green-500"
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      >
        <SwitchPrimitive.Thumb className="size-5 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-5" />
      </SwitchPrimitive.Root>
    </div>
  );
}

export function ResourceVisibilityToggle({
  canAdminister,
  isAdminPrivate,
  isOwner,
  isPrivate,
  name,
  resourceId,
}: {
  canAdminister: boolean;
  isAdminPrivate: boolean;
  isOwner: boolean;
  isPrivate: boolean;
  name: string;
  resourceId: number;
}) {
  const { locale } = useLocale();
  const [isPublic, setIsPublic] = useState(!isPrivate);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const locked = isAdminPrivate && isOwner && !canAdminister;
  const t = (
    key: TranslationKey,
    params: Record<string, number | string> = {},
  ) => formatTranslation(key, params, locale);

  async function updateVisibility(nextPublic: boolean) {
    if (!nextPublic && canAdminister && !isOwner) {
      setReason("");
      dialogRef.current?.showModal();
      return;
    }

    setSaving(true);
    try {
      await setResourceVisibility({
        data: { isPublic: nextPublic, resourceId },
      });
      setIsPublic(nextPublic);
    } catch {
      toast.error(t("web.resources.error.editFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function submitAdminPrivate() {
    if (!reason.trim()) {
      toast.error(t("web.resources.moderation.reasonRequired"));
      return;
    }
    setSaving(true);
    try {
      await markResourcePrivate({
        data: { reason, resourceId },
      });
      setIsPublic(false);
      toast.success(t("web.resources.moderation.success", { name }));
      dialogRef.current?.close();
    } catch {
      toast.error(t("web.resources.moderation.failure"));
    } finally {
      setSaving(false);
    }
  }

  const toggle = (
    <PublicResourceSwitch
      checked={isPublic}
      disabled={locked || saving}
      onCheckedChange={(checked) => void updateVisibility(checked)}
    />
  );

  return (
    <>
      {locked ? (
        <Tooltip>
          <TooltipTrigger render={<div />}>{toggle}</TooltipTrigger>
          <TooltipContent side="top">
            {t(
              "web.resources.visibility.adminPrivateTooltip" as TranslationKey,
            )}
          </TooltipContent>
        </Tooltip>
      ) : (
        toggle
      )}
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50"
        ref={dialogRef}
      >
        <div className="grid gap-5 p-6">
          <div className="grid gap-2">
            <h2 className="m-0 text-xl font-semibold" id={titleId}>
              {t("web.resources.moderation.confirmationTitle")}
            </h2>
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.resources.moderation.confirmationDescription", { name })}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            {t("web.resources.moderation.reasonLabel")}
            <textarea
              className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("web.resources.moderation.reasonPlaceholder")}
              required
              value={reason}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              disabled={saving}
              onClick={() => dialogRef.current?.close()}
              type="button"
              variant="outline"
            >
              {t("action.cancel")}
            </Button>
            <Button
              disabled={saving || !reason.trim()}
              onClick={() => void submitAdminPrivate()}
              type="button"
              variant="destructive"
            >
              {t("web.resources.action.markPrivate")}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
