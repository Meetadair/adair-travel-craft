import { createFileRoute } from "@tanstack/react-router";
import { CookiePolicyPage } from "@/pages/company";

export const Route = createFileRoute("/cookies")({ component: CookiePolicyPage });
