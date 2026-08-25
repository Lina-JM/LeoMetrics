export const navSections = [
  {
    key: "configuration",
    title: "Configuration",
    items: [
      {
        key: "kpi-results",
        label: "Report",
        path: "/kpi-results",
        iconKey: "kpi-results",
        permission: "view_report",
      },
      {
        key: "kpi-management",
        label: "KPIs",
        path: "/kpis",
        iconKey: "kpis",
        permission: "view_kpi",
      },
      {
        key: "user-management",
        label: "Users",
        path: "/users/manage",
        iconKey: "users",
        permission: "view_user",
      },
      {
        key: "user-requests",
        label: "Requests",
        path: "/users/requests",
        iconKey: "requests",
        permission: "view_request",
      },
      {
        key: "module-management",
        label: "Modules",
        path: "/modules/manage",
        iconKey: "modules",
        permission: "view_module",
      },
      {
        key: "ai-support",
        label: "AI Insights",
        path: "/ai-support",
        iconKey: "ai",
        permissionAny: ["view_ai_recommendations", "view_ai_forecasting"],
      }
    ],
  },
];