import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "PGM Admin",
  version: packageJson.version,
  copyright: `© ${currentYear}, PGM Admin.`,
  meta: {
    title: "PGM Admin - Inventory & Operations Dashboard",
    description:
      "PGM Admin is a customized dashboard for inventory, logistics, and customer management, built on Next.js 16, Tailwind CSS v4, shadcn/ui, and Supabase.",
  },
};
