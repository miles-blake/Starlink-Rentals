"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestAdminOtp, verifyOtpAndSignIn } from "./actions";

export function AdminLoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestAdminOtp(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStep("otp");
    });
  }

  function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyOtpAndSignIn(
        email,
        password,
        otpCode,
        callbackUrl
      );
      if (!result.ok && result.error) {
        setError(result.error);
      }
    });
  }

  if (step === "otp") {
    return (
      <form
        onSubmit={submitOtp}
        className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6"
      >
        <p className="text-muted-foreground text-sm">
          We sent a sign-in code to <span className="text-foreground">{email}</span>.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otpCode">Code</Label>
          <Input
            id="otpCode"
            name="otpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" className="mt-1" disabled={pending}>
          {pending ? "Verifying…" : "Verify and sign in"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setStep("credentials");
            setOtpCode("");
            setError(null);
          }}
        >
          Back
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={submitCredentials}
      className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" className="mt-1" disabled={pending}>
        {pending ? "Sending code…" : "Continue"}
      </Button>
    </form>
  );
}
