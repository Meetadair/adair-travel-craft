import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/pages/company";

export const Route = createFileRoute("/about")({ component: AboutPage });
