import type { Instrumentation } from "next";
import { captureAppError } from "@/lib/error-logger";

export const onRequestError: Instrumentation.onRequestError =
  async (error, request) => {
    await captureAppError(error, {
      source: "nextjs-request",
      route: request.path,
      method: request.method,
    });
  };