"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAdminAction } from "@/src/app/actions/auth";
import { useAuth } from "@/src/hooks/use-auth";
import { Icon } from "@/lib/icon";
import * as mdi from "@mdi/js";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  const isExpired = searchParams.get("expired") === "1";
  const redirectFrom = searchParams.get("from");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }

    if (!username.trim() || !password.trim()) {
      setErrorMessage("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    console.log("Submitting login for user:", username.trim());

    try {
      const result = await loginAdminAction({
        username: username.trim(),
        password: password.trim(),
      });

      console.log("Login action response:", result);

      if (!result.success) {
        setErrorMessage(result.error || "Login failed. Please check your credentials.");
        setIsLoading(false);
        return;
      }

      await refreshUser();

      // Determine redirect target: redirectFrom if valid, otherwise go to home page "/"
      const targetUrl =
        redirectFrom && redirectFrom !== "/login" && redirectFrom !== "/unauthorized"
          ? redirectFrom
          : "/";

      // Full navigation ensures cookie is re-read by server and middleware
      window.location.href = targetUrl;
    } catch (err: any) {
      console.error("Login submission error:", err);
      setErrorMessage(err.message || "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-neutral-50 via-neutral-100 to-primary-50">
      <div className="w-full max-w-md">
        <Card className="border border-border/80 shadow-2xl bg-surface/95 backdrop-blur-md">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner">
              <Icon path={mdi.mdiShieldLockOutline} className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-neutral-900 font-heading">
              Admin Portal
            </CardTitle>
            <CardDescription className="text-subtle-text text-sm">
              Sign in with your OrderCloud Admin account to access the portal
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Session Expired Alert */}
              {isExpired && (
                <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5 text-warning-text text-sm animate-in fade-in slide-in-from-top-1 duration-200">
                  <Icon path={mdi.mdiClockAlertOutline} className="h-5 w-5 shrink-0 text-warning mt-0.5" />
                  <div>
                    <p className="font-semibold text-warning-900">Session Expired</p>
                    <p className="text-xs text-warning-800 mt-0.5">
                      Your session has expired. Please sign in again to continue.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-danger-text text-sm animate-in fade-in duration-200">
                  <Icon path={mdi.mdiAlertCircleOutline} className="h-5 w-5 shrink-0 text-danger" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider" htmlFor="username">
                  Username
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                    <Icon path={mdi.mdiAccountOutline} className="h-4 w-4" />
                  </div>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmit(e);
                    }}
                    className="pl-9 h-11 bg-background"
                    disabled={isLoading}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                    <Icon path={mdi.mdiKeyOutline} className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmit(e);
                    }}
                    className="pl-9 pr-10 h-11 bg-background"
                    disabled={isLoading}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 focus:outline-none transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <Icon
                      path={showPassword ? mdi.mdiEyeOffOutline : mdi.mdiEyeOutline}
                      className="h-4 w-4"
                    />
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 pb-6 flex flex-col gap-3">
              <Button
                type="submit"
                onClick={handleSubmit}
                className="w-full h-11 font-medium text-base shadow-sm transition-all cursor-pointer"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Icon path={mdi.mdiLoading} className="h-5 w-5 animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Icon path={mdi.mdiLogin} className="h-5 w-5" />
                    Sign In
                  </span>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
