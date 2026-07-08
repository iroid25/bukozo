import React from "react";
import {
  Database,
  BarChart2,
  Map,
  Edit3,
  ShoppingCart,
  Users,
  ShoppingBag,
  Truck,
  FileText,
  Lock,
  X,
  CheckCircle,
  Clock,
  Rocket,
  ArrowRight,
} from "lucide-react";

interface TimelineStep {
  title: string;
  highlight: string;
  duration: number;
  icon: React.ReactNode;
  painPoint: string;
  benefit: string;
}

const InventoryComparison = ({ theme = "light" }) => {
  const steps: TimelineStep[] = [
    {
      title: "Managing",
      highlight: "Product Catalog",
      duration: 8,
      icon: <Database className="w-4 h-4" />,
      painPoint:
        "Struggling with spreadsheets, duplicate entries, and inconsistent product information",
      benefit:
        "Centralized product database with custom attributes, organized categories, and consistent information",
    },
    {
      title: "Tracking",
      highlight: "Inventory Levels",
      duration: 12,
      icon: <BarChart2 className="w-4 h-4" />,
      painPoint:
        "Manually checking stock levels, unexpected stockouts, and inventory discrepancies",
      benefit:
        "Real-time inventory tracking with automated low-stock alerts and accurate stock history",
    },
    {
      title: "Managing",
      highlight: "Multiple Locations",
      duration: 10,
      icon: <Map className="w-4 h-4" />,
      painPoint:
        "Disconnected inventory systems across locations, leading to confusion and inefficiency",
      benefit:
        "Unified view of inventory across all locations with seamless stock transfer capabilities",
    },
    {
      title: "Recording",
      highlight: "Stock Adjustments",
      duration: 6,
      icon: <Edit3 className="w-4 h-4" />,
      painPoint:
        "Inconsistent recording of inventory changes and lack of adjustment history",
      benefit:
        "Structured adjustment system with reason codes, audit trails, and comprehensive history",
    },
    {
      title: "Processing",
      highlight: "Sales Orders",
      duration: 14,
      icon: <ShoppingCart className="w-4 h-4" />,
      painPoint:
        "Disjointed sales process, order errors, and challenges in fulfillment tracking",
      benefit:
        "Streamlined order management with status tracking and automated invoice generation",
    },
    {
      title: "Managing",
      highlight: "Customer Relationships",
      duration: 7,
      icon: <Users className="w-4 h-4" />,
      painPoint:
        "Scattered customer information and inability to track customer-specific pricing",
      benefit:
        "Comprehensive customer profiles with purchase history and customized pricing tiers",
    },
    {
      title: "Creating",
      highlight: "Purchase Orders",
      duration: 9,
      icon: <ShoppingBag className="w-4 h-4" />,
      painPoint:
        "Manual reordering process, missed orders, and lack of receiving confirmation",
      benefit:
        "Automated purchase order system with supplier tracking and receiving functionality",
    },
    {
      title: "Managing",
      highlight: "Supplier Relationships",
      duration: 5,
      icon: <Truck className="w-4 h-4" />,
      painPoint:
        "Disconnected supplier information and product-supplier relationships",
      benefit:
        "Integrated supplier management with product linking and performance metrics",
    },
    {
      title: "Generating",
      highlight: "Business Reports",
      duration: 11,
      icon: <FileText className="w-4 h-4" />,
      painPoint:
        "Time-consuming manual report creation and delayed business insights",
      benefit:
        "One-click comprehensive reports for inventory, sales, and forecasting needs",
    },
    {
      title: "Controlling",
      highlight: "User Access",
      duration: 4,
      icon: <Lock className="w-4 h-4" />,
      painPoint:
        "Limited control over who can access and modify inventory information",
      benefit:
        "Role-based access control with customizable permissions for different staff roles",
    },
  ];

  const totalHours = steps.reduce((acc, step) => acc + step.duration, 0);

  return (
    <section className="w-full bg-blue-50/20">
      {/* Updated Header Section */}
      <div className="w-full max-w-6xl mx-auto py-20 px-6 text-center">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-8">
          Why Struggle with Manual
          <br />
          Inventory
          <span className="inline-block bg-gradient-to-r from-blue-100 via-teal-100 to-teal-200 px-4 rounded-lg">
            Management?
          </span>
        </h2>

        <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
          See how Inventory Pro transforms your business operations with
          streamlined inventory management that saves time and reduces errors.
          <br />
          Save up to {totalHours} hours per week on inventory tasks
        </p>
      </div>

      {/* Comparison Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Without Inventory Pro */}
          <div className="relative">
            <div className="sticky top-8 bg-white rounded-3xl border border-rose-100 overflow-hidden">
              <div className="p-6 border-b border-rose-100 bg-gradient-to-b from-rose-50/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                    <X className="w-5 h-5 text-rose-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Without Inventory Pro
                  </h3>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-rose-500">
                    {totalHours} Hours
                  </span>
                  <span className="text-slate-600">wasted weekly</span>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-6">
                  {steps.map((step, index) => (
                    <li key={index} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">
                            {step.title}{" "}
                            <span className="font-bold">{step.highlight}</span>
                          </h4>
                          <span className="text-rose-500 text-sm">
                            ~ {step.duration}hrs
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm">
                          {step.painPoint}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* With Inventory Pro */}
          <div className="relative">
            <div className="sticky top-8 bg-white rounded-3xl border border-teal-100 overflow-hidden">
              <div className="p-6 border-b border-teal-100 bg-gradient-to-b from-teal-50/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-teal-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    With Inventory Pro
                  </h3>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-teal-500">
                    Streamlined
                  </span>
                  <span className="text-slate-600">inventory management</span>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-6">
                  {steps.map((step, index) => (
                    <li key={index} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-5 h-5 text-teal-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">
                            {step.title}{" "}
                            <span className="font-bold">{step.highlight}</span>
                          </h4>
                          <ArrowRight className="w-4 h-4 text-teal-500" />
                          <span className="text-teal-500 text-sm">
                            Automated
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm">{step.benefit}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InventoryComparison;
