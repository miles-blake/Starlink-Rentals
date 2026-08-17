"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { uploadConditionPhoto } from "../actions";

export interface ConditionPhotoRow {
  id: string;
  phase: "dropoff" | "return";
  url: string;
  createdAt: string;
}

function PhotoGroup(props: {
  title: string;
  photos: ConditionPhotoRow[];
  reservationId: string;
  phase: "dropoff" | "return";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    formData.set("phase", props.phase);
    startTransition(async () => {
      setError(null);
      const result = await uploadConditionPhoto(props.reservationId, formData);
      if (!result.ok) setError(result.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-medium">{props.title}</h3>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {isPending ? "Uploading…" : "Add photo"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {props.photos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {props.photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className="aspect-square overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private Blob URL, not an optimizable remote image */}
              <img
                src={photo.url}
                alt={`${props.phase} condition photo`}
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConditionPhotosSection(props: {
  reservationId: string;
  photos: ConditionPhotoRow[];
}) {
  const dropoffPhotos = props.photos.filter((p) => p.phase === "dropoff");
  const returnPhotos = props.photos.filter((p) => p.phase === "return");

  return (
    <div className="flex flex-col gap-6">
      <PhotoGroup
        title="Drop-off condition"
        photos={dropoffPhotos}
        reservationId={props.reservationId}
        phase="dropoff"
      />
      <PhotoGroup
        title="Return condition"
        photos={returnPhotos}
        reservationId={props.reservationId}
        phase="return"
      />
    </div>
  );
}
