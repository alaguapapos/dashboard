export const dashboardViews = ['Resumen', 'Ventas', 'Egresos', 'Depósitos', 'Conexiones', 'Histórico'] as const;
export type DashboardView = typeof dashboardViews[number];

export function dashboardView(value: string | null): DashboardView {
  return dashboardViews.includes(value as DashboardView) ? value as DashboardView : 'Resumen';
}

export function dashboardHref(view: string): string {
  const selected = dashboardView(view);
  return selected === 'Resumen' ? '/' : `/?${new URLSearchParams({view: selected})}`;
}
