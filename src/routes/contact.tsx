import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/pages/company";

export const Route = createFileRoute("/contact")({ component: ContactPage });
