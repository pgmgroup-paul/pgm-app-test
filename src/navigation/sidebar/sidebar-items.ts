import {
  Banknote,
  BookOpenCheck,
  ChartBar,
  CirclePile,
  CirclePlus,
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
  type LucideIcon,
  Package,
  ReceiptText,
  Ship,
  ShoppingBag,
  SquareArrowUpRight,
  Truck,
  Users,
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
    label: "Import",
    items: [
      {
        title: "Purchase Orders",
        url: "/purchase-orders",
        icon: ReceiptText,
      },
      {
        title: "Planning",
        url: "/shipment-planning",
        icon: Kanban,
        subItems: [
          { title: "Demand", url: "/sales-shipments/demand" },
          { title: "Container Planning", url: "/container-planning" },
          { title: "Shipment Planning", url: "/shipment-planning" },
        ],
      },
      {
        title: "Inbound",
        url: "/inbound-shipments",
        icon: Truck,
        subItems: [
          { title: "Inbound Shipments", url: "/inbound-shipments" },
          { title: "Inbound Containers", url: "/inbound-containers" },
        ],
      },
      {
        title: "Container Payments",
        url: "/container-payments",
        icon: DollarSign,
      },
    ],
  },
  {
    id: 3,
    label: "Management",
    items: [
      {
        title: "Catalog",
        url: "/products",
        icon: Images,
        subItems: [
          { title: "Add Product", url: "/products/new", icon: CirclePlus },
          { title: "View & Edit Product", url: "/products", icon: BookOpenCheck },
        ],
      },
      {
        title: "Inventory",
        url: "/inventory",
        icon: CirclePile,
        subItems: [{ title: "Check Inventory", url: "/inventory", icon: ListChecks }],
      },
      {
        title: "Profiles",
        url: "/profiles",
        icon: Users,
      },
      {
        title: "Activity",
        url: "/activity",
        icon: ReceiptText,
      },
    ],
  },
  {
    id: 9,
    label: "Warehouse",
    items: [
      {
        title: "Inbound",
        url: "/warehouse/add",
        icon: Package,
      },
      {
        title: "Outbound",
        url: "/warehouse/deduct",
        icon: SquareArrowUpRight,
      },
      {
        title: "Internal movement",
        url: "/warehouse/consolidate-transfers",
        icon: CirclePile,
      },
      {
        title: "Container received",
        url: "/warehouse/receiving",
        icon: Package,
      },
      {
        title: "Orders",
        url: "/warehouse/orders-to-process",
        icon: ReceiptText,
      },
      {
        title: "Tools",
        url: "/warehouse/tools",
        icon: Kanban,
        subItems: [
          { title: "Search", url: "/warehouse/search", icon: ListChecks },
          { title: "Movement history", url: "/warehouse/movements", icon: ReceiptText },
          { title: "Enter case and pallet dimensions", url: "/warehouse/dimensions", icon: Images },
          { title: "Check pallet configuration", url: "/warehouse/check-pallet", icon: Kanban },
          { title: "Consolidation", url: "/warehouse/consolidation", icon: CirclePile },
          {
            title: "Transfer overflow to dropship area",
            url: "/warehouse/dropship-transfer",
            icon: BookOpenCheck,
          },
        ],
      },
    ],
  },
  {
    id: 5,
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
    id: 6,
    label: "Sales",
    items: [
      {
        title: "Inventory Availability",
        url: "/sales-shipments/availability",
        icon: CirclePile,
      },
      {
        title: "Sales orders",
        url: "/sales-orders",
        icon: ReceiptText,
        subItems: [
          {
            title: "Manage SO",
            url: "/sales-orders",
          },
          {
            title: "SO Shipments",
            url: "/sales-shipments",
          },
        ],
      },
    ],
  },
  {
    id: 7,
    label: "Suppliers",
    items: [
      {
        title: "Case details",
        url: "/supplier/case-details",
        icon: ReceiptText,
      },
      {
        title: "Production status",
        url: "/supplier/production-status",
        icon: ListCheck,
      },
    ],
  },
];

// Role-aware filtering so different user types see only the relevant sections
export interface SidebarProfile {
  role?: string | null;
  staff_type?: string | null;
  customer_tier?: string | null;
}

export function getSidebarItemsForProfile(profile: SidebarProfile | null | undefined): NavGroup[] {
  const role = profile?.role ?? null;
  const staffType = profile?.staff_type ?? null;

  if (!role) return sidebarItems;

  if (role === "admin") {
    return sidebarItems;
  }

  if (role === "supplier") {
    // Suppliers should only see the Suppliers section.
    return sidebarItems.filter((g) => g.label === "Suppliers");
  }

  if (role === "staff" && staffType === "warehouse") {
    // Warehouse staff should only see the Warehouse section.
    return sidebarItems.filter((g) => g.label === "Warehouse");
  }

  if (role === "staff") {
    // Staff (non-admin, non-warehouse) should not see Suppliers.
    return sidebarItems.filter((g) => g.label !== "Suppliers");
  }

  if (role === "customer") {
    // Customers should only see the storefront section.
    return sidebarItems.filter((g) => g.label === "Store Front");
  }

  return sidebarItems;
}
