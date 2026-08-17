"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettings } from "./actions";

export interface SettingsFormValues {
  firstDayRate: number;
  dailyRate: number;
  depositAmount: number;
  batteryDailyRate: number;
  deliveryFeeModel: "flat" | "per_mile";
  deliveryFeeFlat: number | null;
  deliveryFeePerMile: number | null;
  serviceRadiusMiles: number;
  minRentalDays: number;
  holdWindowHours: number;
  venmoUsername: string;
  contactPhone: string;
  cancellationPolicyText: string;
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
        {props.label}
      </Label>
      {props.children}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const [values, setValues] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof SettingsFormValues>(
    key: K,
    value: SettingsFormValues[K]
  ) {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await updateSettings({
            ...values,
            deliveryFeeFlat: values.deliveryFeeFlat ?? undefined,
            deliveryFeePerMile: values.deliveryFeePerMile ?? undefined,
          });
          if (!result.ok) setError(result.error);
          else setSaved(true);
        });
      }}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="First day rate ($)">
          <Input
            type="number"
            step="0.01"
            value={values.firstDayRate}
            onChange={(e) => set("firstDayRate", Number(e.target.value))}
          />
        </Field>
        <Field label="Daily rate ($)">
          <Input
            type="number"
            step="0.01"
            value={values.dailyRate}
            onChange={(e) => set("dailyRate", Number(e.target.value))}
          />
        </Field>
        <Field label="Deposit ($)">
          <Input
            type="number"
            step="0.01"
            value={values.depositAmount}
            onChange={(e) => set("depositAmount", Number(e.target.value))}
          />
        </Field>
        <Field label="Battery daily rate ($)">
          <Input
            type="number"
            step="0.01"
            value={values.batteryDailyRate}
            onChange={(e) => set("batteryDailyRate", Number(e.target.value))}
          />
        </Field>
        <Field label="Min rental days">
          <Input
            type="number"
            step="1"
            value={values.minRentalDays}
            onChange={(e) => set("minRentalDays", Number(e.target.value))}
          />
        </Field>
        <Field label="Hold window (hours)">
          <Input
            type="number"
            step="1"
            value={values.holdWindowHours}
            onChange={(e) => set("holdWindowHours", Number(e.target.value))}
          />
        </Field>
        <Field label="Service radius (miles)">
          <Input
            type="number"
            step="1"
            value={values.serviceRadiusMiles}
            onChange={(e) => set("serviceRadiusMiles", Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 border-t pt-4">
        <Field label="Delivery fee model">
          <select
            value={values.deliveryFeeModel}
            onChange={(e) =>
              set("deliveryFeeModel", e.target.value as "flat" | "per_mile")
            }
            className="border-input dark:bg-input/30 h-8 w-40 rounded-lg border bg-transparent px-2.5 text-sm outline-none"
          >
            <option value="flat">Flat fee</option>
            <option value="per_mile">Per mile</option>
          </select>
        </Field>
        {values.deliveryFeeModel === "flat" ? (
          <Field label="Flat delivery fee ($)">
            <Input
              type="number"
              step="0.01"
              className="w-40"
              value={values.deliveryFeeFlat ?? ""}
              onChange={(e) => set("deliveryFeeFlat", Number(e.target.value))}
            />
          </Field>
        ) : (
          <Field label="Delivery fee per mile ($)">
            <Input
              type="number"
              step="0.01"
              className="w-40"
              value={values.deliveryFeePerMile ?? ""}
              onChange={(e) =>
                set("deliveryFeePerMile", Number(e.target.value))
              }
            />
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row">
        <Field label="Venmo username">
          <Input
            value={values.venmoUsername}
            onChange={(e) => set("venmoUsername", e.target.value)}
            className="w-56"
          />
        </Field>
        <Field label="Contact phone">
          <Input
            value={values.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
            className="w-56"
          />
        </Field>
      </div>

      <div className="border-t pt-4">
        <Field label="Cancellation policy text">
          <textarea
            value={values.cancellationPolicyText}
            onChange={(e) => set("cancellationPolicyText", e.target.value)}
            rows={4}
            className="border-input dark:bg-input/30 w-full rounded-lg border bg-transparent p-2.5 text-sm outline-none"
          />
        </Field>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
      )}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
