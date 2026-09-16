import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/pens/$penId")({
  validateSearch: (search: Record<string, unknown>): { img?: number } => {
    const raw = search.img;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) && n > 1 ? { img: Math.floor(n) } : {};
  },
  beforeLoad: ({ params, search }) => {
    throw redirect({
      params: { penId: params.penId },
      search,
      to: "/autmog/$penId",
    });
  },
});
