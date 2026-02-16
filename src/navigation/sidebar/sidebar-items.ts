import {
  Banknote,
  Calendar,
  ChartBar,
  CirclePile,
  DollarSign,
  Fingerprint,
  Forklift,
  Gauge,
  GraduationCap,
  Images,
  Kanban,
  LayoutDashboard,
  ListCheck,
  ListChecks,
  Lock,
  type LucideIcon,
  Mail,
  MessageSquare,
  Package,
  ReceiptText,
  ShieldUser,
  ShoppingBag,
  SquareArrowUpRight,
  Users,
  CirclePlus,
  BookOpenCheck,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        title: "Default",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        title: "CRM",
        url: "/dashboard/crm",
        icon: ChartBar,
      },
      {
        title: "Finance",
        url: "/dashboard/finance",
        icon: Banknote,
      },
      {
        title: "Analytics",
        url: "/dashboard/coming-soon",
        icon: Gauge,
        comingSoon: true,
      },
      {
        title: "E-commerce",
        url: "/dashboard/coming-soon",
        icon: ShoppingBag,
        comingSoon: true,
      },
      {
        title: "Academy",
        url: "/dashboard/coming-soon",
        icon: GraduationCap,
        comingSoon: true,
      },
      {
        title: "Logistics",
        url: "/dashboard/coming-soon",
        icon: Forklift,
        comingSoon: true,
      },
    ],
  },
  {
    id: 2,
    label: "Management",
    items: [
      {
        title: "Catalog",
        url: "/products",
        icon: Images,
        subItems: [
          { title: "Add Product", url: "/products/new", icon: CirclePlus },
          { title: "Update Product", url: "/products/update", icon: BookOpenCheck },
        ],
      },
      {
        title: "Inventory",
        url: "/inventory",
        icon: CirclePile,
        subItems: [
          { title: "Check Inventory", url: "/inventory", icon: ListChecks },
        ],
      },
      {
        title: "Profiles",
        url: "/profiles",
        icon: Users,
      },
      {
        title: "Authentication",
        url: "/auth",
        icon: Fingerprint,
        subItems: [
          { title: "Login v1", url: "/auth/v1/login", newTab: true },
          { title: "Login v2", url: "/auth/v2/login", newTab: true },
          { title: "Register v1", url: "/auth/v1/register", newTab: true },
          { title: "Register v2", url: "/auth/v2/register", newTab: true },
        ],
      },
    ],
  },
  {
    id: 3,
    label: "Store Front",
    items: [
      {
        title: "Products",
        url: "/storefront/products",
        icon: ShoppingBag,
        // subItems: [] can be added later
      },
      {
        title: "Orders",
        url: "/storefront/orders",
        icon: ReceiptText,
      },
      {
        title: "Quotations",
        url: "/storefront/quotations",
        icon: DollarSign,
      },
    ],
  },
  {
    id: 4,
    label: "Misc",
    items: [
      {
        title: "Others",
        url: "/dashboard/coming-soon",
        icon: SquareArrowUpRight,
        comingSoon: true,
      },
    ],
  },
];
